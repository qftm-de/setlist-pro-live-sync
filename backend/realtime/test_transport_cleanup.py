"""Ein ausgefallener Channel-Empfänger darf keine Verbindung belegt lassen."""

import asyncio
from unittest.mock import patch

from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TransactionTestCase, override_settings

from bands.models import Band, Membership
from realtime.consumers import BandConsumer
from realtime.test_consumer import SETTINGS, sitzung_cookie
from stage.models import StageConnection


@override_settings(**SETTINGS, REALTIME_MAX_CONNECTIONS_PER_USER=1)
class TransportCleanupTest(TransactionTestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="transport", email="transport@example.test", password="test-passwort"
        )
        self.band = Band.objects.create(name="Transport", created_by=self.user)
        Membership.objects.create(band=self.band, user=self.user, role="owner")
        self.cookie = sitzung_cookie(self.user)

    def socket(self):
        consumer = BandConsumer()
        socket = WebsocketCommunicator(consumer, "/", headers=[
            (b"host", b"testserver"), (b"origin", b"http://testserver"),
            (b"cookie", self.cookie),
        ])
        socket.scope["url_route"] = {"kwargs": {"band_id": str(self.band.id)}}
        return consumer, socket

    async def test_empfaengerfehler_gibt_platz_und_ueberwachung_frei(self):
        abbruch = asyncio.Event()

        async def defekter_empfang(channel):
            await abbruch.wait()
            raise TimeoutError("Transport unterbrochen")

        consumer, socket = self.socket()
        with patch.object(get_channel_layer(), "receive", side_effect=defekter_empfang):
            verbunden, _ = await socket.connect(timeout=5)
            self.assertTrue(verbunden)
            await socket.receive_json_from(timeout=5)
            ueberwachung = consumer.ueberwachung
            abbruch.set()
            with self.assertRaises(TimeoutError):
                await socket.wait(timeout=5)

        self.assertIsNone(consumer.ueberwachung)
        self.assertTrue(ueberwachung.done())
        self.assertNotIn((self.band.id, self.user.id), BandConsumer._verbindungen)
        offen = await database_sync_to_async(
            StageConnection.objects.filter(closed_at__isnull=True).exists
        )()
        self.assertFalse(offen)

        # Das Limit bleibt bei eins: ein neuer Aufbau muss trotzdem gelingen.
        neu, socket = self.socket()
        verbunden, _ = await socket.connect(timeout=5)
        self.assertTrue(verbunden)
        await socket.receive_json_from(timeout=5)
        await socket.disconnect(timeout=5)
        self.assertIsNone(neu.ueberwachung)
        self.assertNotIn((self.band.id, self.user.id), BandConsumer._verbindungen)


class RedisTimeoutTest(SimpleTestCase):
    async def test_socket_timeout_uebersteigt_blockierenden_empfang(self):
        from channels_redis.core import RedisChannelLayer
        from core.settings import CHANNEL_LAYERS

        layer = RedisChannelLayer(**CHANNEL_LAYERS["default"]["CONFIG"])
        try:
            client = layer.connection(0)
            timeout = client.connection_pool.connection_kwargs["socket_timeout"]
            self.assertGreater(timeout, layer.brpop_timeout)
        finally:
            await layer.close_pools()
