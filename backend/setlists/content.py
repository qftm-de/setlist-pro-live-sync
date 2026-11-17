"""Inhalt einer Setlist als Ganzes ersetzen.

Ein Aufruf, eine Transaktion. Abschnitte und Einträge werden über ihre UUID
abgeglichen. Positionen ergeben sich aus der Reihenfolge der Eingabe.
"""

from __future__ import annotations

import uuid

from django.db import transaction

from collaboration.models import TextState
from collaboration.services import epoche_erhoehen, ist_entfernt, merke_entfernt

from .models import Entry, Section, Setlist

PARK = 1_000_000
# Dieselben Grenzen gelten im Gesamt-PUT und im Befehlspfad.
MAX_ABSCHNITTE = 50
MAX_EINTRAEGE = 200


class RevisionFehlt(Exception):
    """Der Aufrufer hat keine Entwurfsrevision mitgeschickt."""


class RevisionKonflikt(Exception):
    """Der gespeicherte Stand ist neuer als der Entwurf."""


class UnbekannteId(Exception):
    """Eine UUID gehört nicht zu dieser Setlist."""


class DoppelteId(Exception):
    """Dieselbe UUID kommt im Aufruf mehrfach vor."""


class EntfernteId(Exception):
    """Eine gelöschte UUID darf nicht wiederverwendet werden."""


def _parken(setlist: Setlist) -> None:
    for abschnitt in Section.objects.filter(setlist=setlist).only("id"):
        Section.objects.filter(pk=abschnitt.pk).update(position=PARK + abschnitt.pk)
    for eintrag in Entry.objects.filter(section__setlist=setlist).only("id"):
        Entry.objects.filter(pk=eintrag.pk).update(position=PARK + eintrag.pk)


def _vorpruefen(abschnitte, vorhandene_abschnitte, vorhandene_eintraege) -> None:
    gesehen_abschnitte: set[uuid.UUID] = set()
    gesehen_eintraege: set[uuid.UUID] = set()
    for abschnitt in abschnitte:
        kennung = abschnitt.get("uuid")
        if kennung is not None:
            if kennung in gesehen_abschnitte:
                raise DoppelteId("Abschnitt-UUID kommt mehrfach vor.")
            if kennung not in vorhandene_abschnitte:
                raise UnbekannteId("Abschnitt-UUID gehört nicht zu dieser Setlist.")
            if ist_entfernt(TextState.TYP_SECTION, kennung):
                raise EntfernteId("Dieser Abschnitt wurde gelöscht.")
            gesehen_abschnitte.add(kennung)
        for eintrag in abschnitt.get("entries", []):
            eintrags_id = eintrag.get("uuid")
            if eintrags_id is None:
                continue
            if eintrags_id in gesehen_eintraege:
                raise DoppelteId("Eintrags-UUID kommt mehrfach vor.")
            if eintrags_id not in vorhandene_eintraege:
                raise UnbekannteId("Eintrags-UUID gehört nicht zu dieser Setlist.")
            if ist_entfernt(TextState.TYP_ENTRY, eintrags_id):
                raise EntfernteId("Dieser Eintrag wurde gelöscht.")
            gesehen_eintraege.add(eintrags_id)


