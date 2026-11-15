"""Session und Mitgliedschaft für den WebSocket. Wird laufend neu geprüft."""

from __future__ import annotations

from importlib import import_module

from django.conf import settings

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
    if not konto_id:
        return None
    from accounts.models import User

    treffer = (
        User.objects.filter(
            pk=konto_id, is_active=True, memberships__band_id=band_id
        )
        .values_list("pk", flat=True)
        .first()
    )
    return int(treffer) if treffer is not None else None
