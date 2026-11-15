"""Anmeldung, Abmeldung und Sitzungsabfrage des Core.

Bewusst Django-Views statt DRF: die DRF-Ansichten umgehen die
CSRF-Middleware. Hier greift sie, damit die Anmeldung geschützt bleibt.
"""

import json

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.hashers import check_password, make_password
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST

FEHLER_ANMELDUNG = {"detail": "Anmeldung fehlgeschlagen."}

# Wird einmal erzeugt und fuer unbekannte Konten geprueft, damit die Antwortzeit
# nicht verraet, ob ein Konto existiert. Argon2 laeuft so in beiden Faellen.
_VERGLEICHS_HASH = None


def _vergleichs_hash() -> str:
    global _VERGLEICHS_HASH
    if _VERGLEICHS_HASH is None:
        _VERGLEICHS_HASH = make_password("kein-konto")
    return _VERGLEICHS_HASH


def _ohne_konto_pruefen(passwort: str) -> None:
    check_password(passwort, _vergleichs_hash())


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
    benutzername = str(daten.get("username") or "").strip()
    passwort = str(daten.get("password") or "")
    konto = authenticate(request, username=benutzername, password=passwort)
    if konto is None:
        _ohne_konto_pruefen(passwort)
    if konto is None or not konto.is_active:
        # Gleiche Antwort für unbekanntes Konto und falsches Passwort.
        return JsonResponse(FEHLER_ANMELDUNG, status=400)
    login(request, konto)
    return _konto(konto)


@require_POST
def abmeldung(request):
    logout(request)
    return JsonResponse({"ok": True})
