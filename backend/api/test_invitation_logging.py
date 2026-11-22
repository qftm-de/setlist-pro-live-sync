"""Einladungs-Tokens bleiben aus Django-Protokollen heraus (R22)."""

from __future__ import annotations

import io
import logging

from django.conf import settings
from django.test import Client, TestCase
from django.utils.log import configure_logging

from core.log_redaktion import RedigiereEinladungstoken

ROHTOKEN = "A" * 43
GEPRUEFTE_LOGGER = (
    "",
    "django",
    "django.server",
    "django.request",
    "django.security",
    "django.security.csrf",
)


def protokolliere_echte_handler(anfrage) -> str:
    """Fängt die Ausgaben aller konfigurierten Django- und Root-StreamHandler ab."""
    configure_logging(settings.LOGGING_CONFIG, settings.LOGGING)
    strom = io.StringIO()
    ersetzt: list[tuple[logging.StreamHandler, object]] = []
    gesehen: set[int] = set()
    for name in GEPRUEFTE_LOGGER:
        for handler in logging.getLogger(name).handlers:
            if isinstance(handler, logging.StreamHandler) and id(handler) not in gesehen:
                gesehen.add(id(handler))
                ersetzt.append((handler, handler.stream))
                handler.stream = strom
    try:
        anfrage()
    finally:
        for handler, alt in ersetzt:
            handler.stream = alt
    return strom.getvalue()


class EinladungsLogTest(TestCase):
    def test_alle_django_handler_tragen_den_redaktionsfilter(self):
        configure_logging(settings.LOGGING_CONFIG, settings.LOGGING)
        self.assertTrue(logging.getLogger("").handlers, "Root-Logger hat keine Handler.")
        for name in ("django", "django.server"):
            logger = logging.getLogger(name)
            self.assertEqual(logger.handlers, [])
            self.assertTrue(logger.propagate)
        for name in GEPRUEFTE_LOGGER:
            for handler in logging.getLogger(name).handlers:
                hat_filter = any(
                    isinstance(f, RedigiereEinladungstoken) for f in handler.filters
                )
                self.assertTrue(
                    hat_filter,
                    f"Handler {handler.name!r} an Logger {name!r} fehlt der Redaktionsfilter.",
                )

    def test_404_log_redigiert_den_pfad_token(self):
        protokoll = protokolliere_echte_handler(
            lambda: Client().get(f"/api/invitations/{ROHTOKEN}/"),
        )
        self.assertIn("/api/invitations/[token]/", protokoll)
        self.assertNotIn(ROHTOKEN, protokoll)

    def test_csrf_log_redigiert_den_pfad_token(self):
        protokoll = protokolliere_echte_handler(
            lambda: Client(enforce_csrf_checks=True).post(
                f"/api/invitations/{ROHTOKEN}/accept/",
                data="{}",
                content_type="application/json",
            ),
        )
        self.assertIn("/api/invitations/[token]/accept/", protokoll)
        self.assertNotIn(ROHTOKEN, protokoll)

    def test_django_server_log_redigiert_einladungspfad(self):
        protokoll = protokolliere_echte_handler(
            lambda: logging.getLogger("django.server").info(
                '"GET /einladung/%s HTTP/1.1" 200 120', ROHTOKEN
            ),
        )
        self.assertIn("/einladung/[token]", protokoll)
        self.assertNotIn(ROHTOKEN, protokoll)

    def test_fremde_pfade_bleiben_unveraendert_und_urlkodierte_tokens_werden_redigiert(self):
        fremd = logging.LogRecord(
            "django.request",
            logging.WARNING,
            __file__,
            1,
            "%s: %s",
            ("Not Found", "/api/bands/7/invitations/12/"),
            None,
        )
        RedigiereEinladungstoken().filter(fremd)
        self.assertEqual(fremd.getMessage(), "Not Found: /api/bands/7/invitations/12/")

        kodiert = logging.LogRecord(
            "django.request",
            logging.WARNING,
            __file__,
            1,
            "%s: %s",
            ("Not Found", "/api/invitations/abc%20def/accept/"),
            None,
        )
        RedigiereEinladungstoken().filter(kodiert)
        self.assertEqual(kodiert.getMessage(), "Not Found: /api/invitations/[token]/accept/")
