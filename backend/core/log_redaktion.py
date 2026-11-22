"""Entfernt Einladungs-Tokens aus Log-Zeilen, bevor sie geschrieben werden."""

from __future__ import annotations

import logging
import re

EINLADUNG_TOKEN = re.compile(r"(/(?:api/invitations|einladung)/)[^\s/?#\"']+")


class RedigiereEinladungstoken(logging.Filter):
    """Ersetzt den Pfad-Token durch einen festen Platzhalter."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            nachricht = record.getMessage()
        except Exception:  # noqa: BLE001 - Formatfehler dürfen das Log nicht stoppen
            return True
        redigiert = EINLADUNG_TOKEN.sub(r"\1[token]", nachricht)
        if redigiert != nachricht:
            record.msg = redigiert
            record.args = ()
        return True
