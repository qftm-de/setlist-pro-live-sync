"""Dauerhaftes Verbindungsregister der Bühne."""

from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from .fehler import Konflikt
from .models import StageConnection


def _ttl() -> int:
    return int(getattr(settings, "STAGE_CONNECTION_TTL_SECONDS", 60))


def _frisch(grenze=None):
    return timezone.now() - timedelta(seconds=_ttl())


def verbindung_aktiv(band_id: int, konto_id: int, verbindung_id, session_key=None):
    if not verbindung_id:
        return None
    filter = dict(
        id=verbindung_id,
        band_id=band_id,
        user_id=konto_id,
        closed_at__isnull=True,
        last_seen__gte=_frisch(),
    )
    if session_key is not None:
        filter["session_key"] = session_key
    return StageConnection.objects.filter(**filter).first()


def _eigene_verbindung(band_id, konto_id, verbindung_id, session_key) -> StageConnection:
    verbindung = verbindung_aktiv(band_id, konto_id, verbindung_id, session_key)
    if verbindung is None:
        raise Konflikt("Die Verbindung ist nicht mehr aktiv. Bitte neu verbinden.")
    return verbindung


def registriere_verbindung(band_id: int, konto_id: int, session_key: str) -> StageConnection:
    aufbewahrung = timedelta(
        hours=int(getattr(settings, "STAGE_CONNECTION_RETENTION_HOURS", 24))
    )
    StageConnection.objects.filter(
        band_id=band_id, last_seen__lt=timezone.now() - aufbewahrung
    ).delete()
    return StageConnection.objects.create(
        band_id=band_id, user_id=konto_id, session_key=session_key
    )


def beruehre_verbindung(verbindung_id) -> None:
    if not verbindung_id:
        return
    StageConnection.objects.filter(id=verbindung_id, closed_at__isnull=True).update(
        last_seen=timezone.now()
    )


def schliesse_verbindung(verbindung_id) -> None:
    if not verbindung_id:
        return
    StageConnection.objects.filter(id=verbindung_id, closed_at__isnull=True).update(
        closed_at=timezone.now()
    )
