import uuid

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import Client, TestCase, TransactionTestCase
from django.test.utils import CaptureQueriesContext

from annotations.models import Annotation
from bands.models import Band, Membership
from documents.models import Document, DocumentVersion
from gigs.models import Gig
from library.models import Song
from realtime.models import OutboxEvent, Stream
from realtime.services import band_ereignis, persoenliches_ereignis
from setlists.models import Entry, Section, Setlist

User = get_user_model()


def konto(name):
    return User.objects.create_user(
        username=name, email=f"{name}@example.test", password="geheim-1234"
    )


class AbgleichTest(TestCase):
    def setUp(self):
        self.benutzer = konto("abgleich")
        self.fremder = konto("fremd")
        self.band = Band.objects.create(name="Abgleichband", created_by=self.benutzer)
        Membership.objects.create(band=self.band, user=self.benutzer, role="owner")
        self.fremdband = Band.objects.create(name="Fremdband", created_by=self.fremder)
        Membership.objects.create(band=self.fremdband, user=self.fremder, role="owner")
        self.song = Song.objects.create(band=self.band, title="Abgleichsong")
        self.setlist = Setlist.objects.create(band=self.band, name="Hauptset")
        abschnitt = Section.objects.create(
            setlist=self.setlist, name="Set 1", kind="set", position=1
        )
        Entry.objects.create(
            section=abschnitt, position=1, entry_type="song", song=self.song
        )
        Gig.objects.create(band=self.band, title="Auftritt", date="2026-12-24")
        self.client = Client()
        self.client.login(username="abgleich", password="geheim-1234")

    def test_abgleich_liefert_daten_und_zaehler(self):
        band_ereignis(self.band, "song.updated", id=self.song.id)
        persoenliches_ereignis(self.band, self.benutzer, "annotation.created", id=1)
        antwort = self.client.get(f"/api/bands/{self.band.id}/sync/")
        self.assertEqual(antwort.status_code, 200)
        daten = antwort.json()
        self.assertEqual(daten["band"]["name"], "Abgleichband")
        self.assertEqual(daten["songs"][0]["title"], "Abgleichsong")
        self.assertEqual(daten["setlists"][0]["sections"][0]["entries"][0]["label"], "")
        self.assertEqual(len(daten["gigs"]["upcoming"]), 1)
        self.assertEqual(daten["counters"], {"band": 1, "personal": 1})
        self.assertIn("server_time", daten)

    def test_schmaler_abgleich_liefert_nur_zaehler(self):
        antwort = self.client.get(f"/api/bands/{self.band.id}/sync/?nur_zaehler=1")
        self.assertEqual(antwort.status_code, 200)
        self.assertEqual(set(antwort.json()), {"counters", "server_time"})

    def test_fremde_band_ist_404(self):
        self.assertEqual(
            self.client.get(f"/api/bands/{self.fremdband.id}/sync/").status_code, 404
        )

    def test_ohne_anmeldung_401(self):
        self.assertEqual(
            Client().get(f"/api/bands/{self.band.id}/sync/").status_code, 401
        )


class AbgleichSnapshotTest(TransactionTestCase):
    def test_abgleich_nutzt_repeatable_read(self):
        benutzer = konto("snapshot")
        band = Band.objects.create(name="Snapshotband", created_by=benutzer)
        Membership.objects.create(band=band, user=benutzer, role="owner")
        Song.objects.create(band=band, title="Snapshot-Song")
        client = Client()
        client.login(username="snapshot", password="geheim-1234")
        with CaptureQueriesContext(connection) as abfragen:
            antwort = client.get(f"/api/bands/{band.id}/sync/")
        self.assertEqual(antwort.status_code, 200)
        self.assertTrue(
            any("REPEATABLE READ" in eintrag["sql"].upper() for eintrag in abfragen)
        )
        self.assertEqual(antwort.json()["songs"][0]["title"], "Snapshot-Song")


class MutationsEreignisTest(TestCase):
    def setUp(self):
        self.benutzer = konto("mutation")
        self.band = Band.objects.create(name="Mutationsband", created_by=self.benutzer)
        Membership.objects.create(band=self.band, user=self.benutzer, role="owner")
        self.song = Song.objects.create(band=self.band, title="Start")
        self.client = Client()
        self.client.login(username="mutation", password="geheim-1234")

    def test_song_anlegen_erzeugt_bandereignis(self):
        antwort = self.client.post(
            f"/api/bands/{self.band.id}/songs/",
            data={"title": "Neu", "bpm": 120},
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 201)
        ereignis = OutboxEvent.objects.get()
        self.assertEqual(ereignis.event_type, "song.created")
        self.assertEqual(ereignis.seq, 1)
        self.assertEqual(ereignis.stream.kind, Stream.ART_BAND)
        self.assertEqual(ereignis.payload["id"], antwort.json()["id"])

    def test_ungueltige_mutation_erzeugt_kein_ereignis(self):
        antwort = self.client.post(
            f"/api/bands/{self.band.id}/songs/",
            data={"title": "", "bpm": 999},
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 400)
        self.assertEqual(OutboxEvent.objects.count(), 0)

    def test_persoenliche_anmerkung_bleibt_im_persoenlichen_strom(self):
        version = self._version()
        antwort = self.client.post(
            self._annotations_pfad(version),
            data={
                "uuid": str(uuid.uuid4()),
                "page_number": 1,
                "kind": "text",
                "text": "Nur für mich",
                "geometry": {"x": 0.1, "y": 0.1, "width": 0.2, "height": 0.1},
            },
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 201)
        ereignis = OutboxEvent.objects.get()
        self.assertEqual(ereignis.stream.kind, Stream.ART_PERSOENLICH)
        self.assertEqual(ereignis.stream.user_id, self.benutzer.id)
        self.assertEqual(OutboxEvent.objects.filter(stream__kind=Stream.ART_BAND).count(), 0)

    def test_privatisieren_sendet_entfernen_ohne_inhalt(self):
        version = self._version()
        anmerkung = Annotation.objects.create(
            document_version=version,
            author=self.benutzer,
            page_number=1,
            kind="text",
            visibility=Annotation.SICHTBAR_BAND,
            geometry={"x": 0.1, "y": 0.1, "width": 0.2, "height": 0.1},
            text="Geheimtext",
            font_size=0.0225,
        )
        antwort = self.client.patch(
            self._anmerkungs_pfad(version, anmerkung),
            data={"revision": 0, "visibility": "private"},
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 200)
        entfernen = OutboxEvent.objects.filter(event_type="annotation.entfernt").get()
        self.assertNotIn("Geheimtext", str(entfernen.payload))
        self.assertNotIn("text", entfernen.payload)

    def _version(self):
        dokument = Document.objects.create(song=self.song)
        return DocumentVersion.objects.create(
            document=dokument,
            number=1,
            upload_id=uuid.uuid4(),
            file_key=f"test-{uuid.uuid4()}",
            original_name="test.pdf",
            byte_size=10,
            page_count=1,
            sha256="a" * 64,
            uploaded_by=self.benutzer,
        )

    def _annotations_pfad(self, version):
        return (
            f"/api/bands/{self.band.id}/songs/{self.song.id}/document/versions/"
            f"{version.id}/annotations/"
        )

    def _anmerkungs_pfad(self, version, anmerkung):
        return f"{self._annotations_pfad(version)}{anmerkung.id}/"
