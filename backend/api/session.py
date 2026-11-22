"""Anmeldung, Abmeldung und Sitzungsabfrage des Core.

Bewusst Django-Views statt DRF: die DRF-Ansichten umgehen die
CSRF-Middleware. Hier greift sie, damit die Anmeldung geschützt bleibt.
"""

import json

from django.contrib.auth import login, logout
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST

from .konto import konto_pruefen

FEHLER_ANMELDUNG = {"detail": "Anmeldung fehlgeschlagen."}


def _konto(user) -> JsonResponse:
    return JsonResponse(
        {
            "id": user.id,
            "username": user.get_username(),
            "display_name": user.display_name or user.get_username(),
        }
    )


@require_GET
def sitzung(request):
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Anmeldung erforderlich."}, status=401)
    return _konto(request.user)


@require_POST
def anmeldung(request):
    try:
        daten = json.loads(request.body or b"{}")
    except (ValueError, UnicodeDecodeError):
        daten = {}
    if not isinstance(daten, dict):
        daten = {}
    passwort = str(daten.get("password") or "")
    konto = konto_pruefen(daten.get("username"), passwort)
    if konto is None:
        # Gleiche Antwort und gleicher Prüfpfaad für unbekanntes Konto,
        # gesperrtes Konto und falsches Passwort.
        return JsonResponse(FEHLER_ANMELDUNG, status=400)
    login(request, konto)
    return _konto(konto)


@require_POST
def abmeldung(request):
    logout(request)
    return JsonResponse({"ok": True})
