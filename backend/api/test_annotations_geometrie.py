import math

from rest_framework.exceptions import ValidationError

from annotations.testhelfer import AnnotationTestBasis
from api.annotation_serializers import pruefe_geometrie
from documents.testhelfer import pdf_bytes, upload


class AnnotationGeometrieTest(AnnotationTestBasis):
    def test_rechteck_grenzen(self):
        for rechteck in (
            {"x": 0, "y": 0, "width": 1, "height": 1},
            {"x": 0.5, "y": 0.5, "width": 0.5, "height": 0.5},
            {"x": 0.1, "y": 0.2, "width": 0.3, "height": 0.4},
        ):
            with self.subTest(rechteck=rechteck):
                antwort = self.erstelle(geometry=rechteck)
                self.assertEqual(antwort.status_code, 201)

        for rechteck in (
            {"x": -0.1, "y": 0.1, "width": 0.2, "height": 0.2},
            {"x": 0.1, "y": -0.1, "width": 0.2, "height": 0.2},
            {"x": 0.1, "y": 0.1, "width": 0, "height": 0.2},
            {"x": 0.1, "y": 0.1, "width": 0.2, "height": 0},
            {"x": 0.9, "y": 0.1, "width": 0.2, "height": 0.2},
            {"x": 0.1, "y": 0.9, "width": 0.2, "height": 0.2},
            {"x": 0.1, "y": 0.1, "width": 0.2},
            {"x": "0.1", "y": 0.1, "width": 0.2, "height": 0.2},
        ):
            with self.subTest(rechteck=rechteck):
                self.assertEqual(self.erstelle(geometry=rechteck).status_code, 400)

    def test_nicht_endliche_zahlen_werden_abgelehnt(self):
        for wert in (math.nan, math.inf, -math.inf):
            with self.subTest(wert=wert):
                with self.assertRaises(ValidationError):
                    pruefe_geometrie(
                        {"x": wert, "y": 0, "width": 0.2, "height": 0.2}
                    )

    def test_seite_ist_ganzzahlig_und_im_dokument(self):
        self.assertEqual(self.erstelle(page_number=2).status_code, 201)
        for seite in (0, -1, 3, 1.5):
            with self.subTest(seite=seite):
                self.assertEqual(self.erstelle(page_number=seite).status_code, 400)

    def test_textlaenge_und_leere_texte(self):
        self.assertEqual(self.erstelle(text="x" * 2000).status_code, 201)
        self.assertEqual(self.erstelle(text="x" * 2001).status_code, 400)
        self.assertEqual(self.erstelle(text="   ").status_code, 400)
        self.assertEqual(self.erstelle(text="").status_code, 400)

    def test_marker_hat_keinen_text_und_keine_schriftgroesse(self):
        self.assertEqual(
            self.erstelle(kind="marker", text="Text", font_size=None).status_code, 400
        )
        self.assertEqual(
            self.erstelle(kind="marker", text="", font_size=0.0225).status_code, 400
        )
        self.assertEqual(
            self.erstelle(kind="marker", text="", font_size=None).status_code, 201
        )

    def test_schriftgroessen_palette_und_art(self):
        for groesse in (0.015, 0.0225, 0.03):
            with self.subTest(groesse=groesse):
                self.assertEqual(
                    self.erstelle(font_size=groesse).status_code, 201
                )
        for groesse in (0.014, 0.02, 0.031, 1):
            with self.subTest(groesse=groesse):
                self.assertEqual(self.erstelle(font_size=groesse).status_code, 400)
        self.assertEqual(self.erstelle(color="rot").status_code, 400)
        self.assertEqual(self.erstelle(kind="kreis").status_code, 400)
        self.assertEqual(self.erstelle(visibility="public").status_code, 400)

    def test_patch_ungueltig_erhaelt_alte_anmerkung(self):
        angelegt = self.erstelle().json()
        antwort = self.client.patch(
            self.pfad(annotation_id=angelegt["id"]),
            data={"revision": 0, "geometry": {"x": 0.9, "y": 0.9, "width": 0.5, "height": 0.5}},
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 400)
        from annotations.models import Annotation

        aktuell = Annotation.objects.get(id=angelegt["id"])
        self.assertEqual(aktuell.geometry, angelegt["geometry"])
        self.assertEqual(aktuell.revision, 0)

    def test_neue_version_uebernimmt_keine_anmerkungen(self):
        self.erstelle()
        neue_version = upload(
            self.client, self.band.id, self.song.id, pdf_bytes(1)
        ).json()
        self.assertEqual(
            self.client.get(self.pfad(version=neue_version)).json(), []
        )
        self.assertEqual(len(self.client.get(self.pfad()).json()), 1)
