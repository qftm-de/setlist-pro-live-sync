"""Gemeinsame Basis für die R14-Tests zu Mitarbeit, Befehlen und Texten."""

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



class MitarbeitBasis(TestCase):
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

