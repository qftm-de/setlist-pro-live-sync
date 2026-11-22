"""Erzeugen, Widerrufen und Prüfen von 48-Stunden-Einladungslinks."""

from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from realtime.services import band_ereignis

from .dienste import band_owner_sperren
from .models import Band, BandInvitation

STANDARD_GUELTIGKEIT = timedelta(hours=48)
MAX_NOTIZ = 120
MIN_NUTZUNGEN = 1
MAX_NUTZUNGEN = 100


class EinladungUngueltig(Exception):
    """Token unbekannt, abgelaufen, widerrufen oder ausgeschöpft."""


class EinladungUngueltigeEingabe(Exception):
    """Hinweis oder Nutzungslimit außerhalb der Grenzen."""

    def __init__(self, felder: dict[str, str] | None = None):
        super().__init__("Eingaben prüfen.")
        self.felder = felder or {"detail": "Eingaben prüfen."}


def token_hash(rohtoken: str) -> str:
    return hashlib.sha256(rohtoken.encode("utf-8")).hexdigest()


def _pruefe_max_uses(max_uses) -> None:
    if max_uses is None:
        return
    if isinstance(max_uses, bool) or not isinstance(max_uses, int):
        raise EinladungUngueltigeEingabe(
            {"max_uses": "Erlaubt sind 1 bis 100 oder null."}
        )
    if not MIN_NUTZUNGEN <= max_uses <= MAX_NUTZUNGEN:
        raise EinladungUngueltigeEingabe(
            {"max_uses": "Erlaubt sind 1 bis 100 oder null."}
        )


@transaction.atomic
def erstelle_einladung(
    band: Band, ersteller, note: str = "", max_uses: int | None = None
) -> tuple[BandInvitation, str]:
    note = (note or "").strip()
    if len(note) > MAX_NOTIZ:
        raise EinladungUngueltigeEingabe({"note": "Höchstens 120 Zeichen."})
    _pruefe_max_uses(max_uses)
    band_owner_sperren(band, ersteller)
    rohtoken = secrets.token_urlsafe(32)
    jetzt = timezone.now()
    einladung = BandInvitation.objects.create(
        band=band,
        created_by=ersteller,
        token_hash=token_hash(rohtoken),
        note=note,
        created_at=jetzt,
        expires_at=jetzt + STANDARD_GUELTIGKEIT,
        max_uses=max_uses,
    )
    band_ereignis(band, "band.invitations.updated", id=einladung.id)
    return einladung, rohtoken


@transaction.atomic
def widerrufe_einladung(einladung: BandInvitation, akteur) -> BandInvitation:
    band_owner_sperren(einladung.band, akteur)
    try:
        gesperrt = (
            BandInvitation.objects.select_for_update(of=("self",))
            .select_related("band", "created_by")
            .get(pk=einladung.pk)
        )
    except BandInvitation.DoesNotExist as fehler:
        raise EinladungUngueltig from fehler
    if gesperrt.revoked_at is not None:
        return gesperrt
    gesperrt.revoked_at = timezone.now()
    gesperrt.save(update_fields=["revoked_at"])
    band_ereignis(gesperrt.band, "band.invitations.updated", id=gesperrt.id)
    return gesperrt


def _aktive(einladung: BandInvitation) -> BandInvitation:
    if not einladung.ist_aktiv():
        raise EinladungUngueltig
    return einladung


def aktive_einladung_finden(rohtoken: str) -> BandInvitation:
    try:
        einladung = BandInvitation.objects.select_related("band").get(
            token_hash=token_hash(rohtoken)
        )
    except BandInvitation.DoesNotExist as fehler:
        raise EinladungUngueltig from fehler
    return _aktive(einladung)


def aktive_einladung_sperren(rohtoken: str) -> BandInvitation:
    try:
        einladung = BandInvitation.objects.select_for_update().get(
            token_hash=token_hash(rohtoken)
        )
    except BandInvitation.DoesNotExist as fehler:
        raise EinladungUngueltig from fehler
    return _aktive(einladung)
