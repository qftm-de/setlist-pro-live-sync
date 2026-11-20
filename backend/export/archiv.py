"""ZIP-Aufbau für den Bandexport mit harter Größenobergrenze."""

from __future__ import annotations

import json
import tempfile
import zipfile
from pathlib import Path

BLOCKGROESSE = 1024 * 1024
SPEICHERGRENZE = 8 * 1024 * 1024


class ExportZuGross(Exception):
    """Der Export überschreitet EXPORT_MAX_BYTES."""


class GroessenWaechter:
    def __init__(self, grenze: int | None):
        self.grenze = grenze
        self.zaehler = 0

    def zaehle(self, anzahl: int) -> None:
        self.zaehler += anzahl
        if self.grenze is not None and self.grenze > 0 and self.zaehler > self.grenze:
            raise ExportZuGross("Der Export überschreitet die Größenobergrenze.")


def _bloecke(pfad: Path):
    with pfad.open("rb") as datei:
        while True:
            block = datei.read(BLOCKGROESSE)
            if not block:
                return
            yield block


def _schreibe(
    archiv: zipfile.ZipFile, name: str, quelle, waechter: GroessenWaechter
) -> None:
    with archiv.open(name, "w") as ziel:
        for block in quelle:
            waechter.zaehle(len(block))
            ziel.write(block)


def pruefe_groesse(pdfs: list[dict], grenze: int | None) -> None:
    """Prüft die Summe der PDF-Bytes, bevor eine temporäre Datei entsteht."""
    if not grenze or grenze <= 0:
        return
    gesamt = 0
    for eintrag in pdfs:
        try:
            gesamt += Path(eintrag["pfad"]).stat().st_size
        except OSError:
            continue
        if gesamt > grenze:
            raise ExportZuGross("Der Export überschreitet die Größenobergrenze.")


def baue_archiv(manifest: dict, pdfs: list[dict], grenze: int | None = None):
    """Baut das Archiv und liefert Datei und gezählte Nutzbytes."""
    datei = tempfile.SpooledTemporaryFile(max_size=SPEICHERGRENZE, mode="w+b")
    waechter = GroessenWaechter(grenze)
    try:
        with zipfile.ZipFile(
            datei, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6
        ) as archiv:
            _schreibe(
                archiv,
                "manifest.json",
                [json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8")],
                waechter,
            )
            for eintrag in pdfs:
                _schreibe(
                    archiv,
                    eintrag["pfad_im_archiv"],
                    _bloecke(eintrag["pfad"]),
                    waechter,
                )
    except Exception:
        datei.close()
        raise
    datei.seek(0)
    return datei, waechter.zaehler
