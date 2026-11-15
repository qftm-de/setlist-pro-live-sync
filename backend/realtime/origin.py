"""Exakter Origin-Vergleich für den WebSocket-Aufbau."""

from __future__ import annotations

from urllib.parse import urlsplit

from django.conf import settings


def _schema() -> str:
    # Hinter dem TLS-Proxy ist die Betreiber-Origin https, lokal http.
    return "https" if getattr(settings, "SECURE_PROXY_SSL_HEADER", None) else "http"


def erlaubte_origins() -> tuple[str, ...]:
    return tuple(origin.rstrip("/") for origin in settings.CSRF_TRUSTED_ORIGINS)


def host_aus(scope) -> str | None:
    for schluessel, wert in scope.get("headers", []):
        if schluessel.decode("latin-1").lower() == "host":
            return wert.decode("latin-1")
    return None


def _host_passt(host: str | None) -> bool:
    if not host:
        return False
    try:
        teile = urlsplit(f"//{host}")
        hostname = teile.hostname
    except ValueError:
        return False
    if hostname is None:
        return False
    for eintrag in settings.ALLOWED_HOSTS:
        if eintrag == "*":
            return True
        erlaubt = eintrag.lower()
        if erlaubt.startswith("."):
            if hostname.lower().endswith(erlaubt):
                return True
        elif hostname.lower() == erlaubt:
            return True
    return False


def schema_aus_scope(scope) -> str:
    if settings.SECURE_PROXY_SSL_HEADER:
        name = settings.SECURE_PROXY_SSL_HEADER[0]
        if name.upper().startswith("HTTP_"):
            name = name[5:].replace("_", "-").lower()
        for schluessel, wert in scope.get("headers", []):
            if schluessel.decode("latin-1").lower() == name:
                proto = wert.decode("latin-1").split(",")[0].strip().lower()
                if proto in ("http", "https"):
                    return proto
    schema = scope.get("scheme") or "http"
    return {"ws": "http", "wss": "https"}.get(schema, schema)


def origin_gueltig(
    origin: str | None, schema: str | None = None, host: str | None = None
) -> bool:
    if not origin:
        return False
    try:
        teile = urlsplit(origin)
        hostname = teile.hostname
        port = teile.port
    except ValueError:
        # Manipulierte IPv6-Netloc oder nicht numerischer Port.
        return False
    if teile.scheme not in ("http", "https") or not teile.netloc:
        return False
    if teile.path not in ("", "/") or teile.query or teile.fragment:
        return False
    if not _host_passt(host):
        return False
    origin_wert = f"{teile.scheme}://{teile.netloc}"
    if settings.CSRF_TRUSTED_ORIGINS and origin_wert in erlaubte_origins():
        return True
    if teile.scheme != (schema or _schema()):
        return False
    # Wie Djangos CSRF-Prüfung: derselbe Host ist auch ohne Listeneintrag gültig.
    return host is not None and origin_wert.lower() == f"{teile.scheme}://{host}".lower()
