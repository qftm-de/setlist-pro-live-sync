"""R14: gemeinsame Anmerkungstexte, Sichtbarkeit und Generationen."""

from __future__ import annotations

import base64
import json

from annotations.models import Annotation
from annotations.testhelfer import AnnotationTestBasis
from collaboration.models import TextState
from realtime.models import OutboxEvent

from .mitarbeit_basis import b64, yjs_update


class AnnotationMitarbeitTest(AnnotationTestBasis):
    def text_pfad(self, annotation_id: int) -> str:
        return f"{self.pfad(annotation_id=annotation_id)}text/"

    def text_stand(self, annotation_id: int, client=None) -> dict:
        return (client or self.client).get(self.text_pfad(annotation_id)).json()

    def test_mitglied_bearbeitet_bandweiten_text(self):
        angelegt = self.erstelle(visibility="band").json()
        mitglied = self.mitglied_client()
        stand = self.text_stand(angelegt["id"], mitglied)
        basis = base64.b64decode(stand["state"])
        antwort = mitglied.post(
            self.text_pfad(angelegt["id"]),
            data=json.dumps(
                {
                    "epoch": stand["epoch"],
                    "generation": stand["generation"],
                    "update": b64(yjs_update(basis, " gemeinsam")),
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 200)
        self.assertEqual(antwort.json()["text"], "Leiser spielen gemeinsam")
        aktuell = Annotation.objects.get(pk=angelegt["id"])
        self.assertEqual(aktuell.author_id, self.benutzer.id)
        self.assertEqual(aktuell.text, "Leiser spielen gemeinsam")

        # Der Textupdate erhöht die REST-Revision. Ein PATCH mit der beim
        # Öffnen eingefrorenen Revision wird abgewiesen, mit der neuen geht er.
        veraltet = mitglied.patch(
            self.pfad(annotation_id=angelegt["id"]),
            data=json.dumps({"revision": 0, "color": "blau"}),
            content_type="application/json",
        )
        self.assertEqual(veraltet.status_code, 409)

        farbe = mitglied.patch(
            self.pfad(annotation_id=angelegt["id"]),
            data=json.dumps({"revision": aktuell.revision, "color": "blau"}),
            content_type="application/json",
        )
        self.assertEqual(farbe.status_code, 200)
        self.assertEqual(farbe.json()["color"], "blau")

    def test_text_lesen_legt_keine_zeile_an(self):
        angelegt = self.erstelle(visibility="band").json()
        TextState.objects.filter(
            object_type="annotation", object_uuid=angelegt["uuid"], field="text"
        ).delete()
        vorher = TextState.objects.count()
        stand = self.text_stand(angelegt["id"])
        self.assertEqual(TextState.objects.count(), vorher)
        antwort = self.client.post(
            self.text_pfad(angelegt["id"]),
            data=json.dumps(
                {
                    "epoch": stand["epoch"],
                    "generation": stand["generation"],
                    "update": b64(
                        yjs_update(base64.b64decode(stand["state"]), "!")
                    ),
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 200)
        self.assertEqual(antwort.json()["text"], "Leiser spielen!")
        self.assertTrue(
            TextState.objects.filter(
                object_type="annotation", object_uuid=angelegt["uuid"], field="text"
            ).exists()
        )

    def test_privatisierung_erhoeht_generation(self):
        angelegt = self.erstelle(visibility="band").json()
        mitglied = self.mitglied_client()
        stand = self.text_stand(angelegt["id"], mitglied)
        basis = base64.b64decode(stand["state"])
        privat = self.client.patch(
            self.pfad(annotation_id=angelegt["id"]),
            data={"revision": 0, "visibility": "private"},
            content_type="application/json",
        )
        self.assertEqual(privat.status_code, 200)
        aktuell = Annotation.objects.get(pk=angelegt["id"])
        self.assertGreater(aktuell.permission_generation, 0)
        self.assertEqual(mitglied.get(self.pfad()).json(), [])

        veraltet = mitglied.post(
            self.text_pfad(angelegt["id"]),
            data=json.dumps(
                {
                    "epoch": stand["epoch"],
                    "generation": stand["generation"],
                    "update": b64(yjs_update(basis, " spaet")),
                }
            ),
            content_type="application/json",
        )
        self.assertIn(veraltet.status_code, (403, 404, 409))

    def test_privater_text_bleibt_beim_autor(self):
        angelegt = self.erstelle().json()
        mitglied = self.mitglied_client()
        self.assertEqual(
            mitglied.get(self.text_pfad(angelegt["id"])).status_code, 404
        )
        stand = self.text_stand(angelegt["id"])
        basis = base64.b64decode(stand["state"])
        antwort = self.client.post(
            self.text_pfad(angelegt["id"]),
            data=json.dumps(
                {
                    "epoch": stand["epoch"],
                    "generation": stand["generation"],
                    "update": b64(yjs_update(basis, " autor")),
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 200)
        self.assertFalse(
            OutboxEvent.objects.filter(
                event_type="annotation.text", stream__kind="band"
            ).exists()
        )
        self.assertTrue(
            OutboxEvent.objects.filter(
                event_type="annotation.text", stream__kind="personal"
            ).exists()
        )

    def test_leerer_text_wird_ohne_teiländerung_abgewiesen(self):
        angelegt = self.erstelle(visibility="band").json()
        stand = self.text_stand(angelegt["id"])
        basis = base64.b64decode(stand["state"])
        zustand = TextState.objects.get(
            object_type="annotation", object_uuid=angelegt["uuid"], field="text"
        )
        vorher = (bytes(zustand.state), zustand.revision, zustand.epoch)
        ereignisse = OutboxEvent.objects.count()
        leer = self.client.post(
            self.text_pfad(angelegt["id"]),
            data=json.dumps(
                {
                    "epoch": stand["epoch"],
                    "generation": stand["generation"],
                    "update": b64(yjs_update(basis, "-")),
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(leer.status_code, 400)
        self.assertEqual(Annotation.objects.get(pk=angelegt["id"]).text, "Leiser spielen")
        zustand.refresh_from_db()
        self.assertEqual(bytes(zustand.state), vorher[0])
        self.assertEqual(zustand.revision, vorher[1])
        self.assertEqual(zustand.epoch, vorher[2])
        self.assertEqual(OutboxEvent.objects.count(), ereignisse)

    def test_marker_nimmt_keinen_text_an(self):
        angelegt = self.erstelle(kind="marker", text="", font_size=None).json()
        self.assertEqual(angelegt["kind"], "marker")
        stand = self.text_stand(angelegt["id"])
        antwort = self.client.post(
            self.text_pfad(angelegt["id"]),
            data=json.dumps(
                {
                    "epoch": stand["epoch"],
                    "generation": stand["generation"],
                    "update": b64(yjs_update(base64.b64decode(stand["state"]), "x")),
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 400)
        self.assertEqual(Annotation.objects.get(pk=angelegt["id"]).text, "")
