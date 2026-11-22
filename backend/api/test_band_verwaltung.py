import io
import json
import zipfile

from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from bands.dienste import LetzterOwnerFehler, rolle_aendern
from bands.models import Band, Membership
from realtime.models import OutboxEvent
from stage.models import StageConnection

User = get_user_model()


class Basis(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner", email="owner@example.test", password="geheim-1234"
        )
        self.mitglied = User.objects.create_user(
            username="mitglied",
            email="mitglied@example.test",
            password="geheim-1234",
            display_name="Mitglied Mia",
        )
        self.fremder = User.objects.create_user(
            username="fremder", email="fremder@example.test", password="geheim-1234"
        )
        self.band = Band.objects.create(name="Die Band", created_by=self.owner)
        self.owner_zeile = Membership.objects.create(
            band=self.band, user=self.owner, role=Membership.ROLE_OWNER
        )
        self.mitglied_zeile = Membership.objects.create(
            band=self.band, user=self.mitglied, role=Membership.ROLE_MEMBER
        )
        self.client = Client()
        self.client.login(username="owner", password="geheim-1234")
        self.mitglied_client = Client()
        self.mitglied_client.login(username="mitglied", password="geheim-1234")
        self.fremd_client = Client()
        self.fremd_client.login(username="fremder", password="geheim-1234")

    def patch_band(self, client, daten):
        return client.patch(
            f"/api/bands/{self.band.id}/",
            data=json.dumps(daten),
            content_type="application/json",
        )

    def pfad(self, suffix=""):
        return f"/api/bands/{self.band.id}/{suffix}"


class EinstellungenTest(Basis):
    def test_owner_pflegt_alle_felder_und_mitglied_liest(self):
        antwort = self.patch_band(
            self.client,
            {
                "name": "Neue Band",
                "genre": "Rock",
                "location": "Proberaum Nord",
                "description": "Beschreibung",
                "internal_notes": "Nur für die Band",
            },
        )
        self.assertEqual(antwort.status_code, 200)
        self.assertEqual(antwort.json()["genre"], "Rock")
        detail = self.mitglied_client.get(self.pfad())
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()["location"], "Proberaum Nord")
        self.assertEqual(detail.json()["role"], "member")
        self.assertFalse(detail.json()["can_manage"])

    def test_mitglied_darf_band_nicht_aendern(self):
        antwort = self.patch_band(self.mitglied_client, {"name": "Gekapert"})
        self.assertEqual(antwort.status_code, 403)
        self.assertEqual(Band.objects.get(id=self.band.id).name, "Die Band")

    def test_name_leer_und_nur_leerzeichen(self):
        self.assertEqual(self.patch_band(self.client, {"name": ""}).status_code, 400)
        self.assertEqual(self.patch_band(self.client, {"name": "   "}).status_code, 400)
        self.assertEqual(
            self.patch_band(self.client, {"name": "x" * 121}).status_code, 400
        )
        self.assertEqual(
            self.patch_band(self.client, {"name": "x" * 120}).status_code, 200
        )

    def test_feldgrenzen_und_altwerte(self):
        self.patch_band(
            self.client,
            {
                "genre": "g" * 120,
                "location": "l" * 200,
                "description": "d" * 2_000,
                "internal_notes": "n" * 10_000,
            },
        )
        self.assertEqual(
            self.patch_band(self.client, {"genre": "g" * 121}).status_code, 400
        )
        self.assertEqual(
            self.patch_band(self.client, {"location": "l" * 201}).status_code, 400
        )
        self.assertEqual(
            self.patch_band(self.client, {"description": "d" * 2_001}).status_code,
            400,
        )
        self.assertEqual(
            self.patch_band(self.client, {"internal_notes": "n" * 10_001}).status_code,
            400,
        )
        frisch = Band.objects.get(id=self.band.id)
        self.assertEqual(frisch.genre, "g" * 120)
        self.assertEqual(frisch.location, "l" * 200)

    def test_anonyme_und_fremde_zugriffe(self):
        anonym = Client()
        self.assertEqual(anonym.get(self.pfad("members/")).status_code, 401)
        self.assertEqual(self.fremd_client.get(self.pfad("members/")).status_code, 404)
        self.assertEqual(
            self.fremd_client.get(self.pfad()).status_code, 404
        )

    def test_schreiben_ohne_csrf(self):
        streng = Client(enforce_csrf_checks=True)
        streng.login(username="owner", password="geheim-1234")
        self.assertEqual(self.patch_band(streng, {"name": "X"}).status_code, 403)
        self.assertEqual(
            streng.patch(
                self.pfad(f"members/{self.mitglied_zeile.id}/"),
                data=json.dumps({"role": "owner"}),
                content_type="application/json",
            ).status_code,
            403,
        )


