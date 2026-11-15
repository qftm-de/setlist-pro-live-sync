import shutil
import tempfile
import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from django.contrib.auth import get_user_model
from django.db import close_old_connections
from django.test import Client, TransactionTestCase, override_settings

from annotations.models import Annotation
from annotations.testhelfer import anlage
from bands.models import Band, Membership
from documents.testhelfer import pdf_bytes, upload
from library.models import Song


class AnnotationRaceTest(TransactionTestCase):
    def setUp(self):
        self.ablage = tempfile.mkdtemp(prefix="anmerkungs-race-")
        self.addCleanup(shutil.rmtree, self.ablage, True)
        self.override = override_settings(
            DOCUMENTS_ROOT=self.ablage,
            PDF_MAX_PAGES=100,
            PDF_MAX_UPLOAD_BYTES=20 * 1024 * 1024,
        )
        self.override.enable()
        self.addCleanup(self.override.disable)
        User = get_user_model()
        self.benutzer = User.objects.create_user(
            username="race", email="race@example.test", password="geheim-1234"
        )
        self.band = Band.objects.create(name="Race-Band", created_by=self.benutzer)
        Membership.objects.create(
            band=self.band, user=self.benutzer, role=Membership.ROLE_OWNER
        )
        self.song = Song.objects.create(band=self.band, title="Race-Song")
        client = Client()
        client.login(username="race", password="geheim-1234")
        self.version = upload(
            client, self.band.id, self.song.id, pdf_bytes()
        ).json()
        self.pfad = (
            f"/api/bands/{self.band.id}/songs/{self.song.id}/document/versions/"
            f"{self.version['id']}/annotations/"
        )

    def _post(self, kennung, text, schranke):
        close_old_connections()
        client = Client()
        client.login(username="race", password="geheim-1234")
        schranke.wait(timeout=10)
        try:
            return client.post(
                self.pfad,
                data=anlage(uuid=kennung, text=text),
                content_type="application/json",
            ).status_code
        finally:
            close_old_connections()

    def test_parallele_gleiche_uuid_bleibt_kontrolliert(self):
        kennung = str(uuid.uuid4())
        schranke = Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            laeufe = [
                pool.submit(self._post, kennung, "Gleicher Text", schranke)
                for _ in range(2)
            ]
            status = sorted(lauf.result() for lauf in laeufe)
        self.assertEqual(status, [200, 201])
        self.assertEqual(Annotation.objects.filter(uuid=kennung).count(), 1)

    def test_parallele_verschiedene_daten_liefern_201_und_409(self):
        kennung = str(uuid.uuid4())
        schranke = Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            laeufe = [
                pool.submit(self._post, kennung, text, schranke)
                for text in ("Erster Text", "Zweiter Text")
            ]
            status = sorted(lauf.result() for lauf in laeufe)
        self.assertEqual(status, [201, 409])
        self.assertEqual(Annotation.objects.filter(uuid=kennung).count(), 1)
