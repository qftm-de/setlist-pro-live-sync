"""R14: Revision, UUID-Abgleich und Einzelbefehle."""

from __future__ import annotations

import json
import uuid

from collaboration.models import RemovedId
from setlists.models import Entry, Section, Setlist

from .mitarbeit_basis import MitarbeitBasis


class SetlistMitarbeitTest(MitarbeitBasis):

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
