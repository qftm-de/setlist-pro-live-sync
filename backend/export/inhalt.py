"""Daten für den Bandexport. Liest Strukturen, CRDT-Texte und PDF-Verweise."""

from __future__ import annotations

import unicodedata
from datetime import date, datetime, time
from typing import Iterable

from django.db.models import Q
from django.utils import timezone

from annotations.models import Annotation
from collaboration.models import TextState
from collaboration.text import inhalt
from documents.models import Document, DocumentVersion
from documents.storage import AblageFehler, dateipfad
from gigs.models import Gig
from library.models import Song
from setlists.models import Entry, Section, Setlist

FORMAT = "setlist-pro-export"
FORMAT_VERSION = 1


def _zeit(wert: date | datetime | time | None) -> str | None:
    return wert.isoformat() if wert is not None else None


def _dateiname(roh: str, ersatz: str = "dokument.pdf") -> str:
    name = str(roh or "").replace("\\", "/").rsplit("/", 1)[-1]
    name = unicodedata.normalize("NFC", name)
    name = "".join(zeichen for zeichen in name if zeichen >= " " and zeichen != "\x7f")
    name = name.strip().strip(".") or ersatz
    return name[:120]


def _archivpfad(song_id: int, version: DocumentVersion) -> str:
    return f"pdfs/{song_id}/v{version.number:03d}-{_dateiname(version.original_name)}"


def _text_staende_pfad(typ: str, uuid, feld: str) -> tuple[str, str, str]:
    return (typ, str(uuid), feld)


def _lade_text_staende(schluessel: Iterable[tuple[str, str, str]]) -> dict:
    liste = list(schluessel)
    if not liste:
        return {}
    typen = {eintrag[0] for eintrag in liste}
    uuids = {eintrag[1] for eintrag in liste}
    staende = {}
    for stand in TextState.objects.filter(
        object_type__in=typen, object_uuid__in=uuids
    ):
        staende[(stand.object_type, str(stand.object_uuid), stand.field)] = stand
    return staende


def _text(staende: dict, typ: str, uuid, feld: str, ersatz: str) -> str:
    stand = staende.get(_text_staende_pfad(typ, uuid, feld))
    if stand is None:
        return ersatz
    try:
        return inhalt(bytes(stand.state))
    except Exception:  # noqa: BLE001 - ein beschädigter Stand fällt auf die Spalte zurück
        return ersatz


def _dokument_daten(
    songs: list[Song],
    dokumente: dict[int, Document],
    versionen: dict[int, list[DocumentVersion]],
) -> tuple[list[dict], list[dict]]:
    pdfs: list[dict] = []
    daten: list[dict] = []
    for song in songs:
        dokument = dokumente.get(song.id)
        versionen_liste = versionen.get(dokument.id, []) if dokument else []
        eintraege = []
        for version in versionen_liste:
            pfad_im_archiv = _archivpfad(song.id, version)
            pfad = None
            try:
                kandidat = dateipfad(version.file_key)
                if kandidat.is_file():
                    pfad = kandidat
            except AblageFehler:
                pfad = None
            if pfad is not None:
                pdfs.append({"pfad": pfad, "pfad_im_archiv": pfad_im_archiv})
            eintraege.append(
                {
                    "id": version.id,
                    "number": version.number,
                    "original_name": version.original_name,
                    "byte_size": version.byte_size,
                    "page_count": version.page_count,
                    "sha256": version.sha256,
                    "created_at": _zeit(version.created_at),
                    "active": bool(dokument and dokument.active_version_id == version.id),
                    "archive_path": pfad_im_archiv if pfad is not None else None,
                }
            )
        daten.append(
            {
                "id": song.id,
                "title": song.title,
                "artist": song.artist,
                "key": song.key,
                "bpm": song.bpm,
                "notes": song.notes,
                "document": None
                if dokument is None
                else {
                    "id": dokument.id,
                    "revision": dokument.revision,
                    "active_version_id": dokument.active_version_id,
                    "versions": eintraege,
                },
            }
        )
    return daten, pdfs


