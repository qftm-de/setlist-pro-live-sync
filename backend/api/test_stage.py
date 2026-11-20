"""R15: Snapshot, Leitung, Folgen, Steuerbefehle und Ende."""

from __future__ import annotations

import json
import uuid

from django.test import Client, TestCase

from setlists.content import ersetze_inhalt
from setlists.models import Setlist
from stage.dienste import (
    Konflikt,
    NichtErlaubt,
    NichtGefunden,
    aktive_sitzung,
    kehre_zurueck,
    sitzung_daten,
    steuere,
)
from stage.models import StageConnection, StageSession

from .test_stage_basis import StageBasis


class StageTest(StageBasis, TestCase):
    def test_start_snapshot_und_zweiter_start(self):
        antwort = self.starte()
        self.assertEqual(antwort.status_code, 201, antwort.content)
        daten = antwort.json()
        self.assertEqual(daten["state"], "active")
        self.assertEqual(daten["generation"], 1)
        self.assertEqual(
            [abschnitt["name"] for abschnitt in daten["sections"]],
            ["Set", "Zugabe"],
        )
        eintraege = daten["sections"][0]["entries"]
        self.assertEqual([eintrag["entry_type"] for eintrag in eintraege], ["song", "pause", "song", "song"])
        self.assertEqual(eintraege[0]["song"]["title"], "Song A")
        self.assertEqual(eintraege[0]["document"]["version_id"], self.version.id)
        self.assertIsNone(eintraege[2]["document"])
        self.assertEqual(daten["current"]["entry_uuid"], eintraege[0]["uuid"])
        self.assertEqual(daten["current"]["page"], 1)

        zweiter = self.starte(self.mitglied_client)
        self.assertEqual(zweiter.status_code, 409)
        self.assertEqual(StageSession.objects.filter(band=self.band).count(), 1)

    def test_anonym_fremdband_und_fremde_sitzung(self):
        self.starte()
        session_id = self._sitzung().id
        anonym = Client()
        self.assertEqual(anonym.get(self.pfad()).status_code, 401)
        self.assertEqual(
            self.fremd_client.get(self.pfad()).status_code, 404
        )
        self.assertEqual(
            self.mitglied_client.get(
                f"/api/bands/{self.band.id}/stage-sessions/99999/"
            ).status_code,
            404,
        )
        self.assertEqual(
            self.mitglied_client.get(self.pfad(session_id)).status_code, 200
        )

    def test_befehl_aus_fremder_band_ist_nicht_gefunden(self):
        """Eine Verbindung von Band A darf keine Sitzung von Band B steuern."""
        from bands.models import Membership

        Membership.objects.create(
            band=self.fremdband, user=self.mitglied, role=Membership.ROLE_MEMBER
        )
        fremd_session = StageSession.objects.create(
            band=self.fremdband, created_by=self.fremd
        )
        verbindung = self._verbindung(self.mitglied_client, self.mitglied)

        with self.assertRaises(NichtGefunden):
            steuere(
                band_id=self.band.id,
                session_id=fremd_session.id,
                konto_id=self.mitglied.id,
                verbindung_id=verbindung.id,
                generation=1,
                number=1,
                command_id=uuid.uuid4(),
                command={"kind": "goto", "entry_uuid": str(uuid.uuid4())},
            )

        fremd_session.refresh_from_db()
        self.assertEqual(fremd_session.revision, 0)
        self.assertIsNone(fremd_session.current_entry_uuid)

    def test_snapshot_ueberlebt_setlist_aenderung_und_loeschung(self):
        self.starte()
        session = self._sitzung()
        vorher = self.mitglied_client.get(self.pfad(session.id)).json()
        ersetze_inhalt(
            self.setlist,
            [{"name": "Neu", "kind": "set", "entries": []}],
            self.setlist.revision,
        )
        self.setlist.refresh_from_db()
        self.setlist.delete()
        nachher = self.mitglied_client.get(self.pfad(session.id)).json()
        self.assertEqual(nachher["sections"][0]["name"], vorher["sections"][0]["name"])
        self.assertEqual(len(nachher["sections"][0]["entries"]), 4)

    def test_uebergabe_und_alte_leitung(self):
        self.starte()
        session = self._sitzung()
        leitung_verbindung = StageConnection.objects.get(
            id=session.leader_connection
        )
        mitglied_verbindung = self._verbindung(self.mitglied_client, self.mitglied)
        uebergabe = self.leitung_client.post(
            self.pfad(session.id, "handover/"),
            data=json.dumps(
                {
                    "connection_id": str(leitung_verbindung.id),
                    "target_user_id": self.mitglied.id,
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(uebergabe.status_code, 200)
        self.assertEqual(uebergabe.json()["generation"], 2)
        self.assertEqual(uebergabe.json()["leader_user_id"], self.mitglied.id)

        ziel = session.entries.filter(entry_type="song").order_by("position").first()
        ergebnis = steuere(
            band_id=self.band.id,
            session_id=session.id,
            konto_id=self.mitglied.id,
            verbindung_id=mitglied_verbindung.id,
            generation=2,
            number=1,
            command_id=uuid.uuid4(),
            command={"kind": "goto", "entry_uuid": str(ziel.uuid), "page": 2},
        )
        self.assertEqual(ergebnis["status"], "confirmed")
        alt = steuere(
            band_id=self.band.id,
            session_id=session.id,
            konto_id=self.leitung.id,
            verbindung_id=leitung_verbindung.id,
            generation=1,
            number=1,
            command_id=uuid.uuid4(),
            command={"kind": "goto", "entry_uuid": str(ziel.uuid), "page": 2},
        )
        self.assertEqual(alt["status"], "rejected")

    def test_neue_leitung_kehrt_nach_uebergabe_zurueck(self):
        """Nach einer Übergabe darf die neue Leitung zurückkehren (R15)."""
        self.starte()
        session = self._sitzung()
        leitung_verbindung = StageConnection.objects.get(
            id=session.leader_connection
        )
        mitglied_verbindung = self._verbindung(self.mitglied_client, self.mitglied)
        self.assertEqual(
            self.leitung_client.post(
                self.pfad(session.id, "handover/"),
                data=json.dumps(
                    {
                        "connection_id": str(leitung_verbindung.id),
                        "target_user_id": self.mitglied.id,
                    }
                ),
                content_type="application/json",
            ).status_code,
            200,
        )
        StageConnection.objects.filter(pk=mitglied_verbindung.pk).update(
            closed_at="2026-01-01T00:00:00Z"
        )
        neue = self._verbindung(self.mitglied_client, self.mitglied)
        antwort = self.mitglied_client.post(
            self.pfad(session.id, "resume/"),
            data=json.dumps({"connection_id": str(neue.id)}),
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 200)
        self.assertEqual(antwort.json()["leader_user_id"], self.mitglied.id)

    def test_owner_uebernahme_und_rueckkehr(self):
        self.starte()
        session = self._sitzung()
        mitglied_verbindung = self._verbindung(self.mitglied_client, self.mitglied)
        owner_verbindung = self._verbindung(self.owner_client, self.owner)
        uebernahme = self.owner_client.post(
            self.pfad(session.id, "takeover/"),
            data=json.dumps({"connection_id": str(owner_verbindung.id)}),
            content_type="application/json",
        )
        self.assertEqual(uebernahme.status_code, 200)
        self.assertEqual(uebernahme.json()["leader_user_id"], self.owner.id)

        session.refresh_from_db()
        leitung_neu = self._verbindung(self.leitung_client, self.leitung)
        rueckkehr = self.leitung_client.post(
            self.pfad(session.id, "resume/"),
            data=json.dumps({"connection_id": str(leitung_neu.id)}),
            content_type="application/json",
        )
        self.assertEqual(rueckkehr.status_code, 403)
        with self.assertRaises(NichtErlaubt):
            kehre_zurueck(
                session,
                self.leitung,
                leitung_neu.id,
                self.leitung_client.session.session_key,
            )
        self.assertIsNotNone(mitglied_verbindung)

    def test_rueckkehr_nach_verbindungsverlust(self):
        self.starte()
        session = self._sitzung()
        alte = StageConnection.objects.get(id=session.leader_connection)
        StageConnection.objects.filter(pk=alte.pk).update(closed_at="2026-01-01T00:00:00Z")
        neue = self._verbindung(self.leitung_client, self.leitung)
        antwort = self.leitung_client.post(
            self.pfad(session.id, "resume/"),
            data=json.dumps({"connection_id": str(neue.id)}),
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 200)
        self.assertEqual(antwort.json()["generation"], 2)

    def test_steuerbefehle_nummern_idempotenz_und_grenzen(self):
        self.starte()
        session = self._sitzung()
        verbindung = StageConnection.objects.get(id=session.leader_connection)
        songs = list(session.entries.filter(entry_type="song").order_by("position"))
        pause = session.entries.get(entry_type="pause")
        kennung = uuid.uuid4()

        erst = steuere(
            band_id=self.band.id,
            session_id=session.id,
            konto_id=self.leitung.id,
            verbindung_id=verbindung.id,
            generation=1,
            number=1,
            command_id=kennung,
            command={"kind": "goto", "entry_uuid": str(songs[0].uuid), "page": 2},
        )
        self.assertEqual(erst["status"], "confirmed")
        wieder = steuere(
            band_id=self.band.id,
            session_id=session.id,
            konto_id=self.leitung.id,
            verbindung_id=verbindung.id,
            generation=1,
            number=1,
            command_id=kennung,
            command={"kind": "goto", "entry_uuid": str(songs[0].uuid), "page": 2},
        )
        self.assertEqual(wieder["revision"], erst["revision"])
        self.assertEqual(
            StageSession.objects.get(pk=session.pk).revision, erst["revision"]
        )

        anders = steuere(
            band_id=self.band.id,
            session_id=session.id,
            konto_id=self.leitung.id,
            verbindung_id=verbindung.id,
            generation=1,
            number=1,
            command_id=uuid.uuid4(),
            command={"kind": "goto", "entry_uuid": str(songs[1].uuid), "page": 1},
        )
        self.assertEqual(anders["status"], "rejected")
        self.assertEqual(StageSession.objects.get(pk=session.pk).revision, erst["revision"])

        sprung = steuere(
            band_id=self.band.id,
            session_id=session.id,
            konto_id=self.leitung.id,
            verbindung_id=verbindung.id,
            generation=1,
            number=3,
            command_id=uuid.uuid4(),
            command={"kind": "goto", "entry_uuid": str(songs[1].uuid), "page": 1},
        )
        self.assertEqual(sprung["status"], "rejected")
        naechster = steuere(
            band_id=self.band.id,
            session_id=session.id,
            konto_id=self.leitung.id,
            verbindung_id=verbindung.id,
            generation=1,
            number=2,
            command_id=uuid.uuid4(),
            command={"kind": "goto", "entry_uuid": str(songs[1].uuid), "page": None},
        )
        self.assertEqual(naechster["status"], "confirmed")

        pause_ziel = steuere(
            band_id=self.band.id,
            session_id=session.id,
            konto_id=self.leitung.id,
            verbindung_id=verbindung.id,
            generation=1,
            number=3,
            command_id=uuid.uuid4(),
            command={"kind": "goto", "entry_uuid": str(pause.uuid), "page": 1},
        )
        self.assertEqual(pause_ziel["status"], "rejected")
        self.assertEqual(
            StageSession.objects.get(pk=session.pk).current_entry_uuid, songs[1].uuid
        )

        for seite in (0, 4):
            grenze = steuere(
                band_id=self.band.id,
                session_id=session.id,
                konto_id=self.leitung.id,
                verbindung_id=verbindung.id,
                generation=1,
                number=3,
                command_id=uuid.uuid4(),
                command={"kind": "goto", "entry_uuid": str(songs[0].uuid), "page": seite},
            )
            self.assertEqual(grenze["status"], "rejected")

        ohne_pdf = steuere(
            band_id=self.band.id,
            session_id=session.id,
            konto_id=self.leitung.id,
            verbindung_id=verbindung.id,
            generation=1,
            number=3,
            command_id=uuid.uuid4(),
            command={"kind": "goto", "entry_uuid": str(songs[1].uuid), "page": None},
        )
        self.assertEqual(ohne_pdf["status"], "confirmed")

    def test_nur_leitungsverbindung_steuert(self):
        self.starte()
        session = self._sitzung()
        zweiter_tab = self._verbindung(self.leitung_client, self.leitung)
        ziel = session.entries.filter(entry_type="song").order_by("position").first()
        ergebnis = steuere(
            band_id=self.band.id,
            session_id=session.id,
            konto_id=self.leitung.id,
            verbindung_id=zweiter_tab.id,
            generation=1,
            number=1,
            command_id=uuid.uuid4(),
            command={"kind": "goto", "entry_uuid": str(ziel.uuid), "page": 2},
        )
        self.assertEqual(ergebnis["status"], "rejected")

    def test_ende_durch_owner_und_neustart(self):
        self.starte()
        session = self._sitzung()
        mitglied_verbindung = self._verbindung(self.mitglied_client, self.mitglied)
        verweigert = self.mitglied_client.post(
            self.pfad(session.id, "end/"),
            data=json.dumps({"connection_id": str(mitglied_verbindung.id)}),
            content_type="application/json",
        )
        self.assertEqual(verweigert.status_code, 403)

        owner_verbindung = self._verbindung(self.owner_client, self.owner)
        ende = self.owner_client.post(
            self.pfad(session.id, "end/"),
            data=json.dumps({"connection_id": str(owner_verbindung.id)}),
            content_type="application/json",
        )
        self.assertEqual(ende.status_code, 200)
        self.assertEqual(ende.json()["state"], "ended")
        alt = steuere(
            band_id=self.band.id,
            session_id=session.id,
            konto_id=self.leitung.id,
            verbindung_id=session.leader_connection,
            generation=session.generation,
            number=2,
            command_id=uuid.uuid4(),
            command={"kind": "goto", "entry_uuid": str(session.current_entry_uuid), "page": 1},
        )
        self.assertEqual(alt["status"], "rejected")

        zweiter = self.starte(self.mitglied_client, user=self.mitglied)
        self.assertEqual(zweiter.status_code, 201)
        self.assertNotEqual(zweiter.json()["id"], session.id)

    def test_setlist_ohne_song_startet_nicht(self):
        leer = Setlist.objects.create(band=self.band, name="Leer")
        antwort = self.starte(setlist=leer)
        self.assertEqual(antwort.status_code, 409)
        self.assertIsNone(aktive_sitzung(self.band))

    def test_verbindung_muss_zur_django_sitzung_passen(self):
        fremde = self._verbindung(self.mitglied_client, self.leitung)
        antwort = self.starte(verbindung=fremde)
        self.assertEqual(antwort.status_code, 409)
        self.assertIsNone(aktive_sitzung(self.band))

    def test_csrf_pflicht_bei_lifecycle(self):
        self.starte()
        session = self._sitzung()
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.owner)
        verbindung = StageConnection.objects.create(
            band=self.band,
            user=self.owner,
            session_key=client.session.session_key,
        )
        ohne_token = client.post(
            self.pfad(session.id, "end/"),
            data=json.dumps({"connection_id": str(verbindung.id)}),
            content_type="application/json",
        )
        self.assertEqual(ohne_token.status_code, 403)
        self.assertEqual(StageSession.objects.get(pk=session.pk).state, "active")

    def test_sitzung_daten_rechte(self):
        self.starte()
        session = self._sitzung()
        leitung_verbindung = session.leader_connection
        daten_leitung = sitzung_daten(session, self.leitung, leitung_verbindung)
        self.assertTrue(daten_leitung["actions"]["can_control"])
        daten_mitglied = sitzung_daten(session, self.mitglied)
        self.assertFalse(daten_mitglied["actions"]["can_control"])
        self.assertFalse(daten_mitglied["actions"]["can_handover"])
        self.assertFalse(daten_mitglied["actions"]["can_end"])
        self.assertTrue(daten_mitglied["actions"]["can_takeover"] is False)