class MitgliederTest(Basis):
    def test_mitgliederliste_ohne_email(self):
        antwort = self.mitglied_client.get(self.pfad("members/"))
        self.assertEqual(antwort.status_code, 200)
        daten = antwort.json()
        self.assertEqual(len(daten), 2)
        for eintrag in daten:
            self.assertNotIn("email", eintrag)
        self.assertTrue(any(e["is_self"] for e in daten))
        owner = next(e for e in daten if e["role"] == "owner")
        self.assertFalse(owner["can_change_role"])
        self.assertFalse(owner["can_remove"])

    def test_rollenwechsel_schuetzt_letzten_owner(self):
        pfad = self.pfad(f"members/{self.mitglied_zeile.id}/")
        antwort = self.client.patch(
            pfad, data=json.dumps({"role": "owner"}), content_type="application/json"
        )
        self.assertEqual(antwort.status_code, 200)
        self.assertEqual(
            Membership.objects.get(id=self.mitglied_zeile.id).role, "owner"
        )
        herab = self.client.patch(
            self.pfad(f"members/{self.owner_zeile.id}/"),
            data=json.dumps({"role": "member"}),
            content_type="application/json",
        )
        self.assertEqual(herab.status_code, 200)
        letzter = self.mitglied_client.patch(
            self.pfad(f"members/{self.mitglied_zeile.id}/"),
            data=json.dumps({"role": "member"}),
            content_type="application/json",
        )
        self.assertEqual(letzter.status_code, 400)
        self.assertEqual(
            Membership.objects.filter(band=self.band, role="owner").count(), 1
        )

    def test_ungueltige_rolle_und_koerper(self):
        pfad = self.pfad(f"members/{self.mitglied_zeile.id}/")
        for koerper in (
            {"role": "admin"},
            {"role": ""},
            {"role": None},
            {},
            ["owner"],
        ):
            antwort = self.client.patch(
                pfad, data=json.dumps(koerper), content_type="application/json"
            )
            self.assertEqual(antwort.status_code, 400, koerper)
        self.assertEqual(
            Membership.objects.get(id=self.mitglied_zeile.id).role, "member"
        )

    def test_normales_mitglied_entfernt_nur_sich_selbst(self):
        fremd = self.pfad(f"members/{self.owner_zeile.id}/")
        self.assertEqual(self.mitglied_client.delete(fremd).status_code, 403)
        eigen = self.pfad(f"members/{self.mitglied_zeile.id}/")
        self.assertEqual(self.mitglied_client.delete(eigen).status_code, 204)
        self.assertFalse(Membership.objects.filter(id=self.mitglied_zeile.id).exists())

    def test_owner_entfernt_mitglied_und_schliesst_buehne(self):
        verbindung = StageConnection.objects.create(
            band=self.band,
            user=self.mitglied,
            session_key="abc",
        )
        antwort = self.client.delete(
            self.pfad(f"members/{self.mitglied_zeile.id}/")
        )
        self.assertEqual(antwort.status_code, 204)
        verbindung.refresh_from_db()
        self.assertIsNotNone(verbindung.closed_at)

    def test_letzter_owner_kann_nicht_entfernen_oder_austreten(self):
        pfad = self.pfad(f"members/{self.owner_zeile.id}/")
        self.assertEqual(self.client.delete(pfad).status_code, 400)
        self.assertTrue(Membership.objects.filter(id=self.owner_zeile.id).exists())

    def test_zwei_owner_erlauben_austritt(self):
        zweiter = User.objects.create_user(
            username="zweiter", email="zweiter@example.test", password="geheim-1234"
        )
        zweite_zeile = Membership.objects.create(
            band=self.band, user=zweiter, role="owner"
        )
        antwort = self.client.delete(
            self.pfad(f"members/{self.owner_zeile.id}/")
        )
        self.assertEqual(antwort.status_code, 204)
        self.assertTrue(Membership.objects.filter(id=zweite_zeile.id).exists())

    def test_fremde_mitgliedschaft_ist_404(self):
        fremd_band = Band.objects.create(name="Fremd", created_by=self.fremder)
        fremd = Membership.objects.create(
            band=fremd_band, user=self.fremder, role="owner"
        )
        antwort = self.client.delete(
            self.pfad(f"members/{fremd.id}/")
        )
        self.assertEqual(antwort.status_code, 404)


