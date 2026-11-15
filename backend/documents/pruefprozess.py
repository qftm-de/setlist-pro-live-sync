"""Unterprozess für die PDF-Prüfung. Liest nur Struktur und Seitenzahl."""

from __future__ import annotations

import json
import os
import sys


def _speicher_begrenzen() -> None:
    try:
        import resource
    except ImportError:
        return
    mb = int(os.environ.get("PDF_CHECK_MEMORY_MB", "512"))
    if mb <= 0:
        return
    grenze = mb * 1024 * 1024
    resource.setrlimit(resource.RLIMIT_AS, (grenze, grenze))


def _ausgabe(daten: dict) -> None:
    sys.stdout.write(json.dumps(daten))
    sys.stdout.flush()


def main(pfad: str, max_seiten: int) -> int:
    _speicher_begrenzen()
    try:
        from pypdf import PdfReader
    except MemoryError:
        _ausgabe({"fehler": "speicher"})
        return 0

    try:
        reader = PdfReader(pfad, strict=False)
        if reader.is_encrypted:
            _ausgabe({"fehler": "verschluesselt"})
            return 0
        seiten = len(reader.pages)
    except MemoryError:
        _ausgabe({"fehler": "speicher"})
        return 0
    except Exception:
        _ausgabe({"fehler": "ungueltig"})
        return 0

    if seiten < 1:
        _ausgabe({"fehler": "leer"})
        return 0
    if max_seiten > 0 and seiten > max_seiten:
        _ausgabe({"fehler": "seitenlimit"})
        return 0
    _ausgabe({"seiten": seiten})
    return 0


if __name__ == "__main__":
    _max = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    raise SystemExit(main(sys.argv[1], _max))
