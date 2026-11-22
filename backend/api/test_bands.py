import json

from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from bands.models import Band, Membership

User = get_user_model()


class BandsTest(TestCase):
    def setUp(self):
        self.benutzer = User.objects.create_user(
            username="band1", email="band1@example.test", password="geheim-1234"
        )
        self.fremder = User.objects.create_user(
            username="band2", email="band2@example.test", password="geheim-1234"
        )
        self.client = Client()
        self.client.login(username="band1", password="geheim-1234")
        self.fremdclient = Client()
        self.fremdclient.login(username="band2", password="geheim-1234")

    def anlegen(self, client=None, name="Die Band"):
        return (client or self.client).post(
            "/api/bands/",
            data=json.dumps({"name": name}),
            content_type="application/json",
        )

    def test_anlegen_macht_ersteller_zum_owner(self):
        antwort = self.anlegen()
        self.assertEqual(antwort.status_code, 201)
        band = Band.objects.get(id=antwort.json()["id"])
        mitgliedschaft = Membership.objects.get(band=band, user=self.benutzer)
        self.assertEqual(mitgliedschaft.role, Membership.ROLE_OWNER)
        self.assertEqual(list(antwort.json()["songs"]), [])

    def test_liste_zeigt_nur_eigene_bands(self):
        eigen = Band.objects.create(name="Eigene", created_by=self.benutzer)
        Membership.objects.create(band=eigen, user=self.benutzer, role="owner")
        fremd = Band.objects.create(name="Fremde", created_by=self.fremder)
        Membership.objects.create(band=fremd, user=self.fremder, role="owner")

        namen = [band["name"] for band in self.client.get("/api/bands/").json()]
        self.assertEqual(namen, ["Eigene"])

    def test_fremde_band_ist_404(self):
        fremd = Band.objects.create(name="Fremde", created_by=self.fremder)
        Membership.objects.create(band=fremd, user=self.fremder, role="owner")
        antwort = self.client.get(f"/api/bands/{fremd.id}/")
        self.assertEqual(antwort.status_code, 404)

    def test_umbenennen_wirkt_und_bleibt_auf_mitglieder_beschraenkt(self):
        band_id = self.anlegen().json()["id"]
        pfad = f"/api/bands/{band_id}/"
        geaendert = self.client.patch(
            pfad, data=json.dumps({"name": "Neu"}), content_type="application/json"
        )
        self.assertEqual(geaendert.status_code, 200)
        self.assertEqual(geaendert.json()["name"], "Neu")
        fremd = self.fremdclient.patch(
            pfad, data=json.dumps({"name": "Gekapert"}), content_type="application/json"
        )
        self.assertEqual(fremd.status_code, 404)
        self.assertEqual(Band.objects.get(id=band_id).name, "Neu")

    def test_detail_enthaelt_namen_und_songs(self):
        antwort = self.anlegen()
        band_id = antwort.json()["id"]
        detail = self.client.get(f"/api/bands/{band_id}/")
        self.assertEqual(detail.json()["name"], "Die Band")
        self.assertEqual(detail.json()["songs"], [])

    def test_leerer_und_zu_langer_name_werden_abgelehnt(self):
        self.assertEqual(self.anlegen(name="").status_code, 400)
        self.assertEqual(self.anlegen(name="x" * 121).status_code, 400)

    def test_umbenennen_nur_owner(self):
        band_id = self.anlegen().json()["id"]
        mitglied = User.objects.create_user(
            username="mitglied", email="mitglied@example.test", password="geheim-1234"
        )
        Membership.objects.create(band_id=band_id, user=mitglied, role="member")
        mitgliedclient = Client()
        mitgliedclient.login(username="mitglied", password="geheim-1234")
        antwort = mitgliedclient.patch(
            f"/api/bands/{band_id}/",
            data=json.dumps({"name": "Nicht erlaubt"}),
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 403)
        self.assertEqual(Band.objects.get(id=band_id).name, "Die Band")
