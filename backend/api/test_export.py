"""R16: Bandexport als ZIP mit Manifest, PDFs und gefilterten Anmerkungen."""

from __future__ import annotations

import io
import json
import uuid
import zipfile
from datetime import date, time

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import Client
from rest_framework.throttling import SimpleRateThrottle

from annotations.models import Annotation
from collaboration.models import TextState
from collaboration.text import initialzustand
from documents.models import DocumentVersion
from documents.testhelfer import DokumentTestBasis, pdf_bytes, upload
from export.archiv import ExportZuGross, baue_archiv
from export.inhalt import band_export
from gigs.models import Gig
from setlists.models import Entry, Section, Setlist

User = get_user_model()


def archiv_bytes(antwort) -> bytes:
    return b"".join(antwort.streaming_content)


class ExportTest(DokumentTestBasis):
    def setUp(self):
        super().setUp()
        cache.clear()
        self.band.name = 'Bänd "Live" / Test'
        self.band.save(update_fields=["name"])

        self.setlist = Setlist.objects.create(band=self.band, name="Set 1")
        self.section = Section.objects.create(
            setlist=self.setlist, name="Anfang", kind="set", position=0
        )
        self.entry = Entry.objects.create(
            section=self.section,
            position=0,
            entry_type="song",
            song=self.song,
            label="Start",
        )
        TextState.objects.create(
            object_type=TextState.TYP_SETLIST,
            object_uuid=self.setlist.uuid,
            field=TextState.FELD_NAME,
            epoch=1,
            revision=1,
            state=initialzustand("Set aus CRDT"),
        )
        TextState.objects.create(
            object_type=TextState.TYP_SECTION,
            object_uuid=self.section.uuid,
            field=TextState.FELD_NAME,
            epoch=1,
            revision=1,
            state=initialzustand("Abschnitt aus CRDT"),
        )
        TextState.objects.create(
            object_type=TextState.TYP_ENTRY,
            object_uuid=self.entry.uuid,
            field=TextState.FELD_LABEL,
            epoch=1,
            revision=1,
            state=initialzustand("Eintrag aus CRDT"),
        )
        Gig.objects.create(
            band=self.band,
            title="Auftritt",
            date=date(2030, 5, 1),
            time=time(20, 0),
            location="Halle",
            notes="Notiz",
            setlist=self.setlist,
        )

        self.pdf_bytes = pdf_bytes(1)
        self.version = upload(
            self.client, self.band.id, self.song.id, self.pdf_bytes
        ).json()
        self.version_id = self.version["id"]
        self.version_obj = DocumentVersion.objects.get(id=self.version_id)

    def _anmerkung(self, autor, sichtbarkeit: str, text: str, feld: str = ""):
        anmerkung = Annotation.objects.create(
            document_version=self.version_obj,
            author=autor,
            page_number=1,
            kind="text",
            visibility=sichtbarkeit,
            geometry={"x": 0.1, "y": 0.1, "width": 0.2, "height": 0.05},
            color="gelb",
            text=text,
            font_size=0.0225,
        )
        if feld:
            TextState.objects.create(
                object_type=TextState.TYP_ANNOTATION,
                object_uuid=anmerkung.uuid,
                field=TextState.FELD_TEXT,
                epoch=1,
                revision=1,
                state=initialzustand(feld),
            )
        return anmerkung

    def pfad(self, band_id: int | None = None) -> str:
        return f"/api/bands/{band_id or self.band.id}/export/"

    def test_volles_zip_mit_manifest_pdf_und_texten(self):
        eigene_privat = self._anmerkung(
            self.benutzer, Annotation.SICHTBAR_PRIVAT, "Spalte", "Privat aus CRDT"
        )
        eigene_band = self._anmerkung(
            self.benutzer, Annotation.SICHTBAR_BAND, "Band"
        )
        fremde_privat = self._anmerkung(
            self.mitglied, Annotation.SICHTBAR_PRIVAT, "Geheim"
        )
        fremde_band = self._anmerkung(
            self.mitglied, Annotation.SICHTBAR_BAND, "Gemeinsam"
        )

        antwort = self.client.get(self.pfad(), HTTP_ACCEPT="application/zip")
        self.assertEqual(antwort.status_code, 200)
        self.assertEqual(antwort["Content-Type"], "application/zip")
        self.assertIn("attachment", antwort["Content-Disposition"])
        self.assertIn("export.zip", antwort["Content-Disposition"])
        self.assertIn(
            'filename="Band-Live-Test-export.zip"', antwort["Content-Disposition"]
        )
        self.assertIn(
            "filename*=UTF-8''B%C3%A4nd-Live-Test-export.zip",
            antwort["Content-Disposition"],
        )

        roh = archiv_bytes(antwort)
        archiv = zipfile.ZipFile(io.BytesIO(roh))
        namen = archiv.namelist()
        self.assertIn("manifest.json", namen)
        pdf_name = f"pdfs/{self.song.id}/v001-partitur.pdf"
        self.assertIn(pdf_name, namen)
        self.assertEqual(archiv.read(pdf_name), self.pdf_bytes)

        manifest = json.loads(archiv.read("manifest.json"))
        self.assertEqual(manifest["format"], "setlist-pro-export")
        self.assertEqual(manifest["band"]["name"], 'Bänd "Live" / Test')
        self.assertEqual(len(manifest["songs"]), 1)
        version = manifest["songs"][0]["document"]["versions"][0]
        self.assertEqual(version["sha256"], self.version_obj.sha256)
        self.assertEqual(version["byte_size"], len(self.pdf_bytes))
        self.assertEqual(version["archive_path"], pdf_name)

        setlist = manifest["setlists"][0]
        self.assertEqual(setlist["text"]["name"], "Set aus CRDT")
        self.assertEqual(setlist["sections"][0]["text"]["name"], "Abschnitt aus CRDT")
        self.assertEqual(
            setlist["sections"][0]["entries"][0]["text"]["label"],
            "Eintrag aus CRDT",
        )
        self.assertEqual(manifest["gigs"][0]["setlist_uuid"], str(self.setlist.uuid))

        kennungen = {eintrag["uuid"] for eintrag in manifest["annotations"]}
        self.assertIn(str(eigene_privat.uuid), kennungen)
        self.assertIn(str(eigene_band.uuid), kennungen)
        self.assertIn(str(fremde_band.uuid), kennungen)
        self.assertNotIn(str(fremde_privat.uuid), kennungen)
        eigene = next(
            eintrag
            for eintrag in manifest["annotations"]
            if eintrag["uuid"] == str(eigene_privat.uuid)
        )
        self.assertEqual(eigene["text"], "Privat aus CRDT")

    def test_fremde_band_anonym_und_unbekannt(self):
        self.assertEqual(
            Client().get(self.pfad(), HTTP_ACCEPT="application/zip").status_code, 401
        )

        fremd = Client()
        fremd.login(username="fremd", password="geheim-1234")
        self.assertEqual(
            fremd.get(self.pfad(), HTTP_ACCEPT="application/zip").status_code, 404
        )
        self.assertEqual(self.client.get(self.pfad(self.fremdband.id)).status_code, 404)

        self.assertEqual(
            self.client.get(
                self.pfad(99999), HTTP_ACCEPT="application/zip"
            ).status_code,
            404,
        )
        self.assertEqual(self.client.get("/api/bands/abc/export/").status_code, 404)

    def test_fehlerpfade_liefern_json_auch_mit_zip_accept(self):
        anonym = Client().get(self.pfad(), HTTP_ACCEPT="application/zip")
        self.assertEqual(anonym.status_code, 401)
        self.assertEqual(anonym["Content-Type"], "application/json")

        fremd = Client()
        fremd.login(username="fremd", password="geheim-1234")
        verweigert = fremd.get(self.pfad(), HTTP_ACCEPT="application/zip")
        self.assertEqual(verweigert.status_code, 404)
        self.assertEqual(verweigert["Content-Type"], "application/json")

        with self.settings(EXPORT_MAX_BYTES=1):
            zu_gross = self.client.get(self.pfad(), HTTP_ACCEPT="application/zip")
        self.assertEqual(zu_gross.status_code, 413)
        self.assertEqual(zu_gross["Content-Type"], "application/json")
        self.assertEqual(
            zu_gross.json()["detail"],
            "Der Export überschreitet die Größenobergrenze.",
        )

    def test_export_bremse(self):
        with patch.dict(SimpleRateThrottle.THROTTLE_RATES, {"export": "1/min"}):
            self.assertEqual(self.client.get(self.pfad()).status_code, 200)
            self.assertEqual(self.client.get(self.pfad()).status_code, 429)

    def test_leere_band_und_mehrere_versionen(self):
        leer = self.client.post("/api/bands/", {"name": "Leer"})
        self.assertEqual(leer.status_code, 201)
        leer_id = leer.json()["id"]
        antwort = self.client.get(self.pfad(leer_id))
        self.assertEqual(antwort.status_code, 200)
        manifest = json.loads(
            zipfile.ZipFile(io.BytesIO(archiv_bytes(antwort))).read("manifest.json")
        )
        self.assertEqual(manifest["songs"], [])
        self.assertEqual(manifest["setlists"], [])
        self.assertEqual(manifest["gigs"], [])
        self.assertEqual(manifest["annotations"], [])

        zweite = upload(
            self.client,
            self.band.id,
            self.song.id,
            pdf_bytes(2),
            upload_id=str(uuid.uuid4()),
        )
        self.assertEqual(zweite.status_code, 201, zweite.content)
        antwort = self.client.get(self.pfad())
        namen = zipfile.ZipFile(io.BytesIO(archiv_bytes(antwort))).namelist()
        self.assertIn(f"pdfs/{self.song.id}/v001-partitur.pdf", namen)
        self.assertIn(f"pdfs/{self.song.id}/v002-partitur.pdf", namen)

    def test_groesse_genau_erreicht_und_ueberschritten(self):
        manifest, pdfs = band_export(self.band, self.benutzer)
        datei, groesse = baue_archiv(manifest, pdfs)
        datei.close()
        self.assertGreater(groesse, 0)

        genau, gezaehlt = baue_archiv(manifest, pdfs, groesse)
        genau.close()
        self.assertEqual(gezaehlt, groesse)

        with self.assertRaises(ExportZuGross):
            baue_archiv(manifest, pdfs, groesse - 1)

        with self.settings(EXPORT_MAX_BYTES=1):
            antwort = self.client.get(self.pfad(), HTTP_ACCEPT="application/zip")
        self.assertEqual(antwort.status_code, 413)
        self.assertEqual(
            antwort.json()["detail"],
            "Der Export überschreitet die Größenobergrenze.",
        )

        with self.settings(EXPORT_MAX_BYTES=0):
            antwort = self.client.get(self.pfad())
            self.assertEqual(antwort.status_code, 200)
            self.assertGreater(len(archiv_bytes(antwort)), 0)
