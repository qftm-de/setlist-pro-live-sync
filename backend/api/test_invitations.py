import json
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.utils import timezone

from bands.einladungen import erstelle_einladung, token_hash
from bands.models import Band, BandInvitation, Membership
from realtime.models import OutboxEvent

User = get_user_model()


class Basis(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner", email="owner@example.test", password="geheim-1234"
        )
        self.mitglied = User.objects.create_user(
            username="mitglied", email="mitglied@example.test", password="geheim-1234"
        )
        self.fremder = User.objects.create_user(
            username="fremder", email="fremder@example.test", password="geheim-1234"
        )
        self.band = Band.objects.create(name="Die Band", created_by=self.owner)
        Membership.objects.create(
            band=self.band, user=self.owner, role=Membership.ROLE_OWNER
        )
        Membership.objects.create(
            band=self.band, user=self.mitglied, role=Membership.ROLE_MEMBER
        )
        self.client = Client()
        self.client.login(username="owner", password="geheim-1234")
        self.mitglied_client = Client()
        self.mitglied_client.login(username="mitglied", password="geheim-1234")
        self.fremd_client = Client()
        self.fremd_client.login(username="fremder", password="geheim-1234")

    def listen_pfad(self):
        return f"/api/bands/{self.band.id}/invitations/"

    def erstelle(self, **daten):
        return self.client.post(
            self.listen_pfad(), data=json.dumps(daten), content_type="application/json"
        )

    def neue_einladung(self, **felder):
        return erstelle_einladung(self.band, self.owner, **felder)


class ErstellungTest(Basis):
    def test_owner_erstellt_und_liste_zeigt_kein_token(self):
        antwort = self.erstelle(note="Gruppenchat", max_uses=5)
        self.assertEqual(antwort.status_code, 201)
        daten = antwort.json()
        self.assertTrue(daten["token"])
        self.assertEqual(daten["invite_path"], f"/einladung/{daten['token']}")
        gespeichert = BandInvitation.objects.get(id=daten["id"])
        self.assertEqual(gespeichert.token_hash, token_hash(daten["token"]))
        self.assertNotEqual(gespeichert.token_hash, daten["token"])
        liste = self.client.get(self.listen_pfad()).json()
        self.assertEqual(len(liste), 1)
        self.assertNotIn("token", liste[0])
        self.assertNotIn("token_hash", liste[0])

    def test_normales_mitglied_und_fremde(self):
        self.assertEqual(
            self.mitglied_client.get(self.listen_pfad()).status_code, 403
        )
        self.assertEqual(
            self.mitglied_client.post(
                self.listen_pfad(), data="{}", content_type="application/json"
            ).status_code,
            403,
        )
        self.assertEqual(self.fremd_client.get(self.listen_pfad()).status_code, 404)
        self.assertEqual(Client().get(self.listen_pfad()).status_code, 401)

    def test_note_und_max_uses_grenzen(self):
        self.assertEqual(self.erstelle(note="n" * 120).status_code, 201)
        self.assertEqual(self.erstelle(note="n" * 121).status_code, 400)
        for wert in (0, -1, 101, True, "abc", 1.5):
            self.assertEqual(self.erstelle(max_uses=wert).status_code, 400, wert)
        for wert in (1, 100, None):
            self.assertEqual(self.erstelle(max_uses=wert).status_code, 201, wert)

    def test_ereignis_bei_erstellung(self):
        self.erstelle()
        self.assertTrue(
            OutboxEvent.objects.filter(event_type="band.invitations.updated").exists()
        )


class VorschauTest(Basis):
    def test_vorschau_ist_schreibfrei_und_hat_feste_schluessel(self):
        einladung, rohtoken = self.neue_einladung()
        antwort = Client().get(f"/api/invitations/{rohtoken}/")
        self.assertEqual(antwort.status_code, 200)
        daten = antwort.json()
        self.assertEqual(
            set(daten),
            {"band_name", "expires_at", "authenticated", "already_member"},
        )
        einladung.refresh_from_db()
        self.assertEqual(einladung.uses_count, 0)
        self.assertIsNone(einladung.last_used_at)

    def test_ungueltig_abgelaufen_widerrufen_ausgeschoepft(self):
        self.assertEqual(Client().get("/api/invitations/unbekannt/").status_code, 404)
        einladung, rohtoken = self.neue_einladung()
        einladung.expires_at = timezone.now() - timedelta(seconds=1)
        einladung.save(update_fields=["expires_at"])
        self.assertEqual(Client().get(f"/api/invitations/{rohtoken}/").status_code, 404)

        zweite, token2 = self.neue_einladung()
        zweite.revoked_at = timezone.now()
        zweite.save(update_fields=["revoked_at"])
        self.assertEqual(Client().get(f"/api/invitations/{token2}/").status_code, 404)

        dritte, token3 = self.neue_einladung(max_uses=1)
        dritte.uses_count = 1
        dritte.save(update_fields=["uses_count"])
        self.assertEqual(Client().get(f"/api/invitations/{token3}/").status_code, 404)

    def test_grenze_der_laufzeit(self):
        einladung, rohtoken = self.neue_einladung()
        einladung.expires_at = timezone.now() + timedelta(seconds=2)
        einladung.save(update_fields=["expires_at"])
        self.assertEqual(Client().get(f"/api/invitations/{rohtoken}/").status_code, 200)
        einladung.expires_at = timezone.now()
        einladung.save(update_fields=["expires_at"])
        self.assertEqual(Client().get(f"/api/invitations/{rohtoken}/").status_code, 404)

    def test_angemeldetes_mitglied_sieht_sich(self):
        _, rohtoken = self.neue_einladung()
        daten = self.mitglied_client.get(f"/api/invitations/{rohtoken}/").json()
        self.assertTrue(daten["authenticated"])
        self.assertTrue(daten["already_member"])


