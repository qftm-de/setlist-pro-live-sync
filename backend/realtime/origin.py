"""Exakter Origin-Vergleich für den WebSocket-Aufbau."""

from __future__ import annotations

from urllib.parse import urlsplit

from django.conf import settings


def _schema() -> str:
    # Hinter dem TLS-Proxy ist die Betreiber-Origin https, lokal http.
    return "https" if getattr(settings, "SECURE_PROXY_SSL_HEADER", None) else "http"


def erlaubte_origins() -> tuple[str, ...]:
    return tuple(origin.rstrip("/") for origin in settings.CSRF_TRUSTED_ORIGINS)


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
    return scope.get("scheme") or "http"


def origin_gueltig(origin: str | None, schema: str | None = None) -> bool:
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
    if settings.CSRF_TRUSTED_ORIGINS:
        # Ausdrücklich konfigurierte Origins gelten exakt, samt Port.
        return f"{teile.scheme}://{teile.netloc}" in erlaubte_origins()
    if teile.scheme != (schema or _schema()):
        return False
    # Rückfall wie Djangos get_host(): Host ohne Port, außer der Eintrag
    # in ALLOWED_HOSTS nennt selbst einen Port.
    for host in settings.ALLOWED_HOSTS:
        if host == "*":
            continue
        try:
            erlaubt = urlsplit(f"{_schema()}://{host}")
            erlaubt_port = erlaubt.port
        except ValueError:
            continue
        erlaubter_host = erlaubt.hostname or ""
        passt = (
            hostname is not None
            and (
                hostname == erlaubter_host
                or (erlaubter_host.startswith(".") and hostname.endswith(erlaubter_host))
            )
        )
        if not passt:
            continue
        if erlaubt_port is not None and erlaubt_port != port:
            continue
        return True
    return False
