"""Session und Mitgliedschaft für den WebSocket. Wird laufend neu geprüft."""

from __future__ import annotations

from importlib import import_module

from django.conf import settings
from django.contrib.auth import HASH_SESSION_KEY

def _cookie(scope, name: str) -> str | None:
    for schluessel, wert in scope.get("headers", []):
        if schluessel.decode("latin-1").lower() != "cookie":
            continue
        for teil in wert.decode("latin-1").split(";"):
            kennung, treffer, inhalt = teil.strip().partition("=")
            if kennung == name and treffer:
                return inhalt
    return None


def origin_aus(scope) -> str | None:
    for schluessel, wert in scope.get("headers", []):
        if schluessel.decode("latin-1").lower() == "origin":
            return wert.decode("latin-1")
    return None


def zugriff_gueltig(scope, band_id: int) -> int | None:
    """Konto-ID nur bei aktiver Session und aktueller Mitgliedschaft."""
    schluessel = _cookie(scope, settings.SESSION_COOKIE_NAME)
    if not schluessel:
        return None
    SessionStore = import_module(settings.SESSION_ENGINE).SessionStore
    sitzung = SessionStore(session_key=schluessel)
    try:
        sitzung.load()
    except Exception:
        return None
    konto_id = sitzung.get("_auth_user_id")
    hash_wert = sitzung.get(HASH_SESSION_KEY)
    if not konto_id or not hash_wert:
        return None
    from accounts.models import User

    konto = (
        User.objects.filter(
            pk=konto_id, is_active=True, memberships__band_id=band_id
        )
        .distinct()
        .first()
    )
    if konto is None or konto.get_session_auth_hash() != hash_wert:
        return None
    return int(konto.pk)
