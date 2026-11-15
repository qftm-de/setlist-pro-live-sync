"""Autorisierter Band-WebSocket mit getrennten Strömen je Tab."""

from __future__ import annotations

import asyncio

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings

from .origin import origin_gueltig
from .services import bandgruppe, persoenliche_gruppe, zaehler
from .zugriff import origin_aus, zugriff_gueltig


class BandConsumer(AsyncJsonWebsocketConsumer):
    # Eine Verbindung gehört zu genau einer Band und einem Konto. Die Grenze
    # gilt je Prozess; der Core läuft mit einem Daphne-Prozess.
    _verbindungen: dict[tuple[int, int], int] = {}

    async def connect(self) -> None:
        self.band_id = int(self.scope["url_route"]["kwargs"]["band_id"])
        self.ueberwachung: asyncio.Task | None = None
        if not origin_gueltig(origin_aus(self.scope)):
            await self.close(code=4403)
            return
        konto_id = await database_sync_to_async(zugriff_gueltig)(
            self.scope, self.band_id
        )
        if konto_id is None:
            await self.close(code=4401)
            return
        self.konto_id = konto_id
        schluessel = (self.band_id, self.konto_id)
        anzahl = BandConsumer._verbindungen.get(schluessel, 0)
        if anzahl >= settings.REALTIME_MAX_CONNECTIONS_PER_USER:
            await self.close(code=4429)
            return
        BandConsumer._verbindungen[schluessel] = anzahl + 1
        self.verbindungs_schluessel = schluessel
        self.letzter_ping = 0.0
        self.gruppen = [
            bandgruppe(self.band_id),
            persoenliche_gruppe(self.band_id, self.konto_id),
        ]
        try:
            for gruppe in self.gruppen:
                await self.channel_layer.group_add(gruppe, self.channel_name)
        except Exception:
            self._gib_verbindung_frei()
            raise
        await self.accept()
        self.ueberwachung = asyncio.create_task(self._pruefe_regelmaessig())
        await self._sende_bereit()

    async def disconnect(self, code: int) -> None:
        if self.ueberwachung is not None:
            self.ueberwachung.cancel()
            self.ueberwachung = None
        for gruppe in getattr(self, "gruppen", []):
            await self.channel_layer.group_discard(gruppe, self.channel_name)
        self._gib_verbindung_frei()

    def _gib_verbindung_frei(self) -> None:
        schluessel = getattr(self, "verbindungs_schluessel", None)
        if schluessel is None:
            return
        anzahl = BandConsumer._verbindungen.get(schluessel, 1)
        if anzahl <= 1:
            BandConsumer._verbindungen.pop(schluessel, None)
        else:
            BandConsumer._verbindungen[schluessel] = anzahl - 1
        self.verbindungs_schluessel = None

    async def _sende_bereit(self) -> None:
        await self.send_json(
            {
                "type": "ready",
                "band": self.band_id,
                "counters": await database_sync_to_async(zaehler)(
                    self.band_id, self.konto_id
                ),
            }
        )

    async def _pruefe_regelmaessig(self) -> None:
        while True:
            await asyncio.sleep(settings.REALTIME_CHECK_SECONDS)
            if not await self._zugriff_ok():
                await self._schliesse_ohne_recht()
                return

    async def _zugriff_ok(self) -> bool:
        konto_id = await database_sync_to_async(zugriff_gueltig)(
            self.scope, self.band_id
        )
        return konto_id is not None

    async def _schliesse_ohne_recht(self) -> None:
        try:
            await self.send_json({"type": "closed", "reason": "unauthorized"})
        finally:
            await self.close(code=4403)

    async def receive_json(self, content, **kwargs) -> None:
        if content.get("type") != "ping":
            return
        jetzt = asyncio.get_running_loop().time()
        if self.letzter_ping and jetzt - self.letzter_ping < settings.REALTIME_MIN_PING_SECONDS:
            await self.close(code=4429)
            return
        self.letzter_ping = jetzt
        if not await self._zugriff_ok():
            await self._schliesse_ohne_recht()
            return
        await self.send_json(
            {
                "type": "pong",
                "counters": await database_sync_to_async(zaehler)(
                    self.band_id, self.konto_id
                ),
            }
        )

    async def event_aus_puffer(self, event: dict) -> None:
        # Vor jeder Datenauslieferung neu prüfen. Eine offene Verbindung ist
        # keine dauerhafte Berechtigung.
        if not await self._zugriff_ok():
            await self._schliesse_ohne_recht()
            return
        await self.send_json(
            {
                "type": "event",
                "stream": event["strom"],
                "seq": event["seq"],
                "event": event["ereignis"],
                "data": event["daten"],
            }
        )
