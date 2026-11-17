"""Start, Beitritt, Übergabe, Übernahme, Rückkehr und Ende."""

from __future__ import annotations

from django.db import IntegrityError, connection as db_connection, transaction
from django.utils import timezone

from bands.models import Membership
from documents.models import DocumentVersion
from realtime.services import band_ereignis
from setlists.models import Entry, Setlist

from .daten import ist_owner
from .fehler import Konflikt, NichtErlaubt, NichtGefunden
from .models import (
    StageConnection,
    StageEntry,
    StageSection,
    StageSession,
)
from .verbindungen import _eigene_verbindung, _frisch, verbindung_aktiv


def _versionen_je_song(eintraege) -> dict:
    kennungen = set()
    for eintrag in eintraege:
        song = eintrag.song
        dokument = getattr(song, "document", None) if song is not None else None
        if dokument is not None and dokument.active_version_id:
            kennungen.add(dokument.active_version_id)
    vorhanden = {
        version.id: version
        for version in DocumentVersion.objects.filter(id__in=kennungen)
    }
    return {
        eintrag.song_id: vorhanden.get(
            eintrag.song.document.active_version_id
        )
        if eintrag.song is not None
        and getattr(eintrag.song, "document", None) is not None
        else None
        for eintrag in eintraege
    }


def starte_sitzung(
    *,
    band,
    user,
    setlist_id: int,
    verbindung_id,
    session_key: str,
) -> StageSession:
    _eigene_verbindung(band.id, user.id, verbindung_id, session_key)
    eigene_isolation = not db_connection.in_atomic_block
    try:
        with transaction.atomic():
            if eigene_isolation:
                with db_connection.cursor() as cursor:
                    cursor.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
            if StageSession.objects.filter(band=band, state="active").exists():
                raise Konflikt("Es läuft bereits eine Bühnensitzung.")
            setlist = (
                Setlist.objects.filter(band=band, id=setlist_id)
                .prefetch_related("sections__entries__song__document")
                .first()
            )
            if setlist is None:
                raise NichtGefunden()
            sections = list(setlist.sections.all())
            song_eintraege = [
                eintrag
                for abschnitt in sections
                for eintrag in abschnitt.entries.all()
                if eintrag.entry_type == Entry.TYP_SONG and eintrag.song is not None
            ]
            if not song_eintraege:
                raise Konflikt("Eine Bühnensitzung braucht mindestens einen Song.")
            versionen = _versionen_je_song(song_eintraege)
            session = StageSession.objects.create(
                band=band,
                created_by=user,
                leader_user=user,
                leader_connection=verbindung_id,
                generation=1,
                revision=0,
            )
            for abschnitts_index, abschnitt in enumerate(sections, start=1):
                bereich = StageSection.objects.create(
                    session=session,
                    position=abschnitts_index,
                    uuid=abschnitt.uuid,
                    name=abschnitt.name,
                    kind=abschnitt.kind,
                )
                for eintrags_index, eintrag in enumerate(
                    abschnitt.entries.all(), start=1
                ):
                    version = versionen.get(eintrag.song_id)
                    StageEntry.objects.create(
                        session=session,
                        section=bereich,
                        position=eintrags_index,
                        uuid=eintrag.uuid,
                        entry_type=eintrag.entry_type,
                        label=eintrag.label,
                        song_id=eintrag.song_id,
                        song_title=eintrag.song.title if eintrag.song else "",
                        artist=eintrag.song.artist if eintrag.song else "",
                        song_key=eintrag.song.key if eintrag.song else "",
                        bpm=eintrag.song.bpm if eintrag.song else None,
                        notes=eintrag.song.notes if eintrag.song else "",
                        document_version=version,
                        page_count=version.page_count if version else None,
                        byte_size=version.byte_size if version else None,
                        sha256=version.sha256 if version else "",
                    )
            erster = song_eintraege[0]
            erster_snapshot = StageEntry.objects.filter(
                session=session, uuid=erster.uuid
            ).first()
            session.current_entry_uuid = erster.uuid
            session.current_page = (
                1 if erster_snapshot and erster_snapshot.document_version_id else None
            )
            session.save(update_fields=["current_entry_uuid", "current_page"])
            band_ereignis(
                band,
                "stage.started",
                session_id=session.id,
                generation=session.generation,
                revision=session.revision,
            )
        return session
    except IntegrityError as fehler:
        raise Konflikt("Es läuft bereits eine Bühnensitzung.") from fehler


def beitreten(session, user, verbindung_id, session_key) -> None:
    _eigene_verbindung(session.band_id, user.id, verbindung_id, session_key)
    if session.state != StageSession.ZUSTAND_AKTIV:
        raise Konflikt("Die Bühnensitzung ist beendet.")


