"""Gemeinsame Vorbereitung der Bühnentests. Kein TestCase, wird nicht gesammelt."""

from __future__ import annotations

import json
import uuid

from django.contrib.auth import get_user_model
from django.test import Client

from bands.models import Band, Membership
from documents.models import Document, DocumentVersion
from library.models import Song
from setlists.content import ersetze_inhalt
from setlists.models import Setlist
from stage.models import StageConnection, StageSession

User = get_user_model()


class StageBasis:
    def setUp(self):
        self.leitung = User.objects.create_user(
            username="leitung", email="leitung@example.test", password="geheim-1234"
        )
        self.mitglied = User.objects.create_user(
            username="mitglied15", email="mitglied15@example.test", password="geheim-1234"
        )
        self.owner = User.objects.create_user(
            username="owner15", email="owner15@example.test", password="geheim-1234"
        )
        self.fremd = User.objects.create_user(
            username="fremd15", email="fremd15@example.test", password="geheim-1234"
        )
        self.band = Band.objects.create(name="Bühne", created_by=self.leitung)
        Membership.objects.create(
            band=self.band, user=self.leitung, role=Membership.ROLE_MEMBER
        )
        Membership.objects.create(
            band=self.band, user=self.mitglied, role=Membership.ROLE_MEMBER
        )
        Membership.objects.create(
            band=self.band, user=self.owner, role=Membership.ROLE_OWNER
        )
        self.fremdband = Band.objects.create(name="Fremd", created_by=self.fremd)
        Membership.objects.create(
            band=self.fremdband, user=self.fremd, role=Membership.ROLE_OWNER
        )

        self.song_a = Song.objects.create(band=self.band, title="Song A", bpm=120)
        self.song_b = Song.objects.create(band=self.band, title="Song B")
        self.dokument = Document.objects.create(song=self.song_a)
        self.version = DocumentVersion.objects.create(
            document=self.dokument,
            number=1,
            upload_id=uuid.uuid4(),
            file_key=f"stage-{uuid.uuid4().hex}",
            original_name="privat.pdf",
            byte_size=1234,
            page_count=3,
            sha256="c" * 64,
            uploaded_by=self.leitung,
        )
        self.dokument.active_version = self.version
        self.dokument.save(update_fields=["active_version"])

        self.setlist = Setlist.objects.create(band=self.band, name="Bühnenset")
        ersetze_inhalt(
            self.setlist,
            [
                {
                    "name": "Set",
                    "kind": "set",
                    "entries": [
                        {"entry_type": "song", "song": self.song_a},
                        {"entry_type": "pause", "label": "Ansage", "song": None},
                        {"entry_type": "song", "song": self.song_b},
                        {"entry_type": "song", "song": self.song_a},
                    ],
                },
                {
                    "name": "Zugabe",
                    "kind": "zugabe",
                    "entries": [
                        {"entry_type": "song", "song": self.song_b},
                    ],
                },
            ],
            0,
        )
        self.setlist.refresh_from_db()

        self.leitung_client = self._client("leitung")
        self.mitglied_client = self._client("mitglied15")
        self.owner_client = self._client("owner15")
        self.fremd_client = self._client("fremd15")

    def _client(self, name):
        client = Client()
        client.login(username=name, password="geheim-1234")
        return client

    def _verbindung(self, client, user):
        schluessel = client.session.session_key
        return StageConnection.objects.create(
            band=self.band, user=user, session_key=schluessel
        )

    def pfad(self, session_id=None, aktion=""):
        basis = f"/api/bands/{self.band.id}/stage-sessions/"
        if session_id is None:
            return basis
        return f"{basis}{session_id}/{aktion}"

    def starte(self, client=None, verbindung=None, setlist=None, user=None):
        client = client or self.leitung_client
        user = user or self.leitung
        verbindung = verbindung or self._verbindung(client, user)
        return client.post(
            self.pfad(),
            data=json.dumps(
                {
                    "setlist_id": (setlist or self.setlist).id,
                    "connection_id": str(verbindung.id),
                }
            ),
            content_type="application/json",
        )

    def _sitzung(self):
        return StageSession.objects.get(state=StageSession.ZUSTAND_AKTIV)
