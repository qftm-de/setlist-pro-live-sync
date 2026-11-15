import json
import uuid
from unittest import mock

from django.contrib import admin
from django.db import IntegrityError
from django.test import Client

from annotations.models import Annotation
from annotations.testhelfer import AnnotationTestBasis, anlage
from bands.models import Membership


class AnnotationCrudTest(AnnotationTestBasis):
    def test_anlegen_lesen_aendern_und_loeschen(self):
        angelegt = self.erstelle()
        self.assertEqual(angelegt.status_code, 201)
        daten = angelegt.json()
        self.assertEqual(daten["author_id"], self.benutzer.id)
        self.assertEqual(daten["revision"], 0)
        self.assertTrue(daten["can_edit"])
        self.assertTrue(daten["can_delete"])

        liste = self.client.get(self.pfad())
        self.assertEqual([eintrag["id"] for eintrag in liste.json()], [daten["id"]])
        detail = self.client.get(self.pfad(annotation_id=daten["id"]))
        self.assertEqual(detail.json()["text"], "Leiser spielen")

        geaendert = self.client.patch(
            self.pfad(annotation_id=daten["id"]),
            data={"revision": 0, "text": "Lauter spielen", "color": "blau"},
            content_type="application/json",
        )
        self.assertEqual(geaendert.status_code, 200)
        self.assertEqual(geaendert.json()["text"], "Lauter spielen")
        self.assertEqual(geaendert.json()["revision"], 1)
        self.assertEqual(geaendert.json()["author_id"], self.benutzer.id)

        geloescht = self.client.delete(
            f"{self.pfad(annotation_id=daten['id'])}?revision=1"
        )
        self.assertEqual(geloescht.status_code, 204)
        self.assertFalse(Annotation.objects.exists())

    def test_standardwerte_und_marker(self):
        ohne = anlage(visibility=None, font_size=None)
        ohne.pop("visibility")
        ohne.pop("font_size")
        antwort = self.client.post(self.pfad(), data=ohne, content_type="application/json")
        self.assertEqual(antwort.status_code, 201)
        self.assertEqual(antwort.json()["visibility"], "private")
        self.assertEqual(antwort.json()["font_size"], 0.0225)

        marker = self.client.post(
            self.pfad(),
            data=anlage(kind="marker", text="", font_size=None, color="gruen"),
            content_type="application/json",
        )
        self.assertEqual(marker.status_code, 201)
        self.assertEqual(marker.json()["text"], "")
        self.assertIsNone(marker.json()["font_size"])
        self.assertEqual(marker.json()["color"], "gruen")

    def test_uuid_wiederholung_und_abweichende_daten(self):
        kennung = str(uuid.uuid4())
        erst = self.erstelle(uuid=kennung)
        gleich = self.erstelle(uuid=kennung)
        self.assertEqual(erst.status_code, 201)
        self.assertEqual(gleich.status_code, 200)
        self.assertEqual(erst.json()["id"], gleich.json()["id"])
        self.assertEqual(Annotation.objects.count(), 1)

        anders = self.erstelle(uuid=kennung, text="Anderer Text")
        self.assertEqual(anders.status_code, 409)
        self.assertEqual(Annotation.objects.count(), 1)

    def _vorhandene(self, kennung, text="Vorhanden"):
        return Annotation.objects.create(
            document_version_id=self.version["id"],
            author=self.benutzer,
            uuid=kennung,
            page_number=1,
            kind="text",
            visibility="private",
            geometry={"x": 0.1, "y": 0.1, "width": 0.2, "height": 0.05},
            color="gelb",
            text=text,
            font_size=0.0225,
        )

    def test_integrityerror_pfad_gleicht_gleiche_anmerkung_ab(self):
        kennung = str(uuid.uuid4())
        vorhanden = self._vorhandene(kennung)
        filter_echt = Annotation.objects.filter
        with (
            mock.patch(
                "api.annotations.Annotation.objects.filter",
                side_effect=[Annotation.objects.none(), filter_echt(uuid=kennung)],
            ),
            mock.patch(
                "api.annotations.Annotation.objects.create",
                side_effect=IntegrityError,
            ),
        ):
            antwort = self.erstelle(uuid=kennung, text="Vorhanden")
        self.assertEqual(antwort.status_code, 200)
        self.assertEqual(antwort.json()["id"], vorhanden.id)

    def test_integrityerror_pfad_lehnt_abweichende_daten_ab(self):
        kennung = str(uuid.uuid4())
        self._vorhandene(kennung, text="Vorhanden")
        filter_echt = Annotation.objects.filter
        with (
            mock.patch(
                "api.annotations.Annotation.objects.filter",
                side_effect=[Annotation.objects.none(), filter_echt(uuid=kennung)],
            ),
            mock.patch(
                "api.annotations.Annotation.objects.create",
                side_effect=IntegrityError,
            ),
        ):
            antwort = self.erstelle(uuid=kennung, text="Anders")
        self.assertEqual(antwort.status_code, 409)
        self.assertEqual(Annotation.objects.count(), 1)

    def test_skalare_json_koerper_werden_abgelehnt(self):
        for koerper in ([], 5, None, "x"):
            with self.subTest(koerper=koerper):
                antwort = self.client.post(
                    self.pfad(),
                    data=json.dumps(koerper),
                    content_type="application/json",
                )
                self.assertEqual(antwort.status_code, 400)
        angelegt = self.erstelle().json()
        for koerper in ([], 5, None, "x"):
            with self.subTest(patch=koerper):
                antwort = self.client.patch(
                    self.pfad(annotation_id=angelegt["id"]),
                    data=json.dumps(koerper),
                    content_type="application/json",
                )
                self.assertEqual(antwort.status_code, 400)

    def test_verschwundene_anmerkung_ist_404(self):
        angelegt = self.erstelle().json()

        class Leer:
            def filter(self, *args, **kwargs):
                return self

            def first(self):
                return None

        with mock.patch(
            "api.annotations.Annotation.objects.select_for_update",
            return_value=Leer(),
        ):
            aendern = self.client.patch(
                self.pfad(annotation_id=angelegt["id"]),
                data={"revision": 0, "text": "Neu"},
                content_type="application/json",
            )
            loeschen = self.client.delete(
                f"{self.pfad(annotation_id=angelegt['id'])}?revision=0"
            )
        self.assertEqual(aendern.status_code, 404)
        self.assertEqual(loeschen.status_code, 404)

    def test_revision_schuetzt_vor_altem_stand(self):
        angelegt = self.erstelle().json()
        erste = self.client.patch(
            self.pfad(annotation_id=angelegt["id"]),
            data={"revision": 0, "text": "Neu"},
            content_type="application/json",
        )
        self.assertEqual(erste.status_code, 200)
        veraltet = self.client.patch(
            self.pfad(annotation_id=angelegt["id"]),
            data={"revision": 0, "text": "Noch neuer"},
            content_type="application/json",
        )
        self.assertEqual(veraltet.status_code, 409)
        self.assertEqual(Annotation.objects.get().text, "Neu")
        self.assertEqual(Annotation.objects.get().revision, 1)

        ohne = self.client.patch(
            self.pfad(annotation_id=angelegt["id"]),
            data={"text": "Ohne Revision"},
            content_type="application/json",
        )
        self.assertEqual(ohne.status_code, 400)
        self.assertEqual(
            self.client.delete(self.pfad(annotation_id=angelegt["id"])).status_code,
            400,
        )
        self.assertEqual(
            self.client.delete(
                f"{self.pfad(annotation_id=angelegt['id'])}?revision=0"
            ).status_code,
            409,
        )

    def test_unveraenderliche_felder_werden_abgelehnt(self):
        angelegt = self.erstelle().json()
        for feld, wert in (
            ("author", self.mitglied.id),
            ("document_version", 999),
            ("uuid", str(uuid.uuid4())),
        ):
            with self.subTest(feld=feld):
                antwort = self.client.patch(
                    self.pfad(annotation_id=angelegt["id"]),
                    data={"revision": 0, feld: wert},
                    content_type="application/json",
                )
                self.assertEqual(antwort.status_code, 400)
        aktuell = Annotation.objects.get()
        self.assertEqual(aktuell.author_id, self.benutzer.id)
        self.assertEqual(aktuell.document_version_id, self.version["id"])
        self.assertEqual(aktuell.revision, 0)

    def test_teilen_und_wieder_persoenlich(self):
        angelegt = self.erstelle().json()
        geteilt = self.client.patch(
            self.pfad(annotation_id=angelegt["id"]),
            data={"revision": 0, "visibility": "band"},
            content_type="application/json",
        )
        self.assertEqual(geteilt.status_code, 200)
        mitglied = self.mitglied_client()
        sichtbar = mitglied.get(self.pfad()).json()
        self.assertEqual(len(sichtbar), 1)
        self.assertFalse(sichtbar[0]["can_edit"])
        self.assertFalse(sichtbar[0]["can_delete"])

        wieder = self.client.patch(
            self.pfad(annotation_id=angelegt["id"]),
            data={"revision": 1, "visibility": "private"},
            content_type="application/json",
        )
        self.assertEqual(wieder.status_code, 200)
        self.assertEqual(mitglied.get(self.pfad()).json(), [])

    def test_reihenfolge_ist_nach_id_stabil(self):
        ids = [self.erstelle(text=f"Text {nummer}").json()["id"] for nummer in range(3)]
        liste = self.client.get(self.pfad()).json()
        self.assertEqual([eintrag["id"] for eintrag in liste], ids)

    def test_mitgliedschaftsentzug_und_wiedereintritt(self):
        angelegt = self.erstelle().json()
        Membership.objects.filter(band=self.band, user=self.benutzer).delete()
        self.assertEqual(self.client.get(self.pfad()).status_code, 404)
        self.assertEqual(
            self.client.get(self.pfad(annotation_id=angelegt["id"])).status_code, 404
        )
        Membership.objects.create(
            band=self.band, user=self.benutzer, role=Membership.ROLE_OWNER
        )
        self.assertEqual(
            self.client.get(self.pfad(annotation_id=angelegt["id"])).json()["author_id"],
            self.benutzer.id,
        )

    def test_anonyme_und_csrf_freie_zugriffe(self):
        anonym = Client()
        self.assertEqual(anonym.get(self.pfad()).status_code, 401)
        streng = Client(enforce_csrf_checks=True)
        streng.login(username="owner", password="geheim-1234")
        self.assertEqual(
            streng.post(
                self.pfad(),
                data=json.dumps(anlage()),
                content_type="application/json",
            ).status_code,
            403,
        )

    def test_keine_texte_in_logs_banddetail_oder_admin(self):
        text = "Geheimer Buehnentext"
        with self.assertLogs(level="INFO") as protokoll:
            angelegt = self.erstelle(text=text).json()
            self.client.get(self.pfad())
            self.client.patch(
                self.pfad(annotation_id=angelegt["id"]),
                data={"revision": 0, "text": "Anderer geheimer Text"},
                content_type="application/json",
            )
            self.erstelle(kind="marker", text="", font_size=None)
            self.erstelle(kind="marker", text="", font_size=0.0225)
            self.client.delete(
                f"{self.pfad(annotation_id=angelegt['id'])}?revision=1"
            )
        protokoll_text = "\n".join(protokoll.output)
        self.assertNotIn(text, protokoll_text)
        self.assertNotIn("Anderer geheimer Text", protokoll_text)
        banddetail = self.client.get(f"/api/bands/{self.band.id}/")
        self.assertNotIn(text, banddetail.content.decode("utf-8"))
        self.assertNotIn(Annotation, admin.site._registry)

    def test_fremde_band_und_falsche_version_sind_404(self):
        angelegt = self.erstelle().json()
        self.assertEqual(
            self.client.get(
                self.pfad(band=self.fremdband, song=self.fremdsong)
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.get(
                self.pfad(version=self.zweite_version, annotation_id=angelegt["id"])
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.get(self.pfad(annotation_id=999999)).status_code, 404
        )
