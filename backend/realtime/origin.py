"""Exakter Origin-Vergleich für den WebSocket-Aufbau."""

from __future__ import annotations

from urllib.parse import urlsplit

from django.conf import settings


def _schema() -> str:
    # Hinter dem TLS-Proxy ist die Betreiber-Origin https, lokal http.
    return "https" if getattr(settings, "SECURE_PROXY_SSL_HEADER", None) else "http"


def erlaubte_origins() -> tuple[str, ...]:
    if settings.CSRF_TRUSTED_ORIGINS:
        return tuple(origin.rstrip("/") for origin in settings.CSRF_TRUSTED_ORIGINS)
    schema = _schema()
    return tuple(
        sorted(f"{schema}://{host}" for host in settings.ALLOWED_HOSTS if host != "*")
    )


def origin_gueltig(origin: str | None) -> bool:
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
    if teile.scheme != _schema():
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
        if erlaubt.hostname != hostname:
            continue
        if erlaubt_port is not None and erlaubt_port != port:
            continue
        return True
    return False
