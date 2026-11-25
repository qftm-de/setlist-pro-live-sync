"""Öffentliche Vorschau und Beitritt über einen Einladungslink.

Bewusst Django-Views statt DRF: so greift die CSRF-Middleware auch für
anonyme Beitritte, und die Vorschau bleibt streng schreibfrei.
"""

from __future__ import annotations

import json

from django.contrib.auth import login
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from bands.einladungen import (
    EinladungUngueltig,
    aktive_einladung_finden,
    aktive_einladung_sperren,
)
from bands.models import BandInvitation, Membership
from realtime.services import band_ereignis

from .konto import konto_pruefen, registriere_konto
from .session import FEHLER_ANMELDUNG

FEHLER_EINGABE = {"detail": "Eingaben prüfen."}
FEHLER_UNGUELTIG = {"detail": "Einladung ungültig."}


def _nicht_gefunden() -> JsonResponse:
    return JsonResponse(FEHLER_UNGUELTIG, status=404)


def _band_antwort(einladung: BandInvitation, neu: bool, status: int) -> JsonResponse:
    return JsonResponse(
        {
            "band": {"id": einladung.band_id, "name": einladung.band.name},
            "joined": neu,
        },
        status=status,
    )


def _beitritt_zaehlen(einladung: BandInvitation, neu: bool, user) -> None:
    if not neu:
        return
    einladung.uses_count += 1
    einladung.last_used_at = timezone.now()
    einladung.save(update_fields=["uses_count", "last_used_at"])
    band_ereignis(
        einladung.band, "band.members.updated", user_id=getattr(user, "id", None)
    )


def _mitglied_werden(band, user) -> bool:
    _, neu = Membership.objects.get_or_create(
        band=band, user=user, defaults={"role": Membership.ROLE_MEMBER}
    )
    return neu


@require_GET
@ensure_csrf_cookie
def einladung_vorschau(request, token: str):
    try:
        einladung = aktive_einladung_finden(token)
    except EinladungUngueltig:
        return _nicht_gefunden()
    angemeldet = request.user.is_authenticated
    schon_mitglied = bool(
        angemeldet
        and Membership.objects.filter(
            band=einladung.band, user=request.user
        ).exists()
    )
    return JsonResponse(
        {
            "band_name": einladung.band.name,
            "expires_at": einladung.expires_at.isoformat(),
            "authenticated": angemeldet,
            "already_member": schon_mitglied,
        }
    )


def _angemeldet(request, einladung: BandInvitation) -> JsonResponse:
    if not request.user.is_active:
        return JsonResponse(FEHLER_ANMELDUNG, status=400)
    neu = _mitglied_werden(einladung.band, request.user)
    _beitritt_zaehlen(einladung, neu, request.user)
    return _band_antwort(einladung, neu, 200)


def _anmelden(request, einladung: BandInvitation, daten: dict) -> JsonResponse:
    passwort = daten.get("password")
    passwort = passwort if isinstance(passwort, str) else ""
    konto = konto_pruefen(daten.get("username"), passwort)
    if konto is None:
        return JsonResponse(FEHLER_ANMELDUNG, status=400)
    neu = _mitglied_werden(einladung.band, konto)
    _beitritt_zaehlen(einladung, neu, konto)
    login(request, konto)
    return _band_antwort(einladung, neu, 200)


def _registrieren(request, einladung: BandInvitation, daten: dict) -> JsonResponse:
    konto, fehler, status = registriere_konto(daten)
    if fehler is not None:
        return JsonResponse(fehler, status=status)
    Membership.objects.create(
        band=einladung.band, user=konto, role=Membership.ROLE_MEMBER
    )
    _beitritt_zaehlen(einladung, True, konto)
    login(request, konto)
    return _band_antwort(einladung, True, 201)


@require_POST
def einladung_beitreten(request, token: str):
    try:
        daten = json.loads(request.body or b"{}")
    except (ValueError, UnicodeDecodeError):
        return JsonResponse(FEHLER_EINGABE, status=400)
    if not isinstance(daten, dict):
        return JsonResponse(FEHLER_EINGABE, status=400)
    try:
        with transaction.atomic():
            einladung = aktive_einladung_sperren(token)
            if request.user.is_authenticated:
                return _angemeldet(request, einladung)
            modus = daten.get("mode")
            if modus == "login":
                return _anmelden(request, einladung, daten)
            if modus == "register":
                return _registrieren(request, einladung, daten)
            return JsonResponse(
                {"mode": "mode login oder register ist Pflicht."}, status=400
            )
    except EinladungUngueltig:
        return _nicht_gefunden()
