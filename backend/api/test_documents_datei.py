from bands.models import Membership
from documents.testhelfer import DokumentTestBasis, dokument_pfad, pdf_bytes, upload


class DateiTest(DokumentTestBasis):
    def setUp(self):
        super().setUp()
        self.daten = pdf_bytes(2)
        self.version = upload(
            self.client, self.band.id, self.song.id, self.daten
        ).json()
        self.datei = (
            f"{dokument_pfad(self.band.id, self.song.id)}versions/"
            f"{self.version['id']}/file/"
        )

    def test_vollabruf_liefert_originalbytes_und_header(self):
        antwort = self.client.get(self.datei)
        self.assertEqual(antwort.status_code, 200)
        self.assertEqual(b"".join(antwort.streaming_content), self.daten)
        self.assertEqual(antwort["Content-Type"], "application/pdf")
        self.assertEqual(antwort["X-Content-Type-Options"], "nosniff")
        self.assertEqual(antwort["Cache-Control"], "private, no-store")
        self.assertEqual(antwort["Accept-Ranges"], "bytes")
        self.assertEqual(int(antwort["Content-Length"]), len(self.daten))
        self.assertIn("inline", antwort["Content-Disposition"])

    def test_geschlossene_offene_und_suffix_range(self):
        groesse = len(self.daten)
        faelle = {
            "bytes=0-9": self.daten[:10],
            "bytes=10-": self.daten[10:],
            f"bytes=-{groesse - 4}": self.daten[4:],
            f"bytes=5-{groesse - 1}": self.daten[5:],
        }
        for header, erwartet in faelle.items():
            with self.subTest(header=header):
                antwort = self.client.get(self.datei, HTTP_RANGE=header)
                self.assertEqual(antwort.status_code, 206)
                self.assertEqual(b"".join(antwort.streaming_content), erwartet)
                self.assertEqual(int(antwort["Content-Length"]), len(erwartet))
                self.assertTrue(
                    antwort["Content-Range"].startswith("bytes ")
                    and antwort["Content-Range"].endswith(f"/{groesse}")
                )

    def test_ungueltige_und_mehrteilige_ranges_sind_416(self):
        groesse = len(self.daten)
        for header in (
            "bytes=999999999-",
            "bytes=0-1,4-5",
            "bytes=abc",
            "bytes=-0",
            "bytes=10-4",
            "items=0-1",
        ):
            with self.subTest(header=header):
                antwort = self.client.get(self.datei, HTTP_RANGE=header)
                self.assertEqual(antwort.status_code, 416)
                self.assertEqual(antwort["Content-Range"], f"bytes */{groesse}")

    def test_download_setzt_attachment_und_reinigt_namen(self):
        antwort = self.client.get(self.datei, {"download": "1"})
        self.assertEqual(antwort.status_code, 200)
        self.assertIn("attachment", antwort["Content-Disposition"])
        self.assertIn("partitur.pdf", antwort["Content-Disposition"])
        self.assertNotIn(self.ablage, antwort["Content-Disposition"])

    def test_fremde_und_unbekannte_dateien_sind_404(self):
        self.assertEqual(
            self.client.get(
                f"{dokument_pfad(self.band.id, self.song.id)}versions/999999/file/"
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.get(
                f"{dokument_pfad(self.fremdband.id, self.fremdsong.id)}versions/"
                f"{self.version['id']}/file/"
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.get(
                f"{dokument_pfad(self.band.id, self.fremdsong.id)}versions/"
                f"{self.version['id']}/file/"
            ).status_code,
            404,
        )

    def test_anonym_und_ohne_mitgliedschaft_ist_404_oder_401(self):
        anonym = self.client_class()
        self.assertEqual(anonym.get(self.datei).status_code, 401)
        Membership.objects.filter(band=self.band, user=self.benutzer).delete()
        self.assertEqual(self.client.get(self.datei).status_code, 404)
        Membership.objects.create(
            band=self.band, user=self.benutzer, role=Membership.ROLE_OWNER
        )
        self.assertEqual(self.client.get(self.datei).status_code, 200)
