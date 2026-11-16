"""R14: Revision, UUID-Abgleich, Einzelbefehle und zusammengeführte Texte."""

from __future__ import annotations

import base64
import json
import uuid

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from pycrdt import Doc, Text

from bands.models import Band, Membership
from collaboration.models import RemovedId, TextState
from library.models import Song
from realtime.models import OutboxEvent
from setlists.models import Entry, Section, Setlist

User = get_user_model()


def yjs_update(basis: bytes, *schritte: str) -> bytes:
    doc = Doc()
    if basis:
        doc.apply_update(basis)
    text = doc.get("t", type=Text)
    for schritt in schritte:
        if schritt.startswith("-"):
            text.clear()
        else:
            text += schritt
    return bytes(doc.get_update())


def b64(wert: bytes) -> str:
    return base64.b64encode(wert).decode("ascii")


class SetlistMitarbeitTest(TestCase):
    def setUp(self):
        self.benutzer = User.objects.create_user(
            username="m1", email="m1@example.test", password="geheim-1234"
        )
        self.zweiter = User.objects.create_user(
            username="m2", email="m2@example.test", password="geheim-1234"
        )
        self.band = Band.objects.create(name="Band", created_by=self.benutzer)
        Membership.objects.create(band=self.band, user=self.benutzer, role="owner")
        Membership.objects.create(band=self.band, user=self.zweiter, role="member")
        self.song = Song.objects.create(band=self.band, title="Song A")
        self.client = Client()
        self.client.login(username="m1", password="geheim-1234")
        self.zweiter_client = Client()
        self.zweiter_client.login(username="m2", password="geheim-1234")
        self.setlist = Setlist.objects.create(band=self.band, name="Set")
        self.basis = f"/api/bands/{self.band.id}/setlists/{self.setlist.id}/"

    def put(self, sections, revision):
        return self.client.put(
            f"{self.basis}content/",
            data=json.dumps({"revision": revision, "sections": sections}),
            content_type="application/json",
        )

    def befehl(self, kind, payload, command_id=None, client=None):
        return (client or self.client).post(
            f"{self.basis}commands/",
            data=json.dumps(
                {
                    "command_id": str(command_id or uuid.uuid4()),
                    "kind": kind,
                    "payload": payload,
                }
            ),
            content_type="application/json",
        )

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

    def test_put_braucht_revision_und_schuetzt_uuid(self):
        self.assertEqual(self.put([{"name": "A", "kind": "set"}], None).status_code, 400)
        erste = self.put([{"name": "A", "kind": "set"}], 0)
        self.assertEqual(erste.status_code, 200)
        abschnitt = erste.json()["sections"][0]
        self.assertEqual(erste.json()["revision"], 1)

        veraltet = self.put([{"name": "B", "kind": "set"}], 0)
        self.assertEqual(veraltet.status_code, 409)

        zweite = self.put(
            [{"uuid": abschnitt["uuid"], "name": "B", "kind": "set"}],
            erste.json()["revision"],
        )
        self.assertEqual(zweite.status_code, 200)
        self.assertEqual(zweite.json()["sections"][0]["uuid"], abschnitt["uuid"])
        self.assertEqual(zweite.json()["sections"][0]["name"], "B")
        self.assertEqual(Setlist.objects.get(pk=self.setlist.pk).revision, 2)

    def test_unbekannte_und_geloeschte_uuids_werden_abgewiesen(self):
        erste = self.put(
            [{"name": "A", "kind": "set"}, {"name": "B", "kind": "set"}], 0
        ).json()
        kennung = erste["sections"][0]["uuid"]
        bleibt = erste["sections"][1]["uuid"]
        fremd = self.put(
            [{"uuid": str(uuid.uuid4()), "name": "X", "kind": "set"}], 1
        )
        self.assertEqual(fremd.status_code, 409)

        geloescht = self.put(
            [{"uuid": bleibt, "name": "B", "kind": "set"}], 1
        )
        self.assertEqual(geloescht.status_code, 200)
        wieder = self.put(
            [
                {"uuid": bleibt, "name": "B", "kind": "set"},
                {"uuid": kennung, "name": "Wieder", "kind": "set"},
            ],
            2,
        )
        self.assertEqual(wieder.status_code, 409)
        self.assertTrue(RemovedId.objects.filter(object_uuid=kennung).exists())

    def test_befehl_idempotent_und_konflikt(self):
        kennung = uuid.uuid4().hex
        abschnitt = str(uuid.uuid4())
        anlegen = {
            "uuid": abschnitt,
            "name": "Neu",
            "kind": "set",
        }
        erste = self.befehl("section.create", anlegen, kennung)
        self.assertEqual(erste.status_code, 200)
        wieder = self.befehl("section.create", anlegen, kennung)
        self.assertEqual(wieder.status_code, 200)
        self.assertEqual(erste.json(), wieder.json())
        self.assertEqual(Section.objects.filter(setlist=self.setlist).count(), 1)

        anders = self.befehl("section.create", {**anlegen, "name": "Anders"}, kennung)
        self.assertEqual(anders.status_code, 409)
        self.assertEqual(Setlist.objects.get(pk=self.setlist.pk).revision, 1)

    def test_loeschen_sperrt_spaetere_bearbeitung(self):
        abschnitt = str(uuid.uuid4())
        self.assertEqual(
            self.befehl("section.create", {"uuid": abschnitt, "name": "A", "kind": "set"}).status_code,
            200,
        )
        self.assertEqual(
            self.befehl("section.delete", {"uuid": abschnitt}).status_code, 200
        )
        nachher = self.befehl("section.update", {"uuid": abschnitt, "name": "B"})
        self.assertIn(nachher.status_code, (400, 409))
        self.assertFalse(Section.objects.filter(uuid=abschnitt).exists())

    def test_verschieben_mit_nachbar_und_fehlendem_nachbar(self):
        a = str(uuid.uuid4())
        b = str(uuid.uuid4())
        self.befehl("section.create", {"uuid": a, "name": "A", "kind": "set"})
        self.befehl("section.create", {"uuid": b, "name": "B", "kind": "set"})
        verschoben = self.befehl(
            "section.move", {"uuid": b, "after_section_uuid": None}
        )
        self.assertEqual(verschoben.status_code, 200)
        self.assertEqual(
            [abschnitt["uuid"] for abschnitt in verschoben.json()["sections"]],
            [b, a],
        )
        fehlt = self.befehl(
            "section.move", {"uuid": a, "after_section_uuid": str(uuid.uuid4())}
        )
        self.assertEqual(fehlt.status_code, 409)

    def test_eintrag_verschieben_haelt_positionen_eindeutig(self):
        a = str(uuid.uuid4())
        b = str(uuid.uuid4())
        e1 = str(uuid.uuid4())
        e2 = str(uuid.uuid4())
        self.befehl("section.create", {"uuid": a, "name": "A", "kind": "set"})
        self.befehl("section.create", {"uuid": b, "name": "B", "kind": "set"})
        for eintrag, abschnitt in ((e1, a), (e2, a)):
            self.assertEqual(
                self.befehl(
                    "entry.create",
                    {
                        "uuid": eintrag,
                        "section_uuid": abschnitt,
                        "entry_type": "song",
                        "song_id": self.song.id,
                    },
                ).status_code,
                200,
            )
        verschoben = self.befehl(
            "entry.move", {"uuid": e1, "section_uuid": b, "after_entry_uuid": None}
        )
        self.assertEqual(verschoben.status_code, 200)
        ziel = next(
            abschnitt for abschnitt in verschoben.json()["sections"] if abschnitt["uuid"] == b
        )
        self.assertEqual([eintrag["uuid"] for eintrag in ziel["entries"]], [e1])
        self.assertEqual(
            [eintrag["position"] for eintrag in ziel["entries"]], [1]
        )

        # Innerhalb desselben Abschnitts an den Anfang und in die Mitte.
        e3 = str(uuid.uuid4())
        e4 = str(uuid.uuid4())
        for eintrag in (e3, e4):
            self.assertEqual(
                self.befehl(
                    "entry.create",
                    {
                        "uuid": eintrag,
                        "section_uuid": a,
                        "entry_type": "song",
                        "song_id": self.song.id,
                    },
                ).status_code,
                200,
            )
        anfang = self.befehl(
            "entry.move",
            {"uuid": e4, "section_uuid": a, "after_entry_uuid": None},
        )
        self.assertEqual(anfang.status_code, 200)
        mitte = self.befehl(
            "entry.move",
            {"uuid": e4, "section_uuid": a, "after_entry_uuid": e2},
        )
        self.assertEqual(mitte.status_code, 200)
        bereich = next(
            abschnitt
            for abschnitt in mitte.json()["sections"]
            if abschnitt["uuid"] == a
        )
        self.assertEqual(
            [eintrag["uuid"] for eintrag in bereich["entries"]],
            [e2, e4, e3],
        )
        self.assertEqual(
            [eintrag["position"] for eintrag in bereich["entries"]],
            [1, 2, 3],
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

    def test_befehl_trimmt_abschnittsnamen(self):
        """Der Befehlspfad trimmt wie der REST-Weg (R14)."""
        self.put([{"name": "A", "kind": "set"}], 0)
        abschnitt = Section.objects.get(setlist=self.setlist)
        antwort = self.befehl(
            "section.update", {"uuid": str(abschnitt.uuid), "name": "  Neu  "}
        )
        self.assertEqual(antwort.status_code, 200)
        self.assertEqual(Section.objects.get(pk=abschnitt.pk).name, "Neu")

    def test_befehl_mit_ungueltiger_dauer_wird_abgewiesen(self):
        """Dauer wird im Befehlspfad wie im REST-Weg geprüft (R14)."""
        self.put([{"name": "A", "kind": "set"}], 0)
        abschnitt = Section.objects.get(setlist=self.setlist)
        eintrag = str(uuid.uuid4())
        antwort = self.befehl(
            "entry.create",
            {
                "uuid": eintrag,
                "section_uuid": str(abschnitt.uuid),
                "entry_type": "pause",
                "duration_seconds": "abc",
            },
        )
        self.assertEqual(antwort.status_code, 400)
        self.assertFalse(Entry.objects.filter(uuid=eintrag).exists())

        antwort = self.befehl(
            "entry.create",
            {
                "uuid": str(uuid.uuid4()),
                "section_uuid": str(abschnitt.uuid),
                "entry_type": "pause",
                "duration_seconds": 999_999,
            },
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
