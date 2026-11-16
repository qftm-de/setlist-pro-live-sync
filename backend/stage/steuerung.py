"""Steuerbefehle der Leitung mit Nummern, Generationen und Idempotenz."""

from __future__ import annotations

import hashlib
import json
import uuid

from django.db import transaction

from bands.models import Membership
from realtime.services import band_ereignis

from .fehler import BuehnenFehler, NichtErlaubt, NichtGefunden, Konflikt
from .models import StageCommand, StageEntry, StageSession
from .verbindungen import verbindung_aktiv

BEFEHL_ARTEN = {"goto"}


def _signatur(command: dict) -> str:
    roh = json.dumps(command, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(roh.encode("utf-8")).hexdigest()


def steuere(
    *,
    session_id: int,
    konto_id: int,
    verbindung_id,
    generation: int,
    number: int,
    command_id: uuid.UUID,
    command: dict,
) -> dict:
    session = StageSession.objects.filter(id=session_id).first()
    if session is None:
        raise NichtGefunden()
    if not Membership.objects.filter(
        band_id=session.band_id, user_id=konto_id
    ).exists():
        raise NichtErlaubt()
    verbindung = verbindung_aktiv(session.band_id, konto_id, verbindung_id)
    if verbindung is None:
        raise Konflikt("Die Verbindung ist nicht mehr aktiv.")
    if not isinstance(command, dict) or command.get("kind") not in BEFEHL_ARTEN:
        raise BuehnenFehler(400, "Unbekannter Steuerbefehl.")
    unterschrift = _signatur(command)
    with transaction.atomic():
        gesperrt = StageSession.objects.select_for_update().get(pk=session.pk)

        def abgelehnt(grund: str, nummer=None):
            return _abgelehnt(gesperrt, nummer if nummer is not None else number, grund, command_id)

        if gesperrt.state != StageSession.ZUSTAND_AKTIV:
            return abgelehnt("Die Bühnensitzung ist beendet.")
        if gesperrt.generation != generation:
            return abgelehnt("Die Leitungsgeneration ist veraltet.")
        if (
            gesperrt.leader_user_id != konto_id
            or str(gesperrt.leader_connection) != str(verbindung.id)
        ):
            return abgelehnt("Diese Verbindung leitet nicht.")

        wiederholung = StageCommand.objects.filter(
            session=gesperrt, command_id=command_id
        ).first()
        if wiederholung is not None:
            if wiederholung.signature == unterschrift:
                return wiederholung.result
            return abgelehnt("Befehlskennung mit anderen Daten.")

        letzter = (
            StageCommand.objects.filter(session=gesperrt, generation=generation)
            .order_by("-number")
            .first()
        )
        if letzter is not None:
            if number == letzter.number:
                if letzter.signature == unterschrift:
                    return letzter.result
                return abgelehnt("Nummer mit anderen Daten.")
            if number != letzter.number + 1:
                return abgelehnt("Nummer übersprungen.")
        elif number != 1:
            return abgelehnt("Nummer übersprungen.")

        ziel = StageEntry.objects.filter(
            session=gesperrt, uuid=command.get("entry_uuid"), entry_type="song"
        ).first()
        if ziel is None:
            return abgelehnt("Kein gültiges Songziel.")
        seite = command.get("page")
        if ziel.document_version_id is None:
            if seite not in (None, ""):
                return abgelehnt("Dieser Song hat keine Seiten.")
            seite = None
        else:
            try:
                seite = int(seite)
            except (TypeError, ValueError):
                return abgelehnt("Seite fehlt.")
            if seite < 1 or seite > (ziel.page_count or 0):
                return abgelehnt("Seite liegt außerhalb des Dokuments.")

        gesperrt.current_entry_uuid = ziel.uuid
        gesperrt.current_page = seite
        gesperrt.revision += 1
        gesperrt.save(
            update_fields=["current_entry_uuid", "current_page", "revision"]
        )
        ergebnis = {
            "status": "confirmed",
            "command_id": str(command_id),
            "session_id": gesperrt.id,
            "generation": gesperrt.generation,
            "revision": gesperrt.revision,
            "number": number,
            "current": {
                "entry_uuid": str(ziel.uuid),
                "page": seite,
            },
        }
        StageCommand.objects.create(
            session=gesperrt,
            generation=generation,
            number=number,
            command_id=command_id,
            signature=unterschrift,
            result=ergebnis,
        )
        band_ereignis(
            gesperrt.band,
            "stage.state",
            session_id=gesperrt.id,
            generation=gesperrt.generation,
            revision=gesperrt.revision,
            number=number,
            current=ergebnis["current"],
        )
    return ergebnis


def _abgelehnt(session: StageSession, number, grund: str, command_id=None) -> dict:
    return {
        "status": "rejected",
        "command_id": str(command_id) if command_id else None,
        "session_id": session.id,
        "generation": session.generation,
        "revision": session.revision,
        "number": number,
        "reason": grund,
    }
