"""Zähler und Ausgangspuffer. Schreibvorgänge laufen in der Fachtransaktion."""

from __future__ import annotations

from collections.abc import Callable

from datetime import timedelta

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from .models import OutboxEvent, Stream


def strom(band, user=None) -> Stream:
    art = Stream.ART_PERSOENLICH if user is not None else Stream.ART_BAND
    Stream.objects.bulk_create(
        [Stream(band=band, user=user, kind=art)], ignore_conflicts=True
    )
    return Stream.objects.get(band=band, user=user, kind=art)


def emit(stream: Stream, event_type: str, payload: dict | None = None) -> OutboxEvent:
    """Nummer und Ereignis unter Zeilensperre. Gehört in die offene Transaktion."""
    with transaction.atomic():
        Stream.objects.select_for_update().filter(pk=stream.pk).first()
        Stream.objects.filter(pk=stream.pk).update(counter=F("counter") + 1)
        stream.refresh_from_db(fields=["counter"])
        return OutboxEvent.objects.create(
            stream=stream,
            seq=stream.counter,
            event_type=event_type,
            payload=payload or {},
        )


def band_ereignis(band, event_type: str, **daten) -> OutboxEvent:
    return emit(strom(band), event_type, {"band_id": band.id, **daten})


def persoenliches_ereignis(band, user, event_type: str, **daten) -> OutboxEvent:
    return emit(strom(band, user), event_type, {"band_id": band.id, **daten})


def zaehler(band_id: int, user_id: int | None = None) -> dict[str, int]:
    band = (
        Stream.objects.filter(band_id=band_id, kind=Stream.ART_BAND)
        .values_list("counter", flat=True)
        .first()
    )
    persoenlich = 0
    if user_id is not None:
        persoenlich = (
            Stream.objects.filter(
                band_id=band_id, kind=Stream.ART_PERSOENLICH, user_id=user_id
            )
            .values_list("counter", flat=True)
            .first()
            or 0
        )
    return {"band": band or 0, "personal": persoenlich}


def gruppenname(stream: Stream) -> str:
    if stream.kind == Stream.ART_BAND:
        return f"band.{stream.band_id}"
    return f"band.{stream.band_id}.user.{stream.user_id}"


def bandgruppe(band_id: int) -> str:
    return f"band.{band_id}"


def persoenliche_gruppe(band_id: int, user_id: int) -> str:
    return f"band.{band_id}.user.{user_id}"


def verarbeite_offene(
    grenze: int = 100,
    veroeffentliche: Callable[[str, dict], None] | None = None,
) -> tuple[int, int]:
    """Veröffentlicht offene Ereignisse. Mindestens einmal, Duplikate erlaubt."""
    if veroeffentliche is None:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        schicht = get_channel_layer()

        def veroeffentliche(gruppe: str, nachricht: dict) -> None:
            async_to_sync(schicht.group_send)(gruppe, nachricht)

    offen = list(
        OutboxEvent.objects.filter(published_at__isnull=True)
        .select_related("stream")
        .order_by("id")[:grenze]
    )
    veroeffentlicht = 0
    for ereignis in offen:
        nachricht = {
            "type": "event.aus.puffer",
            "strom": ereignis.stream.kind,
            "seq": ereignis.seq,
            "ereignis": ereignis.event_type,
            "daten": ereignis.payload,
        }
        try:
            veroeffentliche(gruppenname(ereignis.stream), nachricht)
        except Exception as fehler:  # noqa: BLE001 - Fehler wird gespeichert, nicht verschluckt
            OutboxEvent.objects.filter(pk=ereignis.pk).update(
                attempts=F("attempts") + 1,
                last_error=str(fehler)[:500],
            )
            continue
        veroeffentlicht += OutboxEvent.objects.filter(
            pk=ereignis.pk, published_at__isnull=True
        ).update(published_at=timezone.now(), last_error="")
    return veroeffentlicht, len(offen)


def raeume_auf(tage: int = 7) -> int:
    """Entfernt nur veröffentlichte Ereignisse jenseits der Aufbewahrung."""
    grenze = timezone.now() - timedelta(days=tage)
    geloescht, _ = OutboxEvent.objects.filter(
        published_at__isnull=False, created_at__lt=grenze
    ).delete()
    return geloescht
