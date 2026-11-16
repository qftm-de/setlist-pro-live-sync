"""R15: Lebenszyklus-Rennen und Aufbewahrung der Verbindungszeilen."""

from __future__ import annotations

import json
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from stage.dienste import (
    Konflikt,
    beende,
    registriere_verbindung,
    uebergebe,
)
from stage.models import StageConnection, StageSession

from .test_stage_basis import StageBasis


class StageLebenszyklusRaceTest(StageBasis, TestCase):
    """Stale Instanzen dürfen nach einer parallelen Beendigung nichts ändern."""
    def test_spaete_uebergabe_nach_ende(self):
        self.starte()
        session = self._sitzung()
        leitung_verbindung = StageConnection.objects.get(
            id=session.leader_connection
        )
        self._verbindung(self.mitglied_client, self.mitglied)
        owner_verbindung = self._verbindung(self.owner_client, self.owner)
        ende = self.owner_client.post(
            self.pfad(session.id, "end/"),
            data=json.dumps({"connection_id": str(owner_verbindung.id)}),
            content_type="application/json",
        )
        self.assertEqual(ende.status_code, 200)
        with self.assertRaises(Konflikt):
            uebergebe(
                session,
                self.leitung,
                leitung_verbindung.id,
                self.leitung_client.session.session_key,
                self.mitglied.id,
            )
        self.assertEqual(StageSession.objects.get(pk=session.pk).state, "ended")

    def test_doppeltes_ende_ist_konflikt(self):
        self.starte()
        session = self._sitzung()
        owner_verbindung = self._verbindung(self.owner_client, self.owner)
        beende(
            session,
            self.owner,
            owner_verbindung.id,
            self.owner_client.session.session_key,
        )
        with self.assertRaises(Konflikt):
            beende(
                session,
                self.owner,
                owner_verbindung.id,
                self.owner_client.session.session_key,
            )
        self.assertEqual(StageSession.objects.get(pk=session.pk).state, "ended")

    def test_alte_verbindungen_werden_bereinigt(self):
        alt = self._verbindung(self.leitung_client, self.leitung)
        StageConnection.objects.filter(pk=alt.pk).update(
            last_seen=timezone.now() - timedelta(days=2)
        )
        neu = registriere_verbindung(
            self.band.id,
            self.mitglied.id,
            self.mitglied_client.session.session_key,
        )
        self.assertFalse(StageConnection.objects.filter(pk=alt.pk).exists())
        self.assertTrue(StageConnection.objects.filter(pk=neu.pk).exists())
