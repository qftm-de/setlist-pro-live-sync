"""Private Ablage für Dokumente. Dateischlüssel sind zufällig und nie Pfade."""

from __future__ import annotations

import hashlib
import os
import re
import secrets
import tempfile
from pathlib import Path

from django.conf import settings

SCHLUESSEL_MUSTER = re.compile(r"^[0-9a-f]{64}\.pdf$")
TEMPORAER_ALTER_SEKUNDEN = 24 * 60 * 60
BLOCKGROESSE = 1024 * 1024


class AblageFehler(Exception):
    pass


def _wurzel() -> Path:
    wurzel = Path(settings.DOCUMENTS_ROOT)
    wurzel.mkdir(parents=True, exist_ok=True)
    return wurzel


def neuer_schluessel() -> str:
    return f"{secrets.token_hex(32)}.pdf"


def dateipfad(schluessel: str) -> Path:
    if not SCHLUESSEL_MUSTER.match(schluessel or ""):
        raise AblageFehler("Ungültiger Dateischlüssel.")
    pfad = (_wurzel() / schluessel).resolve()
    if pfad.parent != _wurzel().resolve():
        raise AblageFehler("Ungültiger Dateischlüssel.")
    return pfad


def temporaerer_pfad() -> Path:
    ordner = _wurzel() / "tmp"
    ordner.mkdir(parents=True, exist_ok=True)
    datei = tempfile.NamedTemporaryFile(prefix="upload-", suffix=".part", dir=ordner, delete=False)
    datei.close()
    return Path(datei.name)


def streame_upload(datei, ziel: Path) -> tuple[str, int]:
    """Schreibt den Upload auf Platte und liefert SHA-256 und Bytezahl."""
    hasher = hashlib.sha256()
    groesse = 0
    with ziel.open("wb") as ausgabe:
        for block in datei.chunks(BLOCKGROESSE):
            groesse += len(block)
            hasher.update(block)
            ausgabe.write(block)
            ausgabe.flush()
    return hasher.hexdigest(), groesse


def entferne(pfad: Path | str | None) -> None:
    if not pfad:
        return
    try:
        Path(pfad).unlink(missing_ok=True)
    except OSError:
        pass


def bereinige_reste(verwendete_schluessel: set[str], jetzt: float | None = None) -> int:
    """Entfernt alte Dateien, die keine Datenbankzeile referenziert."""
    import time

    stand = time.time() if jetzt is None else jetzt
    wurzel = _wurzel()
    entfernt = 0
    for eintrag in wurzel.iterdir():
        if eintrag.is_file():
            if eintrag.name in verwendete_schluessel:
                continue
            if stand - eintrag.stat().st_mtime < TEMPORAER_ALTER_SEKUNDEN:
                continue
            entferne(eintrag)
            entfernt += 1
            continue
        if eintrag.is_dir() and eintrag.name == "tmp":
            for rest in eintrag.iterdir():
                if not rest.is_file():
                    continue
                if stand - rest.stat().st_mtime < TEMPORAER_ALTER_SEKUNDEN:
                    continue
                entfernt += 1
                entferne(rest)
    return entfernt


def verschiebe_nach_final(quelle: Path, schluessel: str) -> Path:
    ziel = dateipfad(schluessel)
    ziel.parent.mkdir(parents=True, exist_ok=True)
    os.replace(quelle, ziel)
    return ziel
