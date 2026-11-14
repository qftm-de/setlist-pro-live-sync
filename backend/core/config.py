"""Laufzeitkonfiguration des Core. Prüft Pflichtwerte vor dem Start."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Mapping
from urllib.parse import urlsplit

from django.core.exceptions import ImproperlyConfigured

ERLAUBTE_MODI = ("core",)
MIN_SECRET_LAENGE = 32


@dataclass(frozen=True)
class LaufzeitKonfiguration:
    modus: str
    instanzname: str
    community_url: str | None
    secret_key: str
    debug: bool
    allowed_hosts: tuple[str, ...]
    csrf_trusted_origins: tuple[str, ...]
    trust_proxy_headers: bool
    db_name: str
    db_user: str
    db_password: str
    db_host: str
    db_port: str


def _wert(environ: Mapping[str, str], name: str) -> str:
    return str(environ.get(name) or "").strip()


def _pflicht(environ: Mapping[str, str], name: str) -> str:
    wert = _wert(environ, name)
    if not wert:
        raise ImproperlyConfigured(f"{name} muss gesetzt sein.")
    return wert


def _modus(environ: Mapping[str, str]) -> str:
    modus = _wert(environ, "APP_MODE")
    if not modus:
        raise ImproperlyConfigured(
            "APP_MODE muss explizit gesetzt sein. Erlaubt ist in dieser Beta nur core."
        )
    if modus not in ERLAUBTE_MODI:
        raise ImproperlyConfigured(
            f"APP_MODE {modus!r} wird in dieser Beta nicht unterstützt. Erlaubt ist nur core."
        )
    return modus


def _community_url(environ: Mapping[str, str]) -> str | None:
    roh = _wert(environ, "COMMUNITY_URL")
    if not roh:
        return None
    teile = urlsplit(roh)
    if teile.scheme not in ("http", "https") or not teile.netloc:
        raise ImproperlyConfigured("COMMUNITY_URL braucht ein gültiges http- oder https-Ziel.")
    if teile.username or teile.password:
        raise ImproperlyConfigured("COMMUNITY_URL darf keine Zugangsdaten enthalten.")
    return roh


def _liste(environ: Mapping[str, str], name: str) -> tuple[str, ...]:
    return tuple(
        teil.strip() for teil in _wert(environ, name).split(",") if teil.strip()
    )


def _csrf_origins(environ: Mapping[str, str]) -> tuple[str, ...]:
    origins = _liste(environ, "CSRF_TRUSTED_ORIGINS")
    for origin in origins:
        teile = urlsplit(origin)
        if teile.scheme not in ("http", "https") or not teile.netloc or teile.path not in ("", "/"):
            raise ImproperlyConfigured(
                "CSRF_TRUSTED_ORIGINS erwartet Origins als Schema und Host ohne Pfad."
            )
    return origins


def _debug(environ: Mapping[str, str]) -> bool:
    return _wert(environ, "DJANGO_DEBUG").lower() == "true"


def _trust_proxy(environ: Mapping[str, str]) -> bool:
    return _wert(environ, "TRUST_PROXY_HEADERS").lower() == "true"


def load_runtime_config(environ: Mapping[str, str] | None = None) -> LaufzeitKonfiguration:
    env = os.environ if environ is None else environ
    modus = _modus(env)
    secret_key = _pflicht(env, "DJANGO_SECRET_KEY")
    if len(secret_key) < MIN_SECRET_LAENGE:
        raise ImproperlyConfigured(
            f"DJANGO_SECRET_KEY braucht mindestens {MIN_SECRET_LAENGE} Zeichen."
        )
    allowed_hosts = _liste(env, "ALLOWED_HOSTS")
    if not allowed_hosts:
        raise ImproperlyConfigured("ALLOWED_HOSTS muss gesetzt sein.")
    db_host = _pflicht(env, "POSTGRES_HOST")
    if db_host.lower() == "sqlite":
        raise ImproperlyConfigured("SQLite ist im Pilotbetrieb nicht erlaubt.")
    return LaufzeitKonfiguration(
        modus=modus,
        instanzname=_wert(env, "INSTANCE_NAME") or "Setlist Pro Live Sync",
        community_url=_community_url(env),
        secret_key=secret_key,
        debug=_debug(env),
        allowed_hosts=allowed_hosts,
        csrf_trusted_origins=_csrf_origins(env),
        trust_proxy_headers=_trust_proxy(env),
        db_name=_pflicht(env, "POSTGRES_DB"),
        db_user=_pflicht(env, "POSTGRES_USER"),
        db_password=_pflicht(env, "POSTGRES_PASSWORD"),
        db_host=db_host,
        db_port=_wert(env, "POSTGRES_PORT") or "5432",
    )
