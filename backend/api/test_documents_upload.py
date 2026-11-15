import os
import subprocess
import uuid
from pathlib import Path
from unittest import mock

from django.core.management import call_command
from django.test import override_settings

from documents.models import Document, DocumentVersion
from documents.pruefung import pruefe_pdf as echte_pruefung
from documents.testhelfer import DokumentTestBasis, dokument_pfad, pdf_bytes, upload
from library.models import Song


class UploadTest(DokumentTestBasis):
    def test_wiederholung_mit_gleicher_uuid_liefert_dieselbe_version(self):
        kennung = uuid.uuid4()
        daten = pdf_bytes()
        erste = upload(self.client, self.band.id, self.song.id, daten, upload_id=kennung)
        zweite = upload(self.client, self.band.id, self.song.id, daten, upload_id=kennung)
        self.assertEqual(erste.status_code, 201)
        self.assertEqual(zweite.status_code, 200)
        self.assertEqual(erste.json()["id"], zweite.json()["id"])
        self.assertEqual(DocumentVersion.objects.count(), 1)

    def test_gleiche_uuid_mit_anderen_bytes_ist_409(self):
        kennung = uuid.uuid4()
        upload(self.client, self.band.id, self.song.id, pdf_bytes(1), upload_id=kennung)
        antwort = upload(
            self.client, self.band.id, self.song.id, pdf_bytes(2), upload_id=kennung
        )
        self.assertEqual(antwort.status_code, 409)
        self.assertEqual(DocumentVersion.objects.count(), 1)
        self.assertEqual(self._dateien(), 1)

    def test_ungueltige_dateien_werden_kontrolliert_abgelehnt(self):
        faelle = {
            "leer": b"",
            "kein-pdf": b"keine pdf",
            "beschaedigt": b"%PDF-1.7\n" + b"x" * 100,
            "verschluesselt": pdf_bytes(1, passwort="geheim"),
        }
        for name, daten in faelle.items():
            with self.subTest(name=name):
                antwort = upload(self.client, self.band.id, self.song.id, daten)
                self.assertEqual(antwort.status_code, 400)
                self.assertIn("file", antwort.json())
        self.assertFalse(Document.objects.exists())
        self.assertEqual(DocumentVersion.objects.count(), 0)
        self.assertEqual(self._dateien(), 0)

    @override_settings(PDF_MAX_PAGES=2)
    def test_seitenlimit_genau_und_ueberschritten(self):
        genau = upload(self.client, self.band.id, self.song.id, pdf_bytes(2))
        self.assertEqual(genau.status_code, 201)
        zu_viel = upload(self.client, self.band.id, self.song.id, pdf_bytes(3))
        self.assertEqual(zu_viel.status_code, 400)
        self.assertIn("file", zu_viel.json())

    def test_bytelimit_genau_und_ueberschritten(self):
        klein = pdf_bytes(1)
        gross = pdf_bytes(2)
        with override_settings(PDF_MAX_UPLOAD_BYTES=len(klein)):
            self.assertEqual(
                upload(self.client, self.band.id, self.song.id, klein).status_code, 201
            )
        with override_settings(PDF_MAX_UPLOAD_BYTES=len(gross) - 1):
            antwort = upload(self.client, self.band.id, self.song.id, gross)
            self.assertEqual(antwort.status_code, 413)
        self.assertEqual(DocumentVersion.objects.count(), 1)

    @override_settings(PDF_MAX_UPLOAD_BYTES=0, PDF_MAX_PAGES=0)
    def test_null_deaktiviert_nur_das_jeweilige_limit(self):
        antwort = upload(self.client, self.band.id, self.song.id, pdf_bytes(120))
        self.assertEqual(antwort.status_code, 201)
        self.assertEqual(antwort.json()["page_count"], 120)

    def test_abgleich_ueber_upload_uuid(self):
        basis = f"{dokument_pfad(self.band.id, self.song.id)}versions/"
        kennung = uuid.uuid4()
        leer = self.client.get(basis, {"upload_id": str(kennung)})
        self.assertEqual(leer.status_code, 200)
        self.assertEqual(leer.json(), [])
        version = upload(
            self.client, self.band.id, self.song.id, pdf_bytes(), upload_id=kennung
        ).json()
        treffer = self.client.get(basis, {"upload_id": str(kennung)})
        self.assertEqual([eintrag["id"] for eintrag in treffer.json()], [version["id"]])
        self.assertEqual(self.client.get(basis, {"upload_id": "keine-uuid"}).status_code, 400)
        self.assertEqual(self.client.get(basis).status_code, 400)

    def test_originalname_wird_bereinigt(self):
        antwort = upload(
            self.client,
            self.band.id,
            self.song.id,
            pdf_bytes(),
            name="../../etc/partitur.pdf",
        )
        self.assertEqual(antwort.status_code, 201)
        self.assertEqual(antwort.json()["original_name"], "partitur.pdf")

    def test_song_loeschung_waehrend_des_uploads_ist_404(self):
        def loeschen_und_pruefen(pfad):
            ergebnis = echte_pruefung(pfad)
            Song.objects.filter(id=self.song.id).delete()
            return ergebnis

        with mock.patch("api.documents.pruefe_pdf", side_effect=loeschen_und_pruefen):
            antwort = upload(self.client, self.band.id, self.song.id, pdf_bytes())
        self.assertEqual(antwort.status_code, 404)
        self.assertFalse(Document.objects.exists())
        self.assertEqual(self._dateien(), 0)

    def test_pruefzeitueberschreitung_hinterlaesst_keine_version(self):
        with mock.patch(
            "documents.pruefung.subprocess.run",
            side_effect=subprocess.TimeoutExpired(cmd="pypdf", timeout=1),
        ):
            antwort = upload(self.client, self.band.id, self.song.id, pdf_bytes())
        self.assertEqual(antwort.status_code, 400)
        self.assertFalse(Document.objects.exists())
        self.assertEqual(self._dateien(), 0)

    def test_bereinigung_entfernt_nur_unreferenzierte_alte_dateien(self):
        upload(self.client, self.band.id, self.song.id, pdf_bytes())
        referenziert = next(Path(self.ablage).glob("*.pdf"))
        unreferenziert = Path(self.ablage) / ("f" * 64 + ".pdf")
        unreferenziert.write_bytes(b"rest")
        temporaer = Path(self.ablage) / "tmp" / "alter-rest.part"
        temporaer.parent.mkdir(parents=True, exist_ok=True)
        temporaer.write_bytes(b"rest")
        alt = 0
        for datei in (referenziert, unreferenziert, temporaer):
            os.utime(datei, (alt, alt))

        call_command("bereinige_dokumente", verbosity=0)

        self.assertTrue(referenziert.exists())
        self.assertFalse(unreferenziert.exists())
        self.assertFalse(temporaer.exists())

    def _dateien(self) -> int:
        return sum(1 for eintrag in Path(self.ablage).rglob("*") if eintrag.is_file())
