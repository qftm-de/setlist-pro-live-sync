"""Harmlose PDF-Testdateien zur Laufzeit. Keine echten Unterlagen im Repo."""

from __future__ import annotations

import io
import shutil
import tempfile
import uuid

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from pypdf import PdfWriter

from bands.models import Band, Membership
from library.models import Song

User = get_user_model()


def pdf_bytes(seiten: int = 1, passwort: str | None = None) -> bytes:
    writer = PdfWriter()
    for _ in range(seiten):
        writer.add_blank_page(width=595, height=842)
    if passwort:
        writer.encrypt(passwort)
    puffer = io.BytesIO()
    writer.write(puffer)
    return puffer.getvalue()


def upload(client, band_id: int, song_id: int, daten: bytes, **felder):
    datei = SimpleUploadedFile(
        felder.pop("name", "partitur.pdf"), daten, content_type="application/pdf"
    )
    werte = {"file": datei, "upload_id": str(felder.pop("upload_id", uuid.uuid4()))}
    werte.update(felder)
    return client.post(
        f"/api/bands/{band_id}/songs/{song_id}/document/versions/", werte
    )


def dokument_pfad(band_id: int, song_id: int) -> str:
    return f"/api/bands/{band_id}/songs/{song_id}/document/"


class DokumentTestBasis(TestCase):
    """Eigene private Ablage je Test, zwei Bands und drei Konten."""

    def setUp(self):
        self.ablage = tempfile.mkdtemp(prefix="dokumente-")
        self.addCleanup(shutil.rmtree, self.ablage, True)
        self.override = override_settings(
            DOCUMENTS_ROOT=self.ablage,
            PDF_MAX_UPLOAD_BYTES=20 * 1024 * 1024,
            PDF_MAX_PAGES=100,
            PDF_CHECK_TIMEOUT_SECONDS=30,
            PDF_CHECK_MEMORY_MB=512,
        )
        self.override.enable()
        self.addCleanup(self.override.disable)

        self.benutzer = User.objects.create_user(
            username="owner", email="owner@example.test", password="geheim-1234"
        )
        self.mitglied = User.objects.create_user(
            username="mitglied", email="mitglied@example.test", password="geheim-1234"
        )
        self.fremder = User.objects.create_user(
            username="fremd", email="fremd@example.test", password="geheim-1234"
        )
        self.band = Band.objects.create(name="Die Band", created_by=self.benutzer)
        Membership.objects.create(
            band=self.band, user=self.benutzer, role=Membership.ROLE_OWNER
        )
        Membership.objects.create(
            band=self.band, user=self.mitglied, role=Membership.ROLE_MEMBER
        )
        self.fremdband = Band.objects.create(name="Fremde", created_by=self.fremder)
        Membership.objects.create(
            band=self.fremdband, user=self.fremder, role=Membership.ROLE_OWNER
        )
        self.song = Song.objects.create(band=self.band, title="Abrissbirne")
        self.fremdsong = Song.objects.create(band=self.fremdband, title="Fremdlied")

        self.client = Client()
        self.client.login(username="owner", password="geheim-1234")

    def lade_metadaten(self):
        return self.client.get(dokument_pfad(self.band.id, self.song.id))

    def aktiviere(self, version_id: int, revision: int):
        return self.client.patch(
            dokument_pfad(self.band.id, self.song.id),
            data={"revision": revision, "active_version_id": version_id},
            content_type="application/json",
        )

