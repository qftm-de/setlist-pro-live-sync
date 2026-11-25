"""Erzeugen und Prüfen von Instanz-Einladungen.

Eine Instanz-Einladung legt nur ein Konto an. Die Band entsteht danach im
normalen Ablauf, damit der Betreiber keine fremde Band vorab anlegen muss.
Hash, Grenzwerte und Ausnahmen kommen aus `core.einladungstoken`.
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

from .models import InstanzEinladung

STANDARD_TAGE = 7
MAX_TAGE = 90


def _pruefe_tage(tage: int) -> None:
    if isinstance(tage, bool) or not isinstance(tage, int):
        raise EinladungUngueltigeEingabe({"tage": "Erlaubt sind 1 bis 90."})
    if not 1 <= tage <= MAX_TAGE:
        raise EinladungUngueltigeEingabe({"tage": "Erlaubt sind 1 bis 90."})


@transaction.atomic
def erstelle_instanz_einladung(
    ersteller, note: str = "", max_uses: int | None = None, tage: int = STANDARD_TAGE
) -> tuple[InstanzEinladung, str]:
    note = pruefe_notiz(note)
    pruefe_max_uses(max_uses)
    _pruefe_tage(tage)
    rohtoken = secrets.token_urlsafe(32)
    jetzt = timezone.now()
    einladung = InstanzEinladung.objects.create(
        created_by=ersteller,
        token_hash=token_hash(rohtoken),
        note=note,
        created_at=jetzt,
        expires_at=jetzt + timedelta(days=tage),
        max_uses=max_uses,
    )
    return einladung, rohtoken


@transaction.atomic
def widerrufe_instanz_einladung(einladung: InstanzEinladung) -> InstanzEinladung:
    gesperrt = InstanzEinladung.objects.select_for_update().get(pk=einladung.pk)
    if gesperrt.revoked_at is not None:
        return gesperrt
    gesperrt.revoked_at = timezone.now()
    gesperrt.save(update_fields=["revoked_at"])
    return gesperrt


def aktive_instanz_einladung_finden(rohtoken: str) -> InstanzEinladung:
    return finde_aktive(InstanzEinladung, rohtoken)


def aktive_instanz_einladung_sperren(rohtoken: str) -> InstanzEinladung:
    return sperre_aktive(InstanzEinladung, rohtoken)