class SnapshotUndExportTest(Basis):
    def test_sync_liefert_bandfelder_und_rolle(self):
        self.patch_band(
            self.client, {"genre": "Jazz", "location": "Halle", "description": "Text"}
        )
        owner = self.client.get(self.pfad("sync/")).json()
        self.assertEqual(owner["band"]["genre"], "Jazz")
        self.assertEqual(owner["band"]["role"], "owner")
        self.assertTrue(owner["band"]["can_manage"])
        mitglied = self.mitglied_client.get(self.pfad("sync/")).json()
        self.assertEqual(mitglied["band"]["role"], "member")
        self.assertFalse(mitglied["band"]["can_manage"])

    def test_export_enthaelt_bandfelder_ohne_mail_und_token(self):
        self.patch_band(
            self.client,
            {
                "genre": "Jazz",
                "location": "Halle",
                "description": "Text",
                "internal_notes": "Notiz",
            },
        )
        antwort = self.client.get(self.pfad("export/"))
        self.assertEqual(antwort.status_code, 200)
        rohdaten = b"".join(antwort.streaming_content)
        with zipfile.ZipFile(io.BytesIO(rohdaten)) as archiv:
            manifest = json.loads(archiv.read("manifest.json"))
        self.assertEqual(manifest["band"]["genre"], "Jazz")
        self.assertEqual(manifest["band"]["internal_notes"], "Notiz")
        roh = json.dumps(manifest)
        self.assertNotIn("owner@example.test", roh)
        self.assertNotIn("token", roh)


class EreignisTest(Basis):
    def test_band_und_mitgliederereignis(self):
        self.patch_band(self.client, {"name": "Neu"})
        self.assertTrue(
            OutboxEvent.objects.filter(event_type="band.updated").exists()
        )
        self.client.patch(
            self.pfad(f"members/{self.mitglied_zeile.id}/"),
            data=json.dumps({"role": "owner"}),
            content_type="application/json",
        )
        self.assertTrue(
            OutboxEvent.objects.filter(event_type="band.members.updated").exists()
        )

    def test_fehlgeschlagene_aenderung_erzeugt_kein_ereignis(self):
        self.patch_band(self.client, {"name": "   "})
        self.assertFalse(
            OutboxEvent.objects.filter(event_type="band.updated").exists()
        )

    def test_dienst_schuetzt_letzten_owner(self):
        with self.assertRaises(LetzterOwnerFehler):
            rolle_aendern(self.band, self.owner, self.owner_zeile.id, "member")
        self.assertEqual(
            Membership.objects.get(id=self.owner_zeile.id).role, "owner"
        )
