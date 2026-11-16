"""Lesbare Sitzungsdaten, Aktionen und Snapshot-Serialisierung."""

from __future__ import annotations

from bands.models import Membership

from .fehler import NichtGefunden
from .models import StageCommand, StageConnection, StageEntry, StageSession
from .verbindungen import _frisch


def ist_owner(band, user) -> bool:
    return Membership.objects.filter(
        band=band, user=user, role=Membership.ROLE_OWNER
    ).exists()


def aktive_sitzung(band) -> StageSession | None:
    return StageSession.objects.filter(
        band=band, state=StageSession.ZUSTAND_AKTIV
    ).first()


def sitzung_fuer(band, session_id: int) -> StageSession:
    treffer = StageSession.objects.filter(band=band, id=session_id).first()
    if treffer is None:
        raise NichtGefunden()
    return treffer


def _eintrag_daten(eintrag: StageEntry) -> dict:
    dokument = None
    if eintrag.document_version_id is not None:
        dokument = {
            "version_id": eintrag.document_version_id,
            "page_count": eintrag.page_count,
            "byte_size": eintrag.byte_size,
            "sha256": eintrag.sha256,
        }
    song = None
    if eintrag.entry_type == "song":
        song = {
            "id": eintrag.song_id,
            "title": eintrag.song_title,
            "artist": eintrag.artist,
            "key": eintrag.song_key,
            "bpm": eintrag.bpm,
            "notes": eintrag.notes,
        }
    return {
        "uuid": str(eintrag.uuid),
        "position": eintrag.position,
        "entry_type": eintrag.entry_type,
        "label": eintrag.label,
        "song": song,
        "document": dokument,
    }


def _letzte_nummer(session: StageSession) -> int:
    letzte = (
        StageCommand.objects.filter(
            session=session, generation=session.generation
        )
        .order_by("-number")
        .only("number")
        .first()
    )
    return letzte.number if letzte else 0


def sitzung_daten(session: StageSession, user, verbindung_id=None) -> dict:
    band = session.band
    leader_verbindung = (
        StageConnection.objects.filter(id=session.leader_connection).first()
        if session.leader_connection
        else None
    )
    leader_aktiv = bool(
        leader_verbindung
        and leader_verbindung.closed_at is None
        and leader_verbindung.last_seen >= _frisch()
    )
    aktiv = session.state == StageSession.ZUSTAND_AKTIV
    owner = ist_owner(band, user)
    ist_leitung = session.leader_user_id == user.id
    eigene_verbindung = str(verbindung_id) if verbindung_id else None
    sections = []
    for abschnitt in session.sections.prefetch_related("entries").all():
        sections.append(
            {
                "uuid": str(abschnitt.uuid),
                "name": abschnitt.name,
                "kind": abschnitt.kind,
                "position": abschnitt.position,
                "entries": [_eintrag_daten(eintrag) for eintrag in abschnitt.entries.all()],
            }
        )
    mitglieder = [
        {
            "user_id": eintrag.user_id,
            "display_name": eintrag.user.display_name
            or eintrag.user.get_username(),
        }
        for eintrag in Membership.objects.filter(band=band).select_related("user")
    ]
    return {
        "id": session.id,
        "band_id": session.band_id,
        "state": session.state,
        "generation": session.generation,
        "revision": session.revision,
        "leader_user_id": session.leader_user_id,
        "leader_connection_active": leader_aktiv,
        "last_number": _letzte_nummer(session),
        "current": {
            "entry_uuid": (
                str(session.current_entry_uuid)
                if session.current_entry_uuid
                else None
            ),
            "page": session.current_page,
        },
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "ended_at": session.ended_at.isoformat() if session.ended_at else None,
        "actions": {
            "can_control": bool(
                aktiv
                and ist_leitung
                and leader_aktiv
                and eigene_verbindung
                and str(session.leader_connection) == eigene_verbindung
            ),
            "can_handover": bool(aktiv and ist_leitung),
            "can_takeover": bool(aktiv and owner),
            "can_resume": bool(
                aktiv and ist_leitung and not session.leadership_locked and not leader_aktiv
            ),
            "can_end": bool(aktiv and (ist_leitung or owner)),
        },
        "sections": sections,
        "members": mitglieder,
    }
