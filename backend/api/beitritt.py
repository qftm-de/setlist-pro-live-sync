"""Öffentlicher Beitritt über eine Instanz-Einladung.

Anders als eine Band-Einladung entsteht hier nur ein Konto. Die Band legt das
Konto danach selbst an. Bewusst Django-Views, damit die CSRF-Middleware auch
für anonyme Aufrufe greift und die Vorschau schreibfrei bleibt.
"""

from __future__ import annotations

import json

from django.contrib.auth import login
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from accounts.einladungen import (
    EinladungUngueltig,
    aktive_instanz_einladung_finden,
    aktive_instanz_einladung_sperren,
)
from accounts.models import InstanzEinladung

from .konto import konto_pruefen, registriere_konto
from .session import FEHLER_ANMELDUNG

FEHLER_EINGABE = {"detail": "Eingaben prüfen."}
FEHLER_UNGUELTIG = {"detail": "Einladung ungültig."}


def _nicht_gefunden() -> JsonResponse:
    return JsonResponse(FEHLER_UNGUELTIG, status=404)


def _antwort(einladung: InstanzEinladung, angelegt: bool, status: int) -> JsonResponse:
    return JsonResponse({"konto_angelegt": angelegt, "note": einladung.note}, status=status)


def _zaehlen(einladung: InstanzEinladung) -> None:
    einladung.uses_count += 1
    einladung.last_used_at = timezone.now()
    einladung.save(update_fields=["uses_count", "last_used_at"])


@require_GET
@ensure_csrf_cookie
def beitritt_vorschau(request, token: str):
    try:
        einladung = aktive_instanz_einladung_finden(token)
    except EinladungUngueltig:
        return _nicht_gefunden()
    return JsonResponse(
        {
            "kind": "instanz",
            "note": einladung.note,
            "expires_at": einladung.expires_at.isoformat(),
            "authenticated": request.user.is_authenticated,
        }
    )


@require_POST
def beitritt_annehmen(request, token: str):
    # Token zuerst prüfen, dann den Körper auswerten. Sonst bekommt ein
    # ungültiger Link bei kaputtem JSON 400 statt des einheitlichen 404.
    try:
        with transaction.atomic():
            einladung = aktive_instanz_einladung_sperren(token)
            try:
                daten = json.loads(request.body or b"{}")
            except (ValueError, UnicodeDecodeError):
                return JsonResponse(FEHLER_EINGABE, status=400)
            if not isinstance(daten, dict):
                return JsonResponse(FEHLER_EINGABE, status=400)
            if request.user.is_authenticated:
                if not request.user.is_active:
                    return JsonResponse(FEHLER_ANMELDUNG, status=400)
                return _antwort(einladung, False, 200)
            modus = daten.get("mode")
            if modus == "login":
                passwort = daten.get("password")
                konto = konto_pruefen(
                    daten.get("username"),
                    passwort if isinstance(passwort, str) else "",
                )
                if konto is None:
                    return JsonResponse(FEHLER_ANMELDUNG, status=400)
                login(request, konto)
                return _antwort(einladung, False, 200)
            if modus == "register":
                konto, fehler, status = registriere_konto(daten)
                if fehler is not None:
                    return JsonResponse(fehler, status=status)
                _zaehlen(einladung)
                login(request, konto)
                return _antwort(einladung, True, 201)
            return JsonResponse(
                {"mode": "mode login oder register ist Pflicht."}, status=400
            )
    except EinladungUngueltig:
        return _nicht_gefunden()