def uebergebe(session, user, verbindung_id, session_key, ziel_user_id) -> None:
    if session.state != StageSession.ZUSTAND_AKTIV:
        raise Konflikt("Die Bühnensitzung ist beendet.")
    if session.leader_user_id != user.id:
        raise NichtErlaubt("Nur die Leitung darf übergeben.")
    _eigene_verbindung(session.band_id, user.id, verbindung_id, session_key)
    if not Membership.objects.filter(
        band_id=session.band_id, user_id=ziel_user_id
    ).exists():
        raise NichtGefunden("Ziel ist kein Bandmitglied.")
    ziel = (
        StageConnection.objects.filter(
            band_id=session.band_id,
            user_id=ziel_user_id,
            closed_at__isnull=True,
            last_seen__gte=_frisch(),
        )
        .order_by("-last_seen")
        .first()
    )
    if ziel is None:
        raise Konflikt("Das Ziel ist nicht verbunden.")
    with transaction.atomic():
        gesperrt = StageSession.objects.select_for_update().get(pk=session.pk)
        if gesperrt.state != StageSession.ZUSTAND_AKTIV:
            raise Konflikt("Die Bühnensitzung ist beendet.")
        if gesperrt.leader_user_id != user.id:
            raise NichtErlaubt("Nur die Leitung darf übergeben.")
        gesperrt.leader_user_id = ziel_user_id
        gesperrt.leader_connection = ziel.id
        gesperrt.generation += 1
        gesperrt.revision += 1
        gesperrt.save(
            update_fields=[
                "leader_user",
                "leader_connection",
                "generation",
                "revision",
            ]
        )
        band_ereignis(
            gesperrt.band,
            "stage.handover",
            session_id=gesperrt.id,
            generation=gesperrt.generation,
            revision=gesperrt.revision,
        )


def uebernehme(session, user, verbindung_id, session_key) -> None:
    if session.state != StageSession.ZUSTAND_AKTIV:
        raise Konflikt("Die Bühnensitzung ist beendet.")
    if not ist_owner(session.band, user):
        raise NichtErlaubt("Nur ein aktueller Band-Owner darf übernehmen.")
    eigene = _eigene_verbindung(session.band_id, user.id, verbindung_id, session_key)
    if (
        session.leader_user_id == user.id
        and str(session.leader_connection) == str(eigene.id)
    ):
        raise Konflikt("Diese Verbindung leitet bereits.")
    with transaction.atomic():
        gesperrt = StageSession.objects.select_for_update().get(pk=session.pk)
        if gesperrt.state != StageSession.ZUSTAND_AKTIV:
            raise Konflikt("Die Bühnensitzung ist beendet.")
        if not ist_owner(gesperrt.band, user):
            raise NichtErlaubt("Nur ein aktueller Band-Owner darf übernehmen.")
        gesperrt.leader_user_id = user.id
        gesperrt.leader_connection = eigene.id
        gesperrt.generation += 1
        gesperrt.revision += 1
        gesperrt.save(
            update_fields=[
                "leader_user",
                "leader_connection",
                "generation",
                "revision",
            ]
        )
        band_ereignis(
            gesperrt.band,
            "stage.takeover",
            session_id=gesperrt.id,
            generation=gesperrt.generation,
            revision=gesperrt.revision,
        )


def kehre_zurueck(session, user, verbindung_id, session_key) -> None:
    if session.state != StageSession.ZUSTAND_AKTIV:
        raise Konflikt("Die Bühnensitzung ist beendet.")
    if session.leader_user_id != user.id:
        raise NichtErlaubt("Nur die bisherige Leitung darf zurückkehren.")
    eigene = _eigene_verbindung(session.band_id, user.id, verbindung_id, session_key)
    if verbindung_aktiv(session.band_id, session.leader_user_id, session.leader_connection):
        raise Konflikt("Die Leitung ist weiterhin verbunden.")
    with transaction.atomic():
        gesperrt = StageSession.objects.select_for_update().get(pk=session.pk)
        if gesperrt.state != StageSession.ZUSTAND_AKTIV:
            raise Konflikt("Die Bühnensitzung ist beendet.")
        if gesperrt.leader_user_id != user.id:
            raise NichtErlaubt("Nur die bisherige Leitung darf zurückkehren.")
        if verbindung_aktiv(
            gesperrt.band_id, gesperrt.leader_user_id, gesperrt.leader_connection
        ):
            raise Konflikt("Die Leitung ist weiterhin verbunden.")
        gesperrt.leader_connection = eigene.id
        gesperrt.generation += 1
        gesperrt.revision += 1
        gesperrt.save(update_fields=["leader_connection", "generation", "revision"])
        band_ereignis(
            gesperrt.band,
            "stage.resume",
            session_id=gesperrt.id,
            generation=gesperrt.generation,
            revision=gesperrt.revision,
        )


def beende(session, user, verbindung_id, session_key) -> None:
    if session.state != StageSession.ZUSTAND_AKTIV:
        raise Konflikt("Die Bühnensitzung ist bereits beendet.")
    if not (session.leader_user_id == user.id or ist_owner(session.band, user)):
        raise NichtErlaubt("Nur Leitung oder Band-Owner dürfen beenden.")
    _eigene_verbindung(session.band_id, user.id, verbindung_id, session_key)
    with transaction.atomic():
        gesperrt = StageSession.objects.select_for_update().get(pk=session.pk)
        if gesperrt.state != StageSession.ZUSTAND_AKTIV:
            raise Konflikt("Die Bühnensitzung ist bereits beendet.")
        if not (
            gesperrt.leader_user_id == user.id or ist_owner(gesperrt.band, user)
        ):
            raise NichtErlaubt("Nur Leitung oder Band-Owner dürfen beenden.")
        gesperrt.state = StageSession.ZUSTAND_BEENDET
        gesperrt.ended_at = timezone.now()
        gesperrt.generation += 1
        gesperrt.revision += 1
        gesperrt.save(
            update_fields=["state", "ended_at", "generation", "revision"]
        )
        band_ereignis(
            gesperrt.band,
            "stage.ended",
            session_id=gesperrt.id,
            generation=gesperrt.generation,
            revision=gesperrt.revision,
        )
