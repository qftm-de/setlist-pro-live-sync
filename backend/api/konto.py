"""Gemeinsame Kontoprüfung für Anmeldung und öffentlichen Einladungsbeitritt.

Beide Wege nutzen exakt einen Argon2-Verifikationspfad (auch für unbekannte
oder gesperrte Konten), damit weder Antworttext noch Hash-Aufwand verraten,
ob ein Konto existiert.
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password

_VERGLEICHS_HASH = None
_AUTH_BACKEND = "django.contrib.auth.backends.ModelBackend"


def normalisiere_benutzername(roh: object) -> str:
    """Trimmt und normalisiert Benutzernamen per NFKC wie Djangos UserManager."""
    if not isinstance(roh, str):
        return ""
    return get_user_model().normalize_username(roh.strip())


def vergleichs_hash() -> str:
    global _VERGLEICHS_HASH
    if _VERGLEICHS_HASH is None:
        _VERGLEICHS_HASH = make_password("kein-konto")
    return _VERGLEICHS_HASH


def ohne_konto_pruefen(passwort: str) -> None:
    """Rechnet genau einen Argon2-Vergleich gegen einen vorbereiteten Hash."""
    check_password(passwort, vergleichs_hash())


def konto_pruefen(roh_benutzername: object, passwort: str):
    """Prüft Zugangsdaten mit einheitlichem Hash-Vergleich ohne Konto-Hinweis."""
    benutzername = normalisiere_benutzername(roh_benutzername)
    if not benutzername or not passwort:
        ohne_konto_pruefen(passwort or "")
        return None
    user_model = get_user_model()
    try:
        konto = user_model._default_manager.get_by_natural_key(benutzername)
    except user_model.DoesNotExist:
        ohne_konto_pruefen(passwort)
        return None
    if not konto.check_password(passwort):
        return None
    if not konto.is_active:
        return None
    konto.backend = _AUTH_BACKEND
    return konto
