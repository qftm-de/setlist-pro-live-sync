"""Gemeinsame Schreibdienste über den Band-WebSocket (R14)."""

from __future__ import annotations

import uuid

from django.db import IntegrityError, transaction

from bands.models import Membership
from collaboration.models import TextState
from collaboration.services import EpocheVeraltet, update_anwenden
from collaboration.text import TextFehler, dekodiere, kodiere
from realtime.services import band_ereignis
from setlists.commands import (
    BefehlFehler,
    BefehlUngueltig,
    NachbarFehlt,
    NutzdatenKonflikt,
    UnbekannterBefehl,
    fuehre_befehl_aus,
)
from setlists.models import Entry, Section, Setlist


class MitarbeitFehler(Exception):
    def __init__(self, status: int, detail: str, daten: dict | None = None):
        super().__init__(detail)
        self.status = status
        self.detail = detail
        self.daten = daten or {}


def _mitglied(konto_id: int, band_id: int) -> None:
    if not Membership.objects.filter(band_id=band_id, user_id=konto_id).exists():
        raise MitarbeitFehler(404, "Nicht sichtbar.")


def _textziel(band_id: int, typ: str, kennung, feld: str):
    if typ == TextState.TYP_SETLIST:
        setlist = Setlist.objects.filter(band_id=band_id, uuid=kennung).first()
        if setlist is None or feld != "name":
            return None
        return setlist, setlist.uuid, "name", setlist.name
    if typ == TextState.TYP_SECTION:
        bereich = (
            Section.objects.filter(setlist__band_id=band_id, uuid=kennung)
            .select_related("setlist")
            .first()
        )
        if bereich is None or feld != "name":
            return None
        return bereich.setlist, bereich.uuid, "name", bereich.name
    if typ == TextState.TYP_ENTRY:
        eintrag = (
            Entry.objects.filter(section__setlist__band_id=band_id, uuid=kennung)
            .select_related("section__setlist")
            .first()
        )
        if eintrag is None or feld != "label":
            return None
        return eintrag.section.setlist, eintrag.uuid, "label", eintrag.label
    return None


def text_update(konto_id: int, band_id: int, nachricht: dict) -> dict:
    _mitglied(konto_id, band_id)
    typ = nachricht.get("object_type")
    feld = nachricht.get("field")
    try:
        kennung = uuid.UUID(str(nachricht.get("object_uuid")))
        epoche = int(nachricht.get("epoch"))
    except (TypeError, ValueError) as fehler:
        raise MitarbeitFehler(400, "Felder fehlen.") from fehler
    ziel = _textziel(band_id, typ, kennung, feld)
    if ziel is None:
        raise MitarbeitFehler(409, "Textfeld gehört nicht zu dieser Band.")
    if typ not in (TextState.TYP_SETLIST, TextState.TYP_SECTION, TextState.TYP_ENTRY):
        raise MitarbeitFehler(400, "Unbekannter Feldtyp.")
    setlist, obj_uuid, feld, initial = ziel
    try:
        with transaction.atomic():
            # Sperrreihenfolge wie in ersetze_inhalt: Setlist-Zeile, dann
            # Strukturzeile, dann TextState, sonst Deadlock mit dem PUT.
            gesperrt_setlist = Setlist.objects.select_for_update().get(
                pk=setlist.pk
            )
            if typ == TextState.TYP_SETLIST:
                gesperrt = gesperrt_setlist
            elif typ == TextState.TYP_SECTION:
                gesperrt = Section.objects.select_for_update().get(uuid=obj_uuid)
            else:
                gesperrt = Entry.objects.select_for_update().get(uuid=obj_uuid)
            obj, text = update_anwenden(
                typ, obj_uuid, feld, epoche, dekodiere(nachricht.get("update")), initial
            )
            spalte = "label" if typ == TextState.TYP_ENTRY else "name"
            setattr(gesperrt, spalte, text)
            gesperrt.save(update_fields=[spalte])
            # Textänderungen zählen als Inhaltsänderung, siehe api/setlists.py.
            gesperrt_setlist.revision += 1
            gesperrt_setlist.save(update_fields=["revision", "updated_at"])
            setlist.revision = gesperrt_setlist.revision
            band_ereignis(
                setlist.band,
                "text.updated",
                object_type=obj.object_type,
                object_uuid=str(obj.object_uuid),
                field=obj.field,
                epoch=obj.epoch,
                revision=obj.revision,
                # Empfänger ziehen ihre Revision nach, sonst laufen sie beim
                # nächsten Struktur-Save in ein 409.
                setlist_revision=setlist.revision,
                update=kodiere(bytes(obj.state)),
            )
    except IntegrityError as fehler:
        raise MitarbeitFehler(
            409, "Der Name ist in dieser Band schon vergeben."
        ) from fehler
    except EpocheVeraltet as fehler:
        raise MitarbeitFehler(
            409, str(fehler), {"current_epoch": fehler.current_epoch}
        ) from fehler
    except TextFehler as fehler:
        raise MitarbeitFehler(400, str(fehler)) from fehler
    return {
        "object_type": typ,
        "object_uuid": str(obj_uuid),
        "field": feld,
        "epoch": obj.epoch,
        "revision": obj.revision,
        "setlist_revision": setlist.revision,
        "text": text,
        "update": kodiere(bytes(obj.state)),
    }


def setlist_befehl(konto_id: int, band_id: int, nachricht: dict) -> dict:
    _mitglied(konto_id, band_id)
    try:
        setlist_id = int(nachricht.get("setlist_id"))
        command_id = uuid.UUID(str(nachricht.get("command_id")))
    except (TypeError, ValueError) as fehler:
        raise MitarbeitFehler(400, "Felder fehlen.") from fehler
    from accounts.models import User

    setlist = Setlist.objects.filter(id=setlist_id, band_id=band_id).first()
    if setlist is None:
        raise MitarbeitFehler(404, "Nicht sichtbar.")
    konto = User.objects.filter(pk=konto_id, is_active=True).first()
    if konto is None:
        raise MitarbeitFehler(403, "Kein Zugriff.")
    try:
        return fuehre_befehl_aus(
            setlist=setlist,
            user=konto,
            kind=str(nachricht.get("kind")),
            payload=nachricht.get("payload") or {},
            command_id=command_id,
        )
    except NutzdatenKonflikt as fehler:
        raise MitarbeitFehler(409, str(fehler)) from fehler
    except NachbarFehlt as fehler:
        raise MitarbeitFehler(409, str(fehler)) from fehler
    except (UnbekannterBefehl, BefehlUngueltig, BefehlFehler) as fehler:
        raise MitarbeitFehler(400, str(fehler)) from fehler
