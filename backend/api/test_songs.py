import json

from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from bands.models import Band, Membership
from library.models import Song

User = get_user_model()


class SongsTest(TestCase):
    def setUp(self):
        self.benutzer = User.objects.create_user(
            username="band1", email="band1@example.test", password="geheim-1234"
        )
        self.fremder = User.objects.create_user(
            username="band2", email="band2@example.test", password="geheim-1234"
        )
        self.band = Band.objects.create(name="Die Band", created_by=self.benutzer)
        Membership.objects.create(band=self.band, user=self.benutzer, role="owner")
        self.fremdband = Band.objects.create(name="Fremde", created_by=self.fremder)
        Membership.objects.create(band=self.fremdband, user=self.fremder, role="owner")
        self.client = Client()
        self.client.login(username="band1", password="geheim-1234")

    def anlegen(self, **felder):
        daten = {"title": "Abrissbirne"}
        daten.update(felder)
        return self.client.post(
            f"/api/bands/{self.band.id}/songs/",
            data=json.dumps(daten),
            content_type="application/json",
        )

    def test_anlegen_erscheint_in_der_bandliste(self):
        antwort = self.anlegen(artist="Die Band", key="Am", bpm=128)
        self.assertEqual(antwort.status_code, 201)
        self.assertEqual(antwort.json()["bpm"], 128)
        songs = self.client.get(f"/api/bands/{self.band.id}/").json()["songs"]
        self.assertEqual([song["title"] for song in songs], ["Abrissbirne"])

    def test_aendern_und_loeschen(self):
        song_id = self.anlegen().json()["id"]
        pfad = f"/api/bands/{self.band.id}/songs/{song_id}/"
        geaendert = self.client.patch(
            pfad, data=json.dumps({"title": "Neu"}), content_type="application/json"
        )
        self.assertEqual(geaendert.status_code, 200)
        self.assertEqual(geaendert.json()["title"], "Neu")
        self.assertEqual(self.client.delete(pfad).status_code, 204)
        self.assertFalse(Song.objects.filter(id=song_id).exists())

    def test_titel_und_bpm_grenzen(self):
        self.assertEqual(self.anlegen(title="").status_code, 400)
        self.assertEqual(self.anlegen(bpm=10).status_code, 400)
        self.assertEqual(self.anlegen(bpm=401).status_code, 400)
        self.assertEqual(self.anlegen(bpm=20).status_code, 201)

    def test_fremde_band_ist_404(self):
        antwort = self.client.get(f"/api/bands/{self.fremdband.id}/songs/")
        self.assertEqual(antwort.status_code, 404)
        fremder_song = Song.objects.create(band=self.fremdband, title="Fremd")
        pfad = f"/api/bands/{self.fremdband.id}/songs/{fremder_song.id}/"
        self.assertEqual(self.client.get(pfad).status_code, 404)
        self.assertEqual(self.client.delete(pfad).status_code, 404)

    def test_reihenfolge_bleibt_stabil(self):
        ids = [self.anlegen(title=f"Song {nummer}").json()["id"] for nummer in range(3)]
        self.client.patch(
            f"/api/bands/{self.band.id}/songs/{ids[0]}/",
            data=json.dumps({"title": "Zuerst geaendert"}),
            content_type="application/json",
        )
        songs = self.client.get(f"/api/bands/{self.band.id}/").json()["songs"]
        self.assertEqual([song["id"] for song in songs], ids)
