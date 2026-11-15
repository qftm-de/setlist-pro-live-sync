"""PDF-Prüfung in einem begrenzten Unterprozess. Keine Inhalte protokollieren."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

from django.conf import settings


@dataclass(frozen=True)
class PruefErgebnis:
    seiten: int


class PdfUngueltig(Exception):
    def __init__(self, meldung: str):
        super().__init__(meldung)
        self.meldung = meldung


def pruefe_pdf(pfad: Path) -> PruefErgebnis:
    env = {
        "PATH": os.environ.get("PATH", ""),
        "PYTHONPATH": os.pathsep.join(sys.path),
        "PYTHONUNBUFFERED": "1",
        "PDF_CHECK_MEMORY_MB": str(settings.PDF_CHECK_MEMORY_MB),
    }
    args = [
        sys.executable,
        "-m",
        "documents.pruefprozess",
        str(pfad),
        str(settings.PDF_MAX_PAGES),
    ]
    try:
        lauf = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=settings.PDF_CHECK_TIMEOUT_SECONDS,
            env=env,
            check=False,
        )
    except subprocess.TimeoutExpired as fehler:
        raise PdfUngueltig("Die PDF-Prüfung hat zu lange gedauert.") from fehler
    except OSError as fehler:
        raise PdfUngueltig("Die PDF-Prüfung konnte nicht gestartet werden.") from fehler

    if lauf.returncode != 0:
        raise PdfUngueltig("Die Datei ist keine lesbare PDF.")
    try:
        daten = json.loads((lauf.stdout or "").strip() or "{}")
    except json.JSONDecodeError as fehler:
        raise PdfUngueltig("Die Datei ist keine lesbare PDF.") from fehler

    grund = daten.get("fehler")
    if grund == "verschluesselt":
        raise PdfUngueltig("Verschlüsselte PDFs werden nicht unterstützt.")
    if grund == "seitenlimit":
        raise PdfUngueltig("Die PDF hat mehr Seiten als erlaubt.")
    if grund == "speicher":
        raise PdfUngueltig("Die PDF-Prüfung hat zu viel Speicher gebraucht.")
    if grund:
        raise PdfUngueltig("Die Datei ist keine lesbare PDF.")
    seiten = daten.get("seiten")
    if not isinstance(seiten, int) or seiten < 1:
        raise PdfUngueltig("Die PDF braucht mindestens eine Seite.")
    return PruefErgebnis(seiten=seiten)