def ersetze_inhalt(
    setlist: Setlist, abschnitte, erwartete_revision: int | None
) -> Setlist:
    if erwartete_revision is None:
        raise RevisionFehlt("Erwartete Revision fehlt.")
    with transaction.atomic():
        gesperrt = Setlist.objects.select_for_update().get(pk=setlist.pk)
        if gesperrt.revision != erwartete_revision:
            raise RevisionKonflikt("Die Setlist wurde inzwischen geändert.")

        vorhandene_abschnitte = {zeile.uuid: zeile for zeile in gesperrt.sections.all()}
        vorhandene_eintraege = {
            zeile.uuid: zeile
            for zeile in Entry.objects.filter(section__setlist=gesperrt).select_related(
                "section"
            )
        }
        _vorpruefen(abschnitte, vorhandene_abschnitte, vorhandene_eintraege)
        _parken(gesperrt)

        gesehen_abschnitte: set[uuid.UUID] = set()
        gesehen_eintraege: set[uuid.UUID] = set()
        temporaer = PARK * 2
        reihenfolge_abschnitte: list[Section] = []
        reihenfolge_eintraege: dict[int, list[Entry]] = {}

        for abschnitts_index, abschnitt in enumerate(abschnitte, start=1):
            kennung = abschnitt.get("uuid")
            if kennung is not None:
                bereich = vorhandene_abschnitte[kennung]
                if bereich.name != abschnitt.get("name", ""):
                    epoche_erhoehen(
                        TextState.TYP_SECTION,
                        kennung,
                        "name",
                        abschnitt.get("name", ""),
                    )
                bereich.name = abschnitt.get("name", "")
                bereich.kind = abschnitt["kind"]
                bereich.save(update_fields=["name", "kind"])
            else:
                temporaer += 1
                bereich = Section.objects.create(
                    setlist=gesperrt,
                    uuid=uuid.uuid4(),
                    name=abschnitt.get("name", ""),
                    kind=abschnitt["kind"],
                    position=temporaer,
                )
            gesehen_abschnitte.add(bereich.uuid)
            reihenfolge_abschnitte.append(bereich)

            eintragsliste: list[Entry] = []
            for eintrag in abschnitt.get("entries", []):
                eintrags_id = eintrag.get("uuid")
                if eintrags_id is not None:
                    zeile = vorhandene_eintraege[eintrags_id]
                    neues_label = eintrag.get("label", "")
                    if zeile.label != neues_label:
                        epoche_erhoehen(
                            TextState.TYP_ENTRY,
                            eintrags_id,
                            "label",
                            neues_label,
                        )
                    zeile.section = bereich
                    zeile.entry_type = eintrag["entry_type"]
                    zeile.song = eintrag.get("song")
                    zeile.label = neues_label
                    zeile.duration_seconds = eintrag.get("duration_seconds")
                    # Position nicht mitschreiben: sie ist geparkt und wird
                    # unten gesammelt auf 1..n gesetzt. Sonst kollidiert ein
                    # Abschnittswechsel mit dem Unique-Constraint.
                    zeile.save(
                        update_fields=[
                            "section",
                            "entry_type",
                            "song",
                            "label",
                            "duration_seconds",
                        ]
                    )
                else:
                    temporaer += 1
                    zeile = Entry.objects.create(
                        section=bereich,
                        uuid=uuid.uuid4(),
                        position=temporaer,
                        entry_type=eintrag["entry_type"],
                        song=eintrag.get("song"),
                        label=eintrag.get("label", ""),
                        duration_seconds=eintrag.get("duration_seconds"),
                    )
                gesehen_eintraege.add(zeile.uuid)
                eintragsliste.append(zeile)
            reihenfolge_eintraege[bereich.pk] = eintragsliste

        # Ausgelassene Zeilen entfernen und als gelöscht merken.
        for kennung in set(vorhandene_eintraege) - gesehen_eintraege:
            merke_entfernt(TextState.TYP_ENTRY, kennung)
        for kennung in set(vorhandene_abschnitte) - gesehen_abschnitte:
            zeile = vorhandene_abschnitte[kennung]
            merke_entfernt(TextState.TYP_SECTION, kennung)
            for eintrag in Entry.objects.filter(section=zeile):
                merke_entfernt(TextState.TYP_ENTRY, eintrag.uuid)
            zeile.delete()
        Entry.objects.filter(section__setlist=gesperrt).exclude(
            uuid__in=gesehen_eintraege
        ).delete()

        # Zweite Phase: endgültige Positionen 1..n aus der Eingabereihenfolge.
        for index, bereich in enumerate(reihenfolge_abschnitte, start=1):
            Section.objects.filter(pk=bereich.pk).update(position=index)
        for bereich in reihenfolge_abschnitte:
            for index, zeile in enumerate(reihenfolge_eintraege[bereich.pk], start=1):
                Entry.objects.filter(pk=zeile.pk).update(position=index)

        gesperrt.revision += 1
        gesperrt.save(update_fields=["revision", "updated_at"])

    return Setlist.objects.prefetch_related("sections__entries__song").get(pk=setlist.pk)
