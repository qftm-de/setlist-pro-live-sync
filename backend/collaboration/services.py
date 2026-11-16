"""Datenbankzugriffe für Textzustände und Löschmarken."""

from __future__ import annotations

import hashlib
import uuid

from django.db import transaction

from .models import RemovedId, TextState
from .text import (
    MAX_ZUSTAND_BYTES,
    TextFehler,
    initialzustand,
    kodiere,
    pruefe_laenge,
    wende_update_an,
)


class EpocheVeraltet(TextFehler):
    """Der Text wurde per REST ersetzt. Alte Updates sind ungültig."""

    def __init__(self, detail: str, current_epoch: int | None = None):
        super().__init__(detail)
        self.current_epoch = current_epoch


def _client_id(obj_typ: str, obj_uuid: uuid.UUID, feld: str) -> int:
    roh = f"{obj_typ}:{obj_uuid}:{feld}".encode("utf-8")
    return int.from_bytes(hashlib.sha256(roh).digest()[:6], "big")


def zustand_initial(
    obj_typ: str, obj_uuid: uuid.UUID, feld: str, initial_text: str
) -> TextState:
    """Unsaved Zustand für Lesezugriffe. Kein Schreiben beim Lesen.

    Die Client-ID ist aus dem Feld abgeleitet. So erzeugt derselbe Ausgangstext
    denselben Zustand, auch wenn die Zeile erst beim ersten Update entsteht.
    """
    return TextState(
        object_type=obj_typ,
        object_uuid=obj_uuid,
        field=feld,
        epoch=0,
        revision=0,
        state=initialzustand(initial_text, _client_id(obj_typ, obj_uuid, feld)),
    )


def zustand_lesen(
    obj_typ: str, obj_uuid: uuid.UUID, feld: str, initial_text: str
) -> TextState:
    obj = TextState.objects.filter(
        object_type=obj_typ, object_uuid=obj_uuid, field=feld
    ).first()
    return obj or zustand_initial(obj_typ, obj_uuid, feld, initial_text)


def zustand(obj_typ: str, obj_uuid: uuid.UUID, feld: str, initial_text: str) -> TextState:
    obj, _ = TextState.objects.get_or_create(
        object_type=obj_typ,
        object_uuid=obj_uuid,
        field=feld,
        defaults={
            "state": zustand_initial(obj_typ, obj_uuid, feld, initial_text).state
        },
    )
    return obj


def zustand_daten(obj: TextState) -> dict:
    return {
        "object_type": obj.object_type,
        "object_uuid": str(obj.object_uuid),
        "field": obj.field,
        "epoch": obj.epoch,
        "revision": obj.revision,
        "state": kodiere(bytes(obj.state)),
    }


def epoche_erhoehen(
    obj_typ: str,
    obj_uuid: uuid.UUID,
    feld: str,
    text: str,
) -> TextState:
    """REST-Ersatz: neuer Zustand und neue Epoche. Alte Updates scheitern."""
    with transaction.atomic():
        obj, _ = TextState.objects.select_for_update().get_or_create(
            object_type=obj_typ,
            object_uuid=obj_uuid,
            field=feld,
            defaults={
                "state": zustand_initial(obj_typ, obj_uuid, feld, text).state
            },
        )
        obj.state = initialzustand(text)
        obj.epoch += 1
        obj.revision += 1
        obj.save(update_fields=["state", "epoch", "revision", "updated_at"])
    return obj


def update_anwenden(
    obj_typ: str,
    obj_uuid: uuid.UUID,
    feld: str,
    erwartete_epoche: int,
    update: bytes,
    initial_text: str,
) -> tuple[TextState, str]:
    with transaction.atomic():
        obj, _ = TextState.objects.select_for_update().get_or_create(
            object_type=obj_typ,
            object_uuid=obj_uuid,
            field=feld,
            defaults={
                "state": zustand_initial(
                    obj_typ, obj_uuid, feld, initial_text
                ).state
            },
        )
        if obj.epoch != erwartete_epoche:
            raise EpocheVeraltet("Der Text wurde inzwischen ersetzt.", obj.epoch)
        neu, text = wende_update_an(bytes(obj.state), update)
        # Die Feldgrenze gilt für den Rohtext, sonst umgeht ein Randleerzeichen
        # die Grenze. Gespeichert wird der getrimmte Text in der Spalte.
        pruefe_laenge(feld, text)
        # Beide Wege legen denselben Text in die Spalte: der REST-Weg über
        # DRF (CharField trimmt), der Textweg hier. Ohne diesen Trim erzeugt
        # ein Randleerzeichen beim nächsten Gesamt-PUT einen Epochenwechsel
        # und verwirft die zusammengeführte Arbeit aller Teilnehmer.
        text = text.strip()
        if len(neu) > MAX_ZUSTAND_BYTES:
            raise TextFehler("Der Textzustand ist zu groß.")
        obj.state = neu
        obj.revision += 1
        obj.save(update_fields=["state", "revision", "updated_at"])
    return obj, text


def text_ersetzen(
    obj_typ: str,
    obj_uuid: uuid.UUID,
    feld: str,
    text: str,
) -> TextState:
    with transaction.atomic():
        obj, _ = TextState.objects.select_for_update().get_or_create(
            object_type=obj_typ,
            object_uuid=obj_uuid,
            field=feld,
            defaults={
                "state": zustand_initial(obj_typ, obj_uuid, feld, text).state
            },
        )
        # Neuer Zustand statt setze_text: das Leeren hinterlässt Grabsteine und
        # der Zustand wüchse bei jedem REST-Ersatz. Nach der Epochensperre
        # laden alle Teilnehmer neu, ein frischer Zustand ist hier korrekt.
        neu, inhalt = initialzustand(text), text
        pruefe_laenge(feld, inhalt)
        if len(neu) > MAX_ZUSTAND_BYTES:
            raise TextFehler("Der Textzustand ist zu groß.")
        obj.state = neu
        obj.epoch += 1
        obj.revision += 1
        obj.save(update_fields=["state", "epoch", "revision", "updated_at"])
    return obj


def merke_entfernt(obj_typ: str, obj_uuid: uuid.UUID) -> None:
    RemovedId.objects.get_or_create(object_type=obj_typ, object_uuid=obj_uuid)


def ist_entfernt(obj_typ: str, obj_uuid: uuid.UUID) -> bool:
    return RemovedId.objects.filter(object_type=obj_typ, object_uuid=obj_uuid).exists()
