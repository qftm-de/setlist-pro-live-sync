"""Reine CRDT-Helfer. Keine Datenbankzugriffe, kein Ereignisversand."""

from __future__ import annotations

import base64

from pycrdt import Doc, Text

MAX_UPDATE_BYTES = 64 * 1024
# Obergrenze für den gespeicherten Zustand eines Feldes. Yjs verdichtet beim
# Kodieren, wächst aber mit Grabsteinen gelöschter Zeichen. Ohne Grenze kann
# ein Feld den Bandstrom und den texts/-Abruf beliebig aufblähen.
MAX_ZUSTAND_BYTES = 8 * MAX_UPDATE_BYTES

FELDGRENZEN = {
    "name": 120,
    "label": 200,
    "text": 2000,
}


class TextFehler(Exception):
    """Update, Epoche oder Textgrenze sind ungültig."""


def _doc(state: bytes) -> Doc:
    doc = Doc()
    if state:
        doc.apply_update(bytes(state))
    return doc


def initialzustand(text: str, client_id: int | None = None) -> bytes:
    doc = Doc(client_id=client_id)
    inhalt = doc.get("t", type=Text)
    inhalt += text or ""
    return bytes(doc.get_update())


def inhalt(state: bytes) -> str:
    return str(_doc(state).get("t", type=Text))


def pruefe_laenge(feld: str, text: str) -> None:
    grenze = FELDGRENZEN[feld]
    if len(text) > grenze:
        raise TextFehler(f"Höchstens {grenze} Zeichen.")


def wende_update_an(state: bytes, update: bytes) -> tuple[bytes, str]:
    """Wendet ein binäres Update auf einer Kopie an. Keine Teilübernahme."""
    if not isinstance(update, (bytes, bytearray)) or not update:
        raise TextFehler("Update fehlt.")
    if len(update) > MAX_UPDATE_BYTES:
        raise TextFehler("Update ist größer als 64 KiB.")
    doc = _doc(state)
    try:
        doc.apply_update(bytes(update))
    except Exception as fehler:  # noqa: BLE001 - Beschädigung wird zum Fachfehler
        raise TextFehler("Update ist beschädigt.") from fehler
    return bytes(doc.get_update()), str(doc.get("t", type=Text))


def kodiere(update: bytes) -> str:
    return base64.b64encode(update).decode("ascii")


def dekodiere(wert) -> bytes:
    if not isinstance(wert, str) or not wert:
        raise TextFehler("Update fehlt.")
    try:
        return base64.b64decode(wert, validate=True)
    except Exception as fehler:  # noqa: BLE001
        raise TextFehler("Update ist nicht base64-kodiert.") from fehler
