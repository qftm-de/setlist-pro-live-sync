"""Idempotente Einzelbefehle für Setlist-Strukturen.

Ein Befehl, eine Transaktion, derselbe Schreibdienst für REST und WebSocket.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from typing import Any

from django.db import transaction

from collaboration.models import TextState
from collaboration.services import epoche_erhoehen, ist_entfernt, merke_entfernt
from library.models import Song

from .models import Entry, Section, Setlist, SetlistCommand

PARK = 1_000_000
BEFEHLSAETZE = {
    "section.create",
    "section.update",
    "section.delete",
    "section.move",
    "entry.create",
    "entry.update",
    "entry.delete",
    "entry.move",
}


class BefehlFehler(Exception):
    """Fachlicher Fehler eines Einzelbefehls."""


class NutzdatenKonflikt(BefehlFehler):
    """Gleiche Befehlskennung, andere Nutzdaten."""


class UnbekannterBefehl(BefehlFehler):
    """Befehlsart ist nicht bekannt."""


class NachbarFehlt(BefehlFehler):
    """Ziel oder Nachbar gehört nicht zu dieser Setlist."""


class BefehlUngueltig(BefehlFehler):
    """Nutzdaten verletzen die Feldregeln."""


def signatur(kind: str, payload: dict) -> str:
    roh = json.dumps(
        {"kind": kind, "payload": payload},
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )
    return hashlib.sha256(roh.encode("utf-8")).hexdigest()


def _parke_abschnitte(setlist: Setlist) -> None:
    for abschnitt in Section.objects.filter(setlist=setlist).only("id"):
        Section.objects.filter(pk=abschnitt.pk).update(position=PARK + abschnitt.pk)


def _parke_eintraege(*abschnitte: Section) -> None:
    for abschnitt in abschnitte:
        for eintrag in Entry.objects.filter(section=abschnitt).only("id"):
            Entry.objects.filter(pk=eintrag.pk).update(position=PARK + eintrag.pk)


def _abschnitte(setlist: Setlist) -> list[Section]:
    return list(Section.objects.filter(setlist=setlist).order_by("position", "id"))


def _eintraege(abschnitt: Section) -> list[Entry]:
    return list(Entry.objects.filter(section=abschnitt).order_by("position", "id"))


def _suche_abschnitt(setlist: Setlist, kennung) -> Section:
    # Strukturzeile zuerst sperren. Der Textpfad sperrt in derselben
    # Reihenfolge, sonst entsteht ein Deadlock auf Abschnittsnamen.
    treffer = (
        Section.objects.select_for_update()
        .filter(setlist=setlist, uuid=kennung)
        .first()
    )
    if treffer is None:
        raise NachbarFehlt("Abschnitt gehört nicht zu dieser Setlist.")
    return treffer


def _suche_eintrag(setlist: Setlist, kennung) -> Entry:
    # Strukturzeile zuerst sperren, siehe _suche_abschnitt.
    treffer = (
        Entry.objects.select_for_update()
        .filter(section__setlist=setlist, uuid=kennung)
        .first()
    )
    if treffer is None:
        raise NachbarFehlt("Eintrag gehört nicht zu dieser Setlist.")
    return treffer


def _einfuegen(liste: list, objekt, payload: dict, nach_feld: str) -> None:
    if nach_feld not in payload:
        liste.append(objekt)
        return
    wert = payload[nach_feld]
    if wert is None:
        liste.insert(0, objekt)
        return
    index = next(
        (
            position
            for position, eintrag in enumerate(liste)
            if str(eintrag.uuid) == str(wert)
        ),
        None,
    )
    if index is None:
        raise NachbarFehlt("Nachbar gehört nicht zu dieser Setlist.")
    liste.insert(index + 1, objekt)


def _positionen_abschnitte(abschnitte: list[Section]) -> None:
    for index, abschnitt in enumerate(abschnitte, start=1):
        Section.objects.filter(pk=abschnitt.pk).update(position=index)


def _positionen_eintraege(abschnitt: Section, eintraege: list[Entry]) -> None:
    for index, eintrag in enumerate(eintraege, start=1):
        Entry.objects.filter(pk=eintrag.pk).update(position=index, section=abschnitt)


def _song(payload: dict, band, alt: Entry | None) -> Song | None:
    if "song_id" not in payload:
        return alt.song if alt else None
    song_id = payload.get("song_id")
    if song_id in (None, ""):
        return None
    try:
        return Song.objects.get(id=song_id, band=band)
    except Song.DoesNotExist as fehler:
        raise BefehlUngueltig("Song gehört nicht zu dieser Band.") from fehler


def _eintrag_werte(payload: dict, band, alt: Entry | None = None) -> dict:
    art = payload.get("entry_type", alt.entry_type if alt else "song")
    if art not in dict(Entry.TYP_CHOICES):
        raise BefehlUngueltig("Unbekannte Eintragsart.")
    song = _song(payload, band, alt)
    label = (payload.get("label", alt.label if alt else "") or "").strip()
    if art == Entry.TYP_SONG and song is None:
        raise BefehlUngueltig("Song ist Pflicht.")
    if art != Entry.TYP_SONG and song is not None:
        raise BefehlUngueltig("Nur Song-Einträge haben einen Song.")
    if art == Entry.TYP_NOTIZ and not label:
        raise BefehlUngueltig("Eine Notiz braucht eine Bezeichnung.")
    if art == Entry.TYP_PAUSE and not label:
        label = "Pause"
    if len(label) > 200:
        raise BefehlUngueltig("Bezeichnung ist zu lang.")
    return {
        "entry_type": art,
        "song": song,
        "label": label,
        "duration_seconds": _dauer_aus(
            payload.get("duration_seconds", alt.duration_seconds if alt else None)
        ),
    }


def _dauer_aus(wert) -> int | None:
    """Gleiche Grenzen wie der REST-Weg (serializers.py, min_value 1)."""
    if wert is None:
        return None
    if isinstance(wert, bool) or not isinstance(wert, int):
        raise BefehlUngueltig("Dauer muss eine ganze Zahl sein.")
    if wert < 1 or wert > 86400:
        raise BefehlUngueltig("Dauer muss zwischen 1 und 86400 Sekunden liegen.")
    return wert


def _abschnitt_werte(payload: dict, alt: Section | None = None) -> dict:
    kind = payload.get("kind", alt.kind if alt else "set")
    if kind not in dict(Section.KIND_CHOICES):
        raise BefehlUngueltig("Unbekannte Abschnittsart.")
    # Trimmen wie der REST-Weg (DRF-CharField). Sonst weicht die Spalte vom
    # CRDT-Stand ab und der nächste Gesamt-PUT erhöht die Epoche.
    name = str(payload.get("name", alt.name if alt else "") or "").strip()
    if len(name) > 120:
        raise BefehlUngueltig("Name ist zu lang.")
    return {"kind": kind, "name": name}


def _neue_id(payload: dict, typ: str) -> uuid.UUID:
    wert = payload.get("uuid")
    try:
        kennung = uuid.UUID(str(wert))
    except (TypeError, ValueError) as fehler:
        raise BefehlUngueltig("UUID fehlt oder ist ungültig.") from fehler
    if ist_entfernt(typ, kennung):
        raise BefehlUngueltig("Diese UUID wurde gelöscht.")
    return kennung


def _wende_an(setlist: Setlist, kind: str, payload: dict) -> None:
    if kind == "section.create":
        kennung = _neue_id(payload, TextState.TYP_SECTION)
        if Section.objects.filter(uuid=kennung).exists():
            raise BefehlUngueltig("UUID ist bereits vergeben.")
        abschnitte = _abschnitte(setlist)
        _parke_abschnitte(setlist)
        neu = Section.objects.create(
            setlist=setlist,
            uuid=kennung,
            position=PARK * 2 + len(abschnitte) + 1,
            **_abschnitt_werte(payload),
        )
        _einfuegen(abschnitte, neu, payload, "after_section_uuid")
        _positionen_abschnitte(abschnitte)
        return

    if kind == "section.update":
        abschnitt = _suche_abschnitt(setlist, payload.get("uuid"))
        werte = _abschnitt_werte(payload, abschnitt)
        if werte["name"] != abschnitt.name:
            epoche_erhoehen(
                TextState.TYP_SECTION, abschnitt.uuid, "name", werte["name"]
            )
        for feld, wert in werte.items():
            setattr(abschnitt, feld, wert)
        abschnitt.save(update_fields=["name", "kind"])
        return

    if kind == "section.delete":
        abschnitt = _suche_abschnitt(setlist, payload.get("uuid"))
        merke_entfernt(TextState.TYP_SECTION, abschnitt.uuid)
        for eintrag in _eintraege(abschnitt):
            merke_entfernt(TextState.TYP_ENTRY, eintrag.uuid)
        abschnitt.delete()
        abschnitte = _abschnitte(setlist)
        _positionen_abschnitte(abschnitte)
        return

    if kind == "section.move":
        abschnitt = _suche_abschnitt(setlist, payload.get("uuid"))
        abschnitte = [eintrag for eintrag in _abschnitte(setlist) if eintrag.pk != abschnitt.pk]
        _einfuegen(abschnitte, abschnitt, payload, "after_section_uuid")
        _parke_abschnitte(setlist)
        _positionen_abschnitte(abschnitte)
        return

    if kind == "entry.create":
        kennung = _neue_id(payload, TextState.TYP_ENTRY)
        if Entry.objects.filter(uuid=kennung).exists():
            raise BefehlUngueltig("UUID ist bereits vergeben.")
        abschnitt = _suche_abschnitt(setlist, payload.get("section_uuid"))
        eintraege = _eintraege(abschnitt)
        _parke_eintraege(abschnitt)
        neu = Entry.objects.create(
            section=abschnitt,
            uuid=kennung,
            position=PARK * 2 + len(eintraege) + 1,
            **_eintrag_werte(payload, setlist.band),
        )
        _einfuegen(eintraege, neu, payload, "after_entry_uuid")
        _positionen_eintraege(abschnitt, eintraege)
        return

    if kind == "entry.update":
        eintrag = _suche_eintrag(setlist, payload.get("uuid"))
        werte = _eintrag_werte(payload, setlist.band, eintrag)
        if werte["label"] != eintrag.label:
            epoche_erhoehen(TextState.TYP_ENTRY, eintrag.uuid, "label", werte["label"])
        for feld, wert in werte.items():
            setattr(eintrag, feld, wert)
        eintrag.save()
        return

    if kind == "entry.delete":
        eintrag = _suche_eintrag(setlist, payload.get("uuid"))
        abschnitt = eintrag.section
        merke_entfernt(TextState.TYP_ENTRY, eintrag.uuid)
        eintrag.delete()
        _positionen_eintraege(abschnitt, _eintraege(abschnitt))
        return

    if kind == "entry.move":
        eintrag = _suche_eintrag(setlist, payload.get("uuid"))
        ziel = _suche_abschnitt(setlist, payload.get("section_uuid"))
        gleicher_abschnitt = eintrag.section_id == ziel.id
        alt = [zeile for zeile in _eintraege(eintrag.section) if zeile.pk != eintrag.pk]
        neu = [zeile for zeile in _eintraege(ziel) if zeile.pk != eintrag.pk]
        _parke_eintraege(eintrag.section, ziel)
        _einfuegen(neu, eintrag, payload, "after_entry_uuid")
        if gleicher_abschnitt:
            # Ein Durchlauf, sonst kollidiert die alte 1..n-1-Vergabe mit dem
            # Unique-Constraint auf (section, position).
            _positionen_eintraege(ziel, neu)
        else:
            _positionen_eintraege(eintrag.section, alt)
            _positionen_eintraege(ziel, neu)
        return

    raise UnbekannterBefehl("Unbekannter Befehl.")


def fuehre_befehl_aus(
    *,
    setlist: Setlist,
    user,
    kind: str,
    payload: dict[str, Any],
    command_id: uuid.UUID,
) -> dict:
    if kind not in BEFEHLSAETZE:
        raise UnbekannterBefehl("Unbekannter Befehl.")
    if not isinstance(payload, dict):
        raise BefehlUngueltig("Nutzdaten müssen ein Objekt sein.")
    unterschrift = signatur(kind, payload)
    with transaction.atomic():
        gesperrt = Setlist.objects.select_for_update().get(pk=setlist.pk)
        vorher = SetlistCommand.objects.filter(
            setlist=gesperrt, command_id=command_id
        ).first()
        if vorher is not None:
            if vorher.signature != unterschrift:
                raise NutzdatenKonflikt(
                    "Diese Befehlskennung gehört zu anderen Nutzdaten."
                )
            return vorher.result

        _wende_an(gesperrt, kind, payload)
        gesperrt.refresh_from_db()
        gesperrt.revision += 1
        gesperrt.save(update_fields=["revision", "updated_at"])
        frisch = Setlist.objects.prefetch_related("sections__entries__song").get(
            pk=gesperrt.pk
        )
        from api.serializers import SetlistSerializer

        ergebnis = dict(SetlistSerializer(frisch).data)
        SetlistCommand.objects.create(
            setlist=gesperrt,
            command_id=command_id,
            user=user,
            kind=kind,
            signature=unterschrift,
            result=ergebnis,
        )
        from realtime.services import band_ereignis

        band_ereignis(
            gesperrt.band,
            "setlist.content",
            id=gesperrt.id,
            revision=gesperrt.revision,
        )
    return ergebnis
