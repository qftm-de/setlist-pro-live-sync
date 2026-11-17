"""Feste Bühnensitzung mit Snapshot, Leitung und dauerhaftem Befehlsprotokoll."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q


class StageSession(models.Model):
    ZUSTAND_AKTIV = "active"
    ZUSTAND_BEENDET = "ended"
    ZUSTAND_CHOICES = [
        (ZUSTAND_AKTIV, "Aktiv"),
        (ZUSTAND_BEENDET, "Beendet"),
    ]

    band = models.ForeignKey(
        "bands.Band", on_delete=models.CASCADE, related_name="stage_sessions"
    )
    state = models.CharField(
        max_length=16, choices=ZUSTAND_CHOICES, default=ZUSTAND_AKTIV
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="+",
    )
    leader_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )
    leader_connection = models.UUIDField(null=True, blank=True)
    leadership_locked = models.BooleanField(default=False)  # ungenutzt, Bestand
    generation = models.PositiveIntegerField(default=1)
    revision = models.PositiveIntegerField(default=0)
    current_entry_uuid = models.UUIDField(null=True, blank=True)
    current_page = models.PositiveIntegerField(null=True, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["band"],
                condition=Q(state="active"),
                name="buehne_aktiv_einmal",
            )
        ]

    def __str__(self) -> str:
        return f"Bühne {self.band_id} ({self.state})"


class StageSection(models.Model):
    session = models.ForeignKey(
        StageSession, on_delete=models.CASCADE, related_name="sections"
    )
    position = models.PositiveIntegerField()
    uuid = models.UUIDField()
    name = models.CharField(max_length=120, blank=True, default="")
    kind = models.CharField(max_length=16, default="set")

    class Meta:
        ordering = ["position", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["session", "position"], name="buehnenabschnitt_position"
            ),
            models.UniqueConstraint(
                fields=["session", "uuid"], name="buehnenabschnitt_uuid"
            ),
        ]


class StageEntry(models.Model):
    session = models.ForeignKey(
        StageSession, on_delete=models.CASCADE, related_name="entries"
    )
    section = models.ForeignKey(
        StageSection, on_delete=models.CASCADE, related_name="entries"
    )
    position = models.PositiveIntegerField()
    uuid = models.UUIDField()
    entry_type = models.CharField(max_length=16, default="song")
    label = models.CharField(max_length=200, blank=True, default="")
    song_id = models.IntegerField(null=True, blank=True)
    song_title = models.CharField(max_length=200, blank=True, default="")
    artist = models.CharField(max_length=200, blank=True, default="")
    song_key = models.CharField(max_length=32, blank=True, default="")
    bpm = models.PositiveIntegerField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")
    document_version = models.ForeignKey(
        "documents.DocumentVersion",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )
    page_count = models.PositiveIntegerField(null=True, blank=True)
    byte_size = models.PositiveBigIntegerField(null=True, blank=True)
    sha256 = models.CharField(max_length=64, blank=True, default="")

    class Meta:
        ordering = ["position", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["session", "uuid"], name="buehneneintrag_uuid"
            ),
            models.UniqueConstraint(
                fields=["section", "position"], name="buehneneintrag_position"
            ),
        ]

    def __str__(self) -> str:
        return self.song_title or self.label or self.entry_type

    @property
    def ist_song(self) -> bool:
        return self.entry_type == "song"


class StageConnection(models.Model):
    """Serverseitig erzeugte Verbindungskennung, dauerhaft gemeinsam sichtbar."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    band = models.ForeignKey(
        "bands.Band", on_delete=models.CASCADE, related_name="stage_connections"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="stage_connections",
    )
    session_key = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-last_seen", "-id"]
        indexes = [
            models.Index(
                fields=["band", "user", "closed_at"], name="buehnenverbindung_idx"
            ),
            models.Index(
                fields=["band", "last_seen"], name="buehnenverbindung_alt"
            ),
        ]


class StageCommand(models.Model):
    session = models.ForeignKey(
        StageSession, on_delete=models.CASCADE, related_name="commands"
    )
    generation = models.PositiveIntegerField()
    number = models.PositiveIntegerField()
    command_id = models.UUIDField()
    signature = models.CharField(max_length=64)
    result = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(
                fields=["session", "generation", "number"],
                name="buehnenbefehl_nummer",
            ),
            models.UniqueConstraint(
                fields=["session", "command_id"], name="buehnenbefehl_kennung"
            ),
        ]
