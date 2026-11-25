"""Gemeinsame Regeln für Einladungs-Tokens.

Band-Einladung und Instanz-Einladung teilen Hash, Grenzwerte, Ausnahmen und die
Suche unter Sperre. Was sie unterscheidet (Bandbezug, Laufzeit, Ereignisse)
bleibt in den jeweiligen Modulen. Eine Regeländerung passiert hier.
"""

from __future__ import annotations

import hashlib

MAX_NOTIZ = 120
MIN_NUTZUNGEN = 1
MAX_NUTZUNGEN = 100


class EinladungUngueltig(Exception):
    """Token unbekannt, abgelaufen, widerrufen oder ausgeschöpft."""


class EinladungUngueltigeEingabe(Exception):
    """Hinweis oder Nutzungslimit außerhalb der Grenzen."""

    def __init__(self, felder: dict[str, str] | None = None):
        super().__init__("Eingaben prüfen.")
        self.felder = felder or {"detail": "Eingaben prüfen."}


def token_hash(rohtoken: str) -> str:
    return hashlib.sha256(rohtoken.encode("utf-8")).hexdigest()


def pruefe_notiz(note: str | None) -> str:
    note = (note or "").strip()
    if len(note) > MAX_NOTIZ:
        raise EinladungUngueltigeEingabe({"note": "Höchstens 120 Zeichen."})
    return note


def pruefe_max_uses(max_uses: int | None) -> None:
    if max_uses is None:
        return
    if isinstance(max_uses, bool) or not isinstance(max_uses, int):
        raise EinladungUngueltigeEingabe(
            {"max_uses": "Erlaubt sind 1 bis 100 oder null."}
        )
    if not MIN_NUTZUNGEN <= max_uses <= MAX_NUTZUNGEN:
        raise EinladungUngueltigeEingabe(
            {"max_uses": "Erlaubt sind 1 bis 100 oder null."}
        )


def _aktive(einladung):
    if not einladung.ist_aktiv():
        raise EinladungUngueltig
    return einladung


def finde_aktive(modell, rohtoken: str, select_related: tuple[str, ...] = ()):
    abfrage = modell.objects.all()
    if select_related:
        abfrage = abfrage.select_related(*select_related)
    try:
        einladung = abfrage.get(token_hash=token_hash(rohtoken))
    except modell.DoesNotExist as fehler:
        raise EinladungUngueltig from fehler
    return _aktive(einladung)


def sperre_aktive(modell, rohtoken: str):
    try:
        einladung = modell.objects.select_for_update().get(
            token_hash=token_hash(rohtoken)
        )
    except modell.DoesNotExist as fehler:
        raise EinladungUngueltig from fehler
    return _aktive(einladung)
