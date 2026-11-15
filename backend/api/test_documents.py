import json

from django.test import override_settings

from bands.models import Membership
from documents.models import Document, DocumentVersion
from documents.testhelfer import DokumentTestBasis, dokument_pfad, pdf_bytes, upload


class DokumentMetadatenTest(DokumentTestBasis):
    def test_leerzustand_ohne_dokument(self):
        antwort = self.lade_metadaten()
        self.assertEqual(antwort.status_code, 200)
        self.assertIsNone(antwort.json()["id"])
        self.assertEqual(antwort.json()["versions"], [])
        self.assertEqual(antwort.json()["revision"], 0)
        self.assertEqual(antwort.json()["limits"]["max_pages"], 100)

    def test_upload_legt_erste_version_an_und_laesst_aktiv_null(self):
        antwort = upload(self.client, self.band.id, self.song.id, pdf_bytes(2))
        self.assertEqual(antwort.status_code, 201)
        daten = antwort.json()
        self.assertEqual(daten["number"], 1)
        self.assertEqual(daten["page_count"], 2)
        dokument = Document.objects.get(song=self.song)
        self.assertIsNone(dokument.active_version)
        self.assertEqual(dokument.revision, 0)
        self.assertEqual(DocumentVersion.objects.count(), 1)

    def test_mitglied_darf_ebenfalls_lesen_und_hochladen(self):
        self.client.logout()
        self.client.login(username="mitglied", password="geheim-1234")
        antwort = upload(self.client, self.band.id, self.song.id, pdf_bytes())
        self.assertEqual(antwort.status_code, 201)
        self.assertEqual(self.lade_metadaten().status_code, 200)

    def test_aktivierung_zaehlt_revision_und_schuetzt_vor_altem_stand(self):
        version = upload(self.client, self.band.id, self.song.id, pdf_bytes()).json()
        erste = self.aktiviere(version["id"], revision=0)
        self.assertEqual(erste.status_code, 200)
        self.assertEqual(erste.json()["active_version_id"], version["id"])
        self.assertEqual(erste.json()["revision"], 1)

        veraltet = self.aktiviere(version["id"], revision=0)
        self.assertEqual(veraltet.status_code, 409)
        dokument = Document.objects.get(song=self.song)
        self.assertEqual(dokument.revision, 1)
        self.assertEqual(dokument.active_version_id, version["id"])

    def test_aktivierung_ohne_revision_ist_400(self):
        version = upload(self.client, self.band.id, self.song.id, pdf_bytes()).json()
        antwort = self.client.patch(
            dokument_pfad(self.band.id, self.song.id),
            data=json.dumps({"active_version_id": version["id"]}),
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 400)
        self.assertEqual(Document.objects.get(song=self.song).revision, 0)

    def test_fremde_version_ist_404(self):
        eigene = upload(self.client, self.band.id, self.song.id, pdf_bytes()).json()
        andere = upload(self.client, self.band.id, self.song.id, pdf_bytes()).json()
        fremd = upload(self.client, self.band.id, self.song.id, pdf_bytes()).json()
        antwort = self.client.patch(
            dokument_pfad(self.band.id, self.song.id),
            data={"revision": 0, "active_version_id": 999999},
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 404)
        self.assertEqual(Document.objects.get(song=self.song).revision, 0)
        self.assertEqual(
            {eigene["id"], andere["id"], fremd["id"]},
            set(DocumentVersion.objects.values_list("id", flat=True)),
        )

    def test_aktive_auswahl_bleibt_beim_weiteren_upload_erhalten(self):
        erste = upload(self.client, self.band.id, self.song.id, pdf_bytes()).json()
        self.aktiviere(erste["id"], revision=0)
        zweite = upload(self.client, self.band.id, self.song.id, pdf_bytes(2)).json()
        self.assertEqual(zweite["number"], 2)
        self.assertEqual(Document.objects.get(song=self.song).active_version_id, erste["id"])

    @override_settings(PDF_MAX_UPLOAD_BYTES=1234, PDF_MAX_PAGES=7)
    def test_metadaten_nennen_effektive_grenzen(self):
        antwort = self.lade_metadaten()
        self.assertEqual(
            antwort.json()["limits"], {"max_upload_bytes": 1234, "max_pages": 7}
        )

    def test_metadaten_nennen_weder_schluessel_noch_speicherpfad(self):
        upload(self.client, self.band.id, self.song.id, pdf_bytes())
        text = self.lade_metadaten().content.decode("utf-8")
        version = DocumentVersion.objects.get()
        self.assertNotIn(version.file_key, text)
        self.assertNotIn(self.ablage, text)
        self.assertNotIn("file_key", text)

    def test_versionen_sind_nicht_aenderbar_oder_loeschbar(self):
        version = upload(self.client, self.band.id, self.song.id, pdf_bytes()).json()
        basis = dokument_pfad(self.band.id, self.song.id)
        for methode in ("put", "patch", "delete"):
            with self.subTest(methode=methode):
                antwort = getattr(self.client, methode)(
                    f"{basis}versions/",
                    data=json.dumps({"number": 7}),
                    content_type="application/json",
                )
                self.assertIn(antwort.status_code, (404, 405))
        self.assertTrue(DocumentVersion.objects.filter(id=version["id"]).exists())
        self.assertEqual(DocumentVersion.objects.get(id=version["id"]).number, 1)

    def test_song_mit_pdf_laesst_sich_nicht_loeschen(self):
        upload(self.client, self.band.id, self.song.id, pdf_bytes())
        antwort = self.client.delete(
            f"/api/bands/{self.band.id}/songs/{self.song.id}/"
        )
        self.assertEqual(antwort.status_code, 400)
        self.assertEqual(
            antwort.json()["detail"],
            "Song hat PDF-Versionen und kann nicht gelöscht werden.",
        )
        self.assertTrue(Document.objects.filter(song=self.song).exists())
        self.assertTrue(DocumentVersion.objects.exists())

    def test_mitgliedschaftsentzug_sperrt_alle_zugriffe(self):
        version = upload(self.client, self.band.id, self.song.id, pdf_bytes()).json()
        basis = dokument_pfad(self.band.id, self.song.id)
        datei = f"{basis}versions/{version['id']}/file/"
        Membership.objects.filter(band=self.band, user=self.benutzer).delete()
        self.assertEqual(self.lade_metadaten().status_code, 404)
        self.assertEqual(self.client.get(datei).status_code, 404)
        Membership.objects.create(
            band=self.band, user=self.benutzer, role=Membership.ROLE_OWNER
        )
        self.assertEqual(self.lade_metadaten().status_code, 200)
        self.assertEqual(self.client.get(datei).status_code, 200)

    def test_fremde_band_song_und_version_sind_404(self):
        fremd_client = self.client_class()
        fremd_client.login(username="fremd", password="geheim-1234")
        fremde_antwort = upload(
            fremd_client, self.fremdband.id, self.fremdsong.id, pdf_bytes()
        )
        self.assertEqual(fremde_antwort.status_code, 201, fremde_antwort.content)
        fremde_version = fremde_antwort.json()
        basis = dokument_pfad(self.band.id, self.song.id)
        self.assertEqual(
            self.client.get(dokument_pfad(self.fremdband.id, self.fremdsong.id)).status_code,
            404,
        )
        self.assertEqual(
            self.client.get(
                f"{basis}versions/{fremde_version['id']}/file/"
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.get(f"{basis}versions/999999/file/").status_code, 404
        )

    def test_anonyme_und_csrf_freie_schreibzugriffe(self):
        von_anonym = self.client_class().get(dokument_pfad(self.band.id, self.song.id))
        self.assertEqual(von_anonym.status_code, 401)
        streng = self.client_class(enforce_csrf_checks=True)
        streng.login(username="owner", password="geheim-1234")
        antwort = streng.post(
            f"{dokument_pfad(self.band.id, self.song.id)}versions/",
            {"file": "x", "upload_id": "00000000-0000-0000-0000-000000000000"},
        )
        self.assertEqual(antwort.status_code, 403)

    def test_unbekannter_song_ist_404(self):
        self.assertEqual(
            self.client.get(dokument_pfad(self.band.id, 999999)).status_code, 404
        )
