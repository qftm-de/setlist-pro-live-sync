"""Erzeugen, Widerrufen und Prüfen von 48-Stunden-Einladungslinks.

Hash, Grenzwerte, Ausnahmen und die Suche unter Sperre kommen aus
`core.einladungstoken`. Hier steht nur, was die Band-Einladung ausmacht:
Bandbezug, 48 Stunden Laufzeit und das Echtzeit-Ereignis.
"""

from __future__ import annotations

import secrets
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from core.einladungstoken import (  # noqa: F401 - Namen bleiben Teil der Schnittstelle
    MAX_NOTIZ,
    MAX_NUTZUNGEN,
    MIN_NUTZUNGEN,
    EinladungUngueltig,
    EinladungUngueltigeEingabe,
    finde_aktive,
    pruefe_max_uses,
    pruefe_notiz,
    sperre_aktive,
    token_hash,
)
from realtime.services import band_ereignis

from .dienste import band_owner_sperren
from .models import Band, BandInvitation

STANDARD_GUELTIGKEIT = timedelta(hours=48)


@transaction.atomic
def erstelle_einladung(
    band: Band, ersteller, note: str = "", max_uses: int | None = None
) -> tuple[BandInvitation, str]:
    note = pruefe_notiz(note)
    pruefe_max_uses(max_uses)
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


def aktive_einladung_finden(rohtoken: str) -> BandInvitation:
    return finde_aktive(BandInvitation, rohtoken, select_related=("band",))


def aktive_einladung_sperren(rohtoken: str) -> BandInvitation:
    return sperre_aktive(BandInvitation, rohtoken)
