"""R14: Yjs-Textstände, Feldgrenzen und Epochen im Textpfad."""

from __future__ import annotations

import base64
import json

from collaboration.models import TextState
from realtime.models import OutboxEvent
from setlists.models import Section, Setlist

from .mitarbeit_basis import MitarbeitBasis, b64, yjs_update


class SetlistTextTest(MitarbeitBasis):

    def test_textelesen_schreibt_nicht_und_update_legt_zeile_an(self):
        self.put([{"name": "A", "kind": "set"}], 0)
        vorher = TextState.objects.count()
        antwort = self.client.get(f"{self.basis}texts/")
        self.assertEqual(antwort.status_code, 200)
        self.assertEqual(TextState.objects.count(), vorher)
        stand = next(
            eintrag
            for eintrag in antwort.json()["texts"]
            if eintrag["object_type"] == "setlist"
        )
        update = yjs_update(base64.b64decode(stand["state"]), "!")
        geschrieben = self.client.post(
            f"{self.basis}text/",
            data=json.dumps(
                {
                    "object_type": "setlist",
                    "object_uuid": stand["object_uuid"],
                    "field": "name",
                    "epoch": stand["epoch"],
                    "update": b64(update),
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(geschrieben.status_code, 200)
        self.assertEqual(geschrieben.json()["text"], "Set!")
        self.assertTrue(
            TextState.objects.filter(
                object_type="setlist", object_uuid=stand["object_uuid"], field="name"
            ).exists()
        )

    def test_text_update_merge_epoche_und_grenzen(self):
        self.put([{"name": "A", "kind": "set"}], 0)
        text = self.zweiter_client.get(f"{self.basis}texts/")
        self.assertEqual(text.status_code, 200)
        stand = text.json()["texts"][0]
        self.assertEqual(stand["object_type"], "setlist")

        basis = base64.b64decode(stand["state"])
        update = yjs_update(basis, " Neu")
        antwort = self.zweiter_client.post(
            f"{self.basis}text/",
            data=json.dumps(
                {
                    "object_type": "setlist",
                    "object_uuid": stand["object_uuid"],
                    "field": "name",
                    "epoch": stand["epoch"],
                    "update": b64(update),
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 200)
        self.assertEqual(antwort.json()["text"], "Set Neu")

        # Dasselbe Update ist idempotent, keine zweite Änderung.
        wieder = self.zweiter_client.post(
            f"{self.basis}text/",
            data=json.dumps(
                {
                    "object_type": "setlist",
                    "object_uuid": stand["object_uuid"],
                    "field": "name",
                    "epoch": stand["epoch"],
                    "update": b64(update),
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(wieder.status_code, 200)
        self.assertEqual(wieder.json()["text"], "Set Neu")

        beschaedigt = self.zweiter_client.post(
            f"{self.basis}text/",
            data=json.dumps(
                {
                    "object_type": "setlist",
                    "object_uuid": stand["object_uuid"],
                    "field": "name",
                    "epoch": antwort.json()["epoch"],
                    "update": b64(b"kein-crdt"),
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(beschaedigt.status_code, 400)

    def test_text_rest_ersetzung_erhoeht_epoche(self):
        self.put([{"name": "A", "kind": "set"}], 0)
        stand = self.client.get(f"{self.basis}texts/").json()["texts"][0]
        basis = base64.b64decode(stand["state"])
        alt = yjs_update(basis, " Alt")
        # REST-Ersetzung des Setlist-Namens startet eine neue Epoche.
        umbenannt = self.client.patch(
            self.basis,
            data=json.dumps({"name": "Neu"}),
            content_type="application/json",
        )
        self.assertEqual(umbenannt.status_code, 200)
        antwort = self.client.post(
            f"{self.basis}text/",
            data=json.dumps(
                {
                    "object_type": "setlist",
                    "object_uuid": stand["object_uuid"],
                    "field": "name",
                    "epoch": stand["epoch"],
                    "update": b64(alt),
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 409)
        self.assertEqual(antwort.json()["current_epoch"], 1)
        self.assertEqual(Setlist.objects.get(pk=self.setlist.pk).name, "Neu")

        # Mit der genannten Epoche und dem neuen Stand gelingt der nächste
        # Update auf demselben Feld.
        neu = self.client.get(f"{self.basis}texts/").json()["texts"][0]
        wieder = self.client.post(
            f"{self.basis}text/",
            data=json.dumps(
                {
                    "object_type": "setlist",
                    "object_uuid": neu["object_uuid"],
                    "field": "name",
                    "epoch": neu["epoch"],
                    "update": b64(
                        yjs_update(base64.b64decode(neu["state"]), "!")
                    ),
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(wieder.status_code, 200)
        self.assertEqual(wieder.json()["text"], "Neu!")

    def test_randleerzeichen_umgehen_die_grenze_nicht(self):
        """Die Feldgrenze gilt für den Rohtext, nicht den getrimmten (R14-G1)."""
        self.put([{"name": "A", "kind": "set"}], 0)
        stand = next(
            eintrag
            for eintrag in self.client.get(f"{self.basis}texts/").json()["texts"]
            if eintrag["object_type"] == "section"
        )
        basis = base64.b64decode(stand["state"])
        # 119 Zeichen anhängen ergibt genau 120, ein weiteres Leerzeichen 121.
        antwort = self.client.post(
            f"{self.basis}text/",
            data=json.dumps(
                {
                    "object_type": "section",
                    "object_uuid": stand["object_uuid"],
                    "field": "name",
                    "epoch": stand["epoch"],
                    "update": b64(yjs_update(basis, "x" * 119, " ")),
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 400)

    def test_text_update_trimmt_wie_der_restweg(self):
        """Randleerzeichen im Textweg erzeugen keinen Epochenwechsel (R14)."""
        self.put([{"name": "A", "kind": "set"}], 0)
        abschnitt = Section.objects.get(setlist=self.setlist)
        stand = next(
            eintrag
            for eintrag in self.client.get(f"{self.basis}texts/").json()["texts"]
            if eintrag["object_type"] == "section"
        )
        basis = base64.b64decode(stand["state"])
        antwort = self.client.post(
            f"{self.basis}text/",
            data=json.dumps(
                {
                    "object_type": "section",
                    "object_uuid": stand["object_uuid"],
                    "field": "name",
                    "epoch": stand["epoch"],
                    "update": b64(yjs_update(basis, " ")),
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 200)
        self.assertEqual(antwort.json()["text"], "A")
        self.assertEqual(Section.objects.get(pk=abschnitt.pk).name, "A")

        # Der Gesamt-PUT mit demselben Namen darf die Epoche nicht erhöhen.
        zustand = TextState.objects.get(
            object_type="section", object_uuid=stand["object_uuid"], field="name"
        )
        epoche = zustand.epoch
        antwort = self.put(
            [{"uuid": str(abschnitt.uuid), "name": "A", "kind": "set"}], 1
        )
        self.assertEqual(antwort.status_code, 200)
        self.assertEqual(
            TextState.objects.get(
                object_type="section", object_uuid=stand["object_uuid"], field="name"
            ).epoch,
            epoche,
        )

    def test_zu_grosses_update_wird_abgewiesen(self):
        self.put([{"name": "A", "kind": "set"}], 0)
        stand = self.client.get(f"{self.basis}texts/").json()["texts"][0]
        vorher = OutboxEvent.objects.count()
        antwort = self.client.post(
            f"{self.basis}text/",
            data=json.dumps(
                {
                    "object_type": "setlist",
                    "object_uuid": stand["object_uuid"],
                    "field": "name",
                    "epoch": stand["epoch"],
                    "update": b64(b"x" * (64 * 1024 + 1)),
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 400)
        self.assertEqual(OutboxEvent.objects.count(), vorher)