def _setlist_daten(
    setlists: list[Setlist],
    abschnitte: dict[int, list[Section]],
    eintraege: dict[int, list[Entry]],
    staende: dict,
) -> list[dict]:
    ergebnis = []
    for setlist in setlists:
        eigene_abschnitte = []
        for abschnitt in abschnitte.get(setlist.id, []):
            eigene_eintraege = []
            for eintrag in eintraege.get(abschnitt.id, []):
                eigene_eintraege.append(
                    {
                        "uuid": str(eintrag.uuid),
                        "position": eintrag.position,
                        "entry_type": eintrag.entry_type,
                        "song_id": eintrag.song_id,
                        "duration_seconds": eintrag.duration_seconds,
                        "text": {
                            "label": _text(
                                staende,
                                TextState.TYP_ENTRY,
                                eintrag.uuid,
                                TextState.FELD_LABEL,
                                eintrag.label,
                            )
                        },
                    }
                )
            eigene_abschnitte.append(
                {
                    "uuid": str(abschnitt.uuid),
                    "position": abschnitt.position,
                    "kind": abschnitt.kind,
                    "text": {
                        "name": _text(
                            staende,
                            TextState.TYP_SECTION,
                            abschnitt.uuid,
                            TextState.FELD_NAME,
                            abschnitt.name,
                        )
                    },
                    "entries": eigene_eintraege,
                }
            )
        ergebnis.append(
            {
                "id": setlist.id,
                "uuid": str(setlist.uuid),
                "revision": setlist.revision,
                "created_at": _zeit(setlist.created_at),
                "updated_at": _zeit(setlist.updated_at),
                "text": {
                    "name": _text(
                        staende,
                        TextState.TYP_SETLIST,
                        setlist.uuid,
                        TextState.FELD_NAME,
                        setlist.name,
                    )
                },
                "sections": eigene_abschnitte,
            }
        )
    return ergebnis


def band_export(band, user) -> tuple[dict, list[dict]]:
    """Manifest und PDF-Liste für eine Band, die der Nutzer sehen darf."""
    songs = list(Song.objects.filter(band=band))
    dokumente = {
        dokument.song_id: dokument
        for dokument in Document.objects.filter(song__band=band).select_related(
            "active_version"
        )
    }
    versionen: dict[int, list[DocumentVersion]] = {}
    for version in DocumentVersion.objects.filter(
        document__song__band=band
    ).select_related("document"):
        versionen.setdefault(version.document_id, []).append(version)

    setlists = list(Setlist.objects.filter(band=band))
    abschnitte: dict[int, list[Section]] = {}
    eintraege: dict[int, list[Entry]] = {}
    for abschnitt in Section.objects.filter(setlist__band=band):
        abschnitte.setdefault(abschnitt.setlist_id, []).append(abschnitt)
    for eintrag in Entry.objects.filter(section__setlist__band=band):
        eintraege.setdefault(eintrag.section_id, []).append(eintrag)

    gigs = list(Gig.objects.filter(band=band).select_related("setlist"))
    anmerkungen = list(
        Annotation.objects.filter(document_version__document__song__band=band)
        .filter(
            Q(visibility=Annotation.SICHTBAR_BAND)
            | Q(visibility=Annotation.SICHTBAR_PRIVAT, author=user)
        )
        .select_related("document_version__document")
    )

    schluessel = []
    for setlist in setlists:
        schluessel.append(
            _text_staende_pfad(
                TextState.TYP_SETLIST, setlist.uuid, TextState.FELD_NAME
            )
        )
    for abschnitt in abschnitte.values():
        for eintrag in abschnitt:
            schluessel.append(
                _text_staende_pfad(
                    TextState.TYP_SECTION, eintrag.uuid, TextState.FELD_NAME
                )
            )
    for liste in eintraege.values():
        for eintrag in liste:
            schluessel.append(
                _text_staende_pfad(
                    TextState.TYP_ENTRY, eintrag.uuid, TextState.FELD_LABEL
                )
            )
    for anmerkung in anmerkungen:
        schluessel.append(
            _text_staende_pfad(
                TextState.TYP_ANNOTATION, anmerkung.uuid, TextState.FELD_TEXT
            )
        )
    staende = _lade_text_staende(schluessel)

    song_daten, pdfs = _dokument_daten(songs, dokumente, versionen)

    manifest = {
        "format": FORMAT,
        "version": FORMAT_VERSION,
        "created_at": timezone.now().isoformat(),
        "band": {"id": band.id, "name": band.name},
        "songs": song_daten,
        "setlists": _setlist_daten(setlists, abschnitte, eintraege, staende),
        "gigs": [
            {
                "id": gig.id,
                "title": gig.title,
                "date": _zeit(gig.date),
                "time": _zeit(gig.time),
                "location": gig.location,
                "notes": gig.notes,
                "setlist_uuid": str(gig.setlist.uuid) if gig.setlist else None,
            }
            for gig in gigs
        ],
        "annotations": [
            {
                "uuid": str(anmerkung.uuid),
                "document_version_id": anmerkung.document_version_id,
                "song_id": anmerkung.document_version.document.song_id,
                "author_id": anmerkung.author_id,
                "page_number": anmerkung.page_number,
                "kind": anmerkung.kind,
                "visibility": anmerkung.visibility,
                "geometry": anmerkung.geometry,
                "color": anmerkung.color,
                "font_size": anmerkung.font_size,
                "revision": anmerkung.revision,
                "created_at": _zeit(anmerkung.created_at),
                "updated_at": _zeit(anmerkung.updated_at),
                "text": _text(
                    staende,
                    TextState.TYP_ANNOTATION,
                    anmerkung.uuid,
                    TextState.FELD_TEXT,
                    anmerkung.text,
                ),
            }
            for anmerkung in anmerkungen
        ],
    }
    return manifest, pdfs
