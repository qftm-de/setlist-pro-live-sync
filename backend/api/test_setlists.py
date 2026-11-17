import json
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from bands.models import Band, Membership
from library.models import Song
from setlists.models import Entry, Section, Setlist

User = get_user_model()


class SetlistsTest(TestCase):
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
        self.song_a = Song.objects.create(band=self.band, title="Abrissbirne")
        self.song_b = Song.objects.create(band=self.band, title="Zweiter")
        self.fremdsong = Song.objects.create(band=self.fremdband, title="Fremd")
        self.client = Client()
        self.client.login(username="band1", password="geheim-1234")

    def anlegen(self, name="Hauptset"):
        return self.client.post(
            f"/api/bands/{self.band.id}/setlists/",
            data=json.dumps({"name": name}),
            content_type="application/json",
        )

    def inhalt(self, sections, revision=None):
        if revision is None:
            revision = Setlist.objects.get(pk=self.setlist.pk).revision
        return self.client.put(
            f"/api/bands/{self.band.id}/setlists/{self.setlist.id}/content/",
            data=json.dumps({"revision": revision, "sections": sections}),
            content_type="application/json",
        )

    def test_anlegen_und_liste(self):
        antwort = self.anlegen()
        self.assertEqual(antwort.status_code, 201)
        self.assertEqual(antwort.json()["name"], "Hauptset")
        self.assertEqual(antwort.json()["sections"], [])
        self.setlist = Setlist.objects.get(id=antwort.json()["id"])
        liste = self.client.get(f"/api/bands/{self.band.id}/setlists/").json()
        self.assertEqual([eintrag["name"] for eintrag in liste], ["Hauptset"])

    def test_doppelter_name_wird_abgelehnt(self):
        self.anlegen("Hauptset")
        antwort = self.anlegen("Hauptset")
        self.assertEqual(antwort.status_code, 400)

    def test_umbenennen(self):
        self.setlist = Setlist.objects.get(id=self.anlegen().json()["id"])
        antwort = self.client.patch(
            f"/api/bands/{self.band.id}/setlists/{self.setlist.id}/",
            data=json.dumps(
                {"name": "Zweites Set", "revision": self.setlist.revision}
            ),
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 200)
        self.assertEqual(antwort.json()["name"], "Zweites Set")

    def test_umbenennen_auf_vorhandenen_namen_wird_abgelehnt(self):
        self.setlist = Setlist.objects.get(id=self.anlegen("Hauptset").json()["id"])
        self.anlegen("Zweites Set")
        antwort = self.client.patch(
            f"/api/bands/{self.band.id}/setlists/{self.setlist.id}/",
            data=json.dumps(
                {"name": "Zweites Set", "revision": self.setlist.revision}
            ),
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 400)
        self.assertEqual(Setlist.objects.get(id=self.setlist.id).name, "Hauptset")

    def test_namensrace_wird_als_400_beantwortet(self):
        self.anlegen("Hauptset")
        with mock.patch("api.serializers.name_frei", return_value=True):
            antwort = self.anlegen("Hauptset")
        self.assertEqual(antwort.status_code, 400)
        self.assertEqual(Setlist.objects.filter(name="Hauptset").count(), 1)

    def test_namensrace_beim_umbenennen_wird_als_400_beantwortet(self):
        self.setlist = Setlist.objects.get(id=self.anlegen("Hauptset").json()["id"])
        self.anlegen("Zweites Set")
        with mock.patch("api.serializers.name_frei", return_value=True):
            antwort = self.client.patch(
                f"/api/bands/{self.band.id}/setlists/{self.setlist.id}/",
                data=json.dumps({"name": "Zweites Set"}),
                content_type="application/json",
            )
        self.assertEqual(antwort.status_code, 400)
        self.assertEqual(Setlist.objects.get(id=self.setlist.id).name, "Hauptset")

    def test_inhalt_speichern_und_lesen(self):
        self.setlist = Setlist.objects.get(id=self.anlegen().json()["id"])
        antwort = self.inhalt(
            [
                {
                    "name": "Set 1",
                    "kind": "set",
                    "entries": [
                        {"entry_type": "song", "song_id": self.song_a.id},
                        {"entry_type": "song", "song_id": self.song_a.id},
                    ],
                },
                {"name": "Pause", "kind": "pause", "entries": [{"entry_type": "pause"}]},
            ]
        )
        self.assertEqual(antwort.status_code, 200)
        bereiche = antwort.json()["sections"]
        self.assertEqual([abschnitt["position"] for abschnitt in bereiche], [1, 2])
        self.assertEqual([abschnitt["kind"] for abschnitt in bereiche], ["set", "pause"])
        self.assertEqual(
            [eintrag["position"] for eintrag in bereiche[0]["entries"]], [1, 2]
        )
        self.assertEqual(bereiche[0]["entries"][0]["song"]["title"], "Abrissbirne")
        self.assertEqual(bereiche[1]["entries"][0]["label"], "Pause")

    def test_umsortieren_bleibt_stabil(self):
        self.setlist = Setlist.objects.get(id=self.anlegen().json()["id"])
        self.inhalt(
            [
                {
                    "name": "Set 1",
                    "kind": "set",
                    "entries": [
                        {"entry_type": "song", "song_id": self.song_a.id},
                        {"entry_type": "song", "song_id": self.song_b.id},
                    ],
                }
            ]
        )
        antwort = self.inhalt(
            [
                {
                    "name": "Set 1",
                    "kind": "set",
                    "entries": [
                        {"entry_type": "song", "song_id": self.song_b.id},
                        {"entry_type": "song", "song_id": self.song_a.id},
                    ],
                }
            ]
        )
        titel = [eintrag["song"]["title"] for eintrag in antwort.json()["sections"][0]["entries"]]
        self.assertEqual(titel, ["Zweiter", "Abrissbirne"])
        self.assertEqual(
            [eintrag["position"] for eintrag in antwort.json()["sections"][0]["entries"]],
            [1, 2],
        )

    def test_fremde_band_ist_404(self):
        fremd = Setlist.objects.create(band=self.fremdband, name="Fremd")
        self.assertEqual(
            self.client.get(f"/api/bands/{self.fremdband.id}/setlists/").status_code, 404
        )
        self.assertEqual(
            self.client.get(
                f"/api/bands/{self.fremdband.id}/setlists/{fremd.id}/"
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.put(
                f"/api/bands/{self.fremdband.id}/setlists/{fremd.id}/content/",
                data=json.dumps({"sections": [{"name": "x", "kind": "set"}]}),
                content_type="application/json",
            ).status_code,
            404,
        )

    def test_fehlerhafte_eingaben_werden_abgelehnt(self):
        self.setlist = Setlist.objects.get(id=self.anlegen().json()["id"])
        self.assertEqual(self.inhalt([]).status_code, 400)
        self.assertEqual(
            self.inhalt([{"name": "x", "kind": "unbekannt"}]).status_code, 400
        )
        fremd = self.inhalt(
            [
                {
                    "name": "x",
                    "kind": "set",
                    "entries": [{"entry_type": "song", "song_id": self.fremdsong.id}],
                }
            ]
        )
        self.assertEqual(fremd.status_code, 400)
        self.assertIn("song_id", json.dumps(fremd.json()))
        ohne_song = self.inhalt(
            [{"name": "x", "kind": "set", "entries": [{"entry_type": "song"}]}]
        )
        self.assertEqual(ohne_song.status_code, 400)
        pause_mit_song = self.inhalt(
            [
                {
                    "name": "x",
                    "kind": "pause",
                    "entries": [{"entry_type": "pause", "song_id": self.song_a.id}],
                }
            ]
        )
        self.assertEqual(pause_mit_song.status_code, 400)

    def test_notiz_ohne_bezeichnung_wird_abgelehnt(self):
        self.setlist = Setlist.objects.get(id=self.anlegen().json()["id"])
        antwort = self.inhalt(
            [{"name": "x", "kind": "set", "entries": [{"entry_type": "notiz"}]}]
        )
        self.assertEqual(antwort.status_code, 400)
        self.assertIn("label", json.dumps(antwort.json()))

    def test_fehlerhafter_inhalt_laesst_alten_stand_unveraendert(self):
        self.setlist = Setlist.objects.get(id=self.anlegen().json()["id"])
        self.inhalt(
            [
                {
                    "name": "Set 1",
                    "kind": "set",
                    "entries": [{"entry_type": "song", "song_id": self.song_a.id}],
                }
            ]
        )
        antwort = self.inhalt(
            [
                {
                    "name": "Kaputt",
                    "kind": "set",
                    "entries": [{"entry_type": "song", "song_id": self.fremdsong.id}],
                }
            ]
        )
        self.assertEqual(antwort.status_code, 400)
        self.assertEqual(Section.objects.filter(setlist=self.setlist).count(), 1)
        self.assertEqual(Entry.objects.filter(section__setlist=self.setlist).count(), 1)
        self.assertEqual(
            Section.objects.get(setlist=self.setlist).name, "Set 1"
        )

    def test_song_in_setlist_laesst_sich_nicht_loeschen(self):
        self.setlist = Setlist.objects.get(id=self.anlegen().json()["id"])
        self.inhalt(
            [
                {
                    "name": "Set 1",
                    "kind": "set",
                    "entries": [{"entry_type": "song", "song_id": self.song_a.id}],
                }
            ]
        )
        pfad = f"/api/bands/{self.band.id}/songs/{self.song_a.id}/"
        antwort = self.client.delete(pfad)
        self.assertEqual(antwort.status_code, 400)
        self.assertIn("Setlist", antwort.json()["detail"])
        self.assertTrue(Song.objects.filter(id=self.song_a.id).exists())

        self.inhalt([{"name": "Leer", "kind": "set", "entries": []}])
        self.assertEqual(self.client.delete(pfad).status_code, 204)

    def test_setlist_loeschen(self):
        self.setlist = Setlist.objects.get(id=self.anlegen().json()["id"])
        antwort = self.client.delete(
            f"/api/bands/{self.band.id}/setlists/{self.setlist.id}/"
        )
        self.assertEqual(antwort.status_code, 204)
        self.assertFalse(Setlist.objects.filter(id=self.setlist.id).exists())
