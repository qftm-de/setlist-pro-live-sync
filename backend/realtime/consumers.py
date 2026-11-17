"""Autorisierter Band-WebSocket mit getrennten Strömen je Tab."""

from __future__ import annotations

import asyncio
import json
import time

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings

from .mitarbeit import MitarbeitFehler, setlist_befehl, text_update
from .origin import host_aus, origin_gueltig, schema_aus_scope
from .services import bandgruppe, persoenliche_gruppe, zaehler
from .zugriff import origin_aus, zugriff_gueltig, zugriff_mit_sitzung


class BandConsumer(AsyncJsonWebsocketConsumer):
    # Eine Verbindung gehört zu genau einer Band und einem Konto. Die Grenze
    # gilt je Prozess; der Core läuft mit einem Daphne-Prozess.
    _verbindungen: dict[tuple[int, int], int] = {}

    async def connect(self) -> None:
        self.band_id = int(self.scope["url_route"]["kwargs"]["band_id"])
        self.ueberwachung: asyncio.Task | None = None
        if not origin_gueltig(
            origin_aus(self.scope),
            schema_aus_scope(self.scope),
            host_aus(self.scope),
        ):
            await self.close(code=4403)
            return
        konto_id, sitzungs_schluessel = await database_sync_to_async(
            zugriff_mit_sitzung
        )(self.scope, self.band_id)
        if konto_id is None or sitzungs_schluessel is None:
            await self.close(code=4401)
            return
        self.konto_id = konto_id
        self.zeiten: dict[str, list[float]] = {}
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
        from stage.dienste import registriere_verbindung

        try:
            self.stage_verbindung = await database_sync_to_async(
                registriere_verbindung
            )(self.band_id, konto_id, sitzungs_schluessel)
        except Exception:
            self._gib_verbindung_frei()
            await self.close(code=1011)
            return
        await self.accept()
        self.ueberwachung = asyncio.create_task(self._pruefe_regelmaessig())
        await self._sende_bereit()

    async def disconnect(self, code: int) -> None:
        if self.ueberwachung is not None:
            self.ueberwachung.cancel()
            self.ueberwachung = None
        try:
            for gruppe in getattr(self, "gruppen", []):
                try:
                    await self.channel_layer.group_discard(gruppe, self.channel_name)
                except Exception:
                    # Der Verbindungsplatz darf nicht von Redis abhängen.
                    continue
        finally:
            from stage.dienste import schliesse_verbindung

            verbindung = getattr(self, "stage_verbindung", None)
            if verbindung is not None:
                try:
                    await database_sync_to_async(schliesse_verbindung)(verbindung.id)
                except Exception:
                    # Ein Datenbankfehler darf den Verbindungsplatz nicht sperren.
                    pass
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
                "connection": str(self.stage_verbindung.id),
                "counters": await database_sync_to_async(zaehler)(
                    self.band_id, self.konto_id
                ),
            }
        )

    async def _pruefe_regelmaessig(self) -> None:
        while True:
            await asyncio.sleep(settings.REALTIME_CHECK_SECONDS)
            try:
                erlaubt = await self._zugriff_ok()
            except Exception:
                # Fail closed: ein Datenbankfehler ist kein Freibrief.
                await self._schliesse_ohne_recht()
                return
            if not erlaubt:
                await self._schliesse_ohne_recht()
                return
            # Frische serverseitig erneuern: ein gedrosselter oder
            # ausgeschalteter Browser pausiert seine Timer, die Verbindung
            # besteht aber weiter. Sonst verfällt die Leitung nach der TTL.
            verbindung = getattr(self, "stage_verbindung", None)
            if verbindung is not None:
                from stage.dienste import beruehre_verbindung

                try:
                    await database_sync_to_async(beruehre_verbindung)(verbindung.id)
                except Exception:
                    # Ein Datenbankfehler darf die Verbindung nicht beenden.
                    pass

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

    @staticmethod
    def _nutzdaten_ok(nutzdaten: dict) -> bool:
        """Befehlsnutzdaten begrenzen, sonst flutet ein Mitglied den Strom."""
        try:
            return len(json.dumps(nutzdaten, default=str)) <= 16 * 1024
        except (TypeError, ValueError):
            return False

    def _gebremst(self, art: str, grenze: int) -> bool:
        """Mengenbremse je Nachrichtenart: höchstens grenze je 10 Sekunden."""
        jetzt = time.monotonic()
        zeiten = [zeit for zeit in self.zeiten.get(art, []) if jetzt - zeit < 10]
        if len(zeiten) >= grenze:
            self.zeiten[art] = zeiten
            return True
        zeiten.append(jetzt)
        self.zeiten[art] = zeiten
        return False

    async def receive_json(self, content, **kwargs) -> None:
        if not isinstance(content, dict):
            return
        art = content.get("type")
        if art == "text.update":
            update = content.get("update")
            if not isinstance(update, str) or len(update) > 90_000:
                await self.send_json(
                    {
                        "type": "text.error",
                        "status": 400,
                        "detail": "Update ist zu groß.",
                    }
                )
                return
            if self._gebremst(art, 30):
                await self.send_json(
                    {
                        "type": "text.error",
                        "status": 429,
                        "detail": "Zu viele Textupdates.",
                    }
                )
                return
        if art in ("setlist.command", "stage.command"):
            nutzdaten = content.get("payload")
            if not isinstance(nutzdaten, dict):
                # stage.command trägt seine Felder direkt in der Nachricht.
                nutzdaten = {k: v for k, v in content.items() if k != "type"}
            if not self._nutzdaten_ok(nutzdaten):
                await self.send_json(
                    {
                        "type": "command.error",
                        "status": 413,
                        "detail": "Nutzdaten sind zu groß.",
                    }
                )
                return
        if art in ("setlist.command", "stage.command") and self._gebremst(art, 20):
            # Abgelehnte Befehle erzeugen weder Protokollzeile noch Ereignis
            # und kommen nicht bis an die Sitzungssperre.
            await self.send_json(
                {
                    "type": "command.error",
                    "status": 429,
                    "detail": "Zu viele Befehle.",
                }
            )
            return
        if art == "stage.command":
            if not await self._zugriff_ok():
                await self._schliesse_ohne_recht()
                return
            await self._steuere(content)
            return
        if art in ("text.update", "setlist.command"):
            if not await self._zugriff_ok():
                await self._schliesse_ohne_recht()
                return
            dienst = text_update if art == "text.update" else setlist_befehl
            try:
                ergebnis = await database_sync_to_async(dienst)(
                    self.konto_id, self.band_id, content
                )
            except MitarbeitFehler as fehler:
                await self.send_json(
                    {
                        "type": "text.error" if art == "text.update" else "command.error",
                        "status": fehler.status,
                        "detail": fehler.detail,
                        **fehler.daten,
                    }
                )
                return
            await self.send_json(
                {
                    "type": "text.result" if art == "text.update" else "command.result",
                    **ergebnis,
                }
            )
            return
        if art != "ping":
            return
        jetzt = asyncio.get_running_loop().time()
        if self.letzter_ping and jetzt - self.letzter_ping < settings.REALTIME_MIN_PING_SECONDS:
            await self.close(code=4429)
            return
        self.letzter_ping = jetzt
        from stage.dienste import beruehre_verbindung

        try:
            await database_sync_to_async(beruehre_verbindung)(
                self.stage_verbindung.id
            )
        except Exception:
            pass
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

    async def _steuere(self, content: dict) -> None:
        import uuid as uuid_mod

        from stage.dienste import BuehnenFehler, steuere

        session_id = content.get("session_id")
        number = content.get("number")
        try:
            session_id = int(content.get("session_id"))
            generation = int(content.get("generation"))
            number = int(content.get("number"))
            command_id = uuid_mod.UUID(str(content.get("command_id")))
            command = content.get("command")
            ergebnis = await database_sync_to_async(steuere)(
                session_id=session_id,
                konto_id=self.konto_id,
                verbindung_id=self.stage_verbindung.id,
                generation=generation,
                number=number,
                command_id=command_id,
                command=command,
            )
        except BuehnenFehler as fehler:
            await self.send_json(
                {
                    "type": "stage.result",
                    "status": "rejected",
                    "session_id": session_id,
                    "number": number,
                    "reason": fehler.detail,
                    "http": fehler.status,
                }
            )
            return
        except Exception:
            await self.send_json(
                {
                    "type": "stage.result",
                    "status": "unknown",
                    "session_id": session_id,
                    "number": number,
                    "reason": "Der Befehl konnte nicht geprüft werden.",
                }
            )
            return
        await self.send_json({"type": "stage.result", **ergebnis})

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
