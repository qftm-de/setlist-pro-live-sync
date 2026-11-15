from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.contrib.auth import BACKEND_SESSION_KEY, HASH_SESSION_KEY, SESSION_KEY
from django.contrib.auth import get_user_model
from django.contrib.sessions.backends.db import SessionStore
from django.test import SimpleTestCase, TransactionTestCase, override_settings

from bands.models import Band, Membership
from core.asgi import application
from realtime.origin import origin_gueltig, schema_aus_scope

User = get_user_model()

KANAL = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
ORIGIN = "http://testserver"
SETTINGS = dict(
    CHANNEL_LAYERS=KANAL,
    ALLOWED_HOSTS=["testserver"],
    CSRF_TRUSTED_ORIGINS=[ORIGIN],
    SESSION_COOKIE_NAME="sessionid",
)


def sitzung_cookie(benutzer):
    sitzung = SessionStore()
    sitzung[SESSION_KEY] = str(benutzer.pk)
    sitzung[BACKEND_SESSION_KEY] = "django.contrib.auth.backends.ModelBackend"
    sitzung[HASH_SESSION_KEY] = benutzer.get_session_auth_hash()
    sitzung.save()
    return f"sessionid={sitzung.session_key}".encode()


class OriginTest(SimpleTestCase):
    @override_settings(CSRF_TRUSTED_ORIGINS=[ORIGIN], DEBUG=False)
    def test_exakter_origin(self):
        self.assertTrue(origin_gueltig(ORIGIN, "http", "testserver"))
        self.assertTrue(origin_gueltig(f"{ORIGIN}/", "http", "testserver"))
        self.assertFalse(origin_gueltig(None, "http", "testserver"))
        self.assertFalse(origin_gueltig("", "http", "testserver"))
        self.assertFalse(origin_gueltig("https://testserver", "http", "testserver"))
        self.assertFalse(origin_gueltig("http://testserver:8080", "http", "testserver"))
        self.assertFalse(origin_gueltig("http://fremd.example", "http", "testserver"))
        self.assertFalse(origin_gueltig("http://testserver/pfad", "http", "testserver"))
        self.assertFalse(origin_gueltig("http://testserver:abc", "http", "testserver"))
        self.assertFalse(origin_gueltig("http://testserver:99999", "http", "testserver"))
        self.assertFalse(origin_gueltig("http://[::1", "http", "testserver"))
        self.assertFalse(origin_gueltig(ORIGIN, "http", None))

    @override_settings(
        CSRF_TRUSTED_ORIGINS=[],
        ALLOWED_HOSTS=["band.example"],
        DEBUG=False,
        SECURE_PROXY_SSL_HEADER=("HTTP_X_FORWARDED_PROTO", "https"),
    )
    def test_hinter_dem_proxy_gilt_https(self):
        self.assertTrue(
            origin_gueltig("https://band.example", "https", "band.example")
        )
        self.assertFalse(
            origin_gueltig("http://band.example", "https", "band.example")
        )

    @override_settings(
        CSRF_TRUSTED_ORIGINS=[],
        ALLOWED_HOSTS=["band.example"],
        DEBUG=False,
        SECURE_PROXY_SSL_HEADER=None,
    )
    def test_lokal_gilt_http_mit_port(self):
        self.assertTrue(origin_gueltig("http://band.example", "http", "band.example"))
        self.assertTrue(
            origin_gueltig("http://band.example:8080", "http", "band.example:8080")
        )
        self.assertFalse(
            origin_gueltig("http://band.example:8080", "http", "band.example")
        )
        self.assertFalse(origin_gueltig("https://band.example", "http", "band.example"))
        self.assertFalse(
            origin_gueltig("http://fremd.example:8080", "http", "fremd.example:8080")
        )

    @override_settings(
        CSRF_TRUSTED_ORIGINS=["https://band.example"],
        ALLOWED_HOSTS=["band.example"],
        DEBUG=False,
    )
    def test_trusted_origin_bleibt_exakt(self):
        self.assertTrue(
            origin_gueltig("https://band.example", "https", "band.example")
        )
        self.assertFalse(
            origin_gueltig("https://band.example:8443", "https", "band.example:8443")
        )

    @override_settings(
        CSRF_TRUSTED_ORIGINS=[],
        ALLOWED_HOSTS=[".band.example"],
        DEBUG=False,
    )
    def test_dot_host_erlaubt_subdomains(self):
        self.assertTrue(
            origin_gueltig("http://live.band.example", "http", "live.band.example")
        )
        self.assertFalse(
            origin_gueltig("http://fremd.example", "http", "fremd.example")
        )

    @override_settings(
        SECURE_PROXY_SSL_HEADER=("HTTP_X_FORWARDED_PROTO", "https")
    )
    def test_schema_kommt_aus_dem_proxy_header(self):
        scope = {
            "scheme": "http",
            "headers": [
                (b"x-forwarded-proto", b"https"),
            ],
        }
        self.assertEqual(schema_aus_scope(scope), "https")


@override_settings(**SETTINGS)
class ConsumerTest(TransactionTestCase):
    def setUp(self):
        self.benutzer = User.objects.create_user(
            username="socket", email="socket@example.test", password="geheim-1234"
        )
        self.band = Band.objects.create(name="Socketband", created_by=self.benutzer)
        Membership.objects.create(band=self.band, user=self.benutzer, role="owner")
        self.cookie = sitzung_cookie(self.benutzer)

    def bauen(self, mit_origin=True, cookie=None):
        kopf = [(b"cookie", cookie or self.cookie), (b"host", b"testserver")]
        if mit_origin:
            kopf.append((b"origin", ORIGIN.encode()))
        return WebsocketCommunicator(
            application, f"/ws/bands/{self.band.id}/", headers=kopf
        )

    async def test_ohne_origin_abgelehnt(self):
        communicator = self.bauen(mit_origin=False)
        verbunden, _ = await communicator.connect(timeout=5)
        self.assertFalse(verbunden)

    async def test_fremder_origin_abgelehnt(self):
        communicator = WebsocketCommunicator(
            application,
            f"/ws/bands/{self.band.id}/",
            headers=[
                (b"cookie", self.cookie),
                (b"host", b"testserver"),
                (b"origin", b"http://fremd.example"),
            ],
        )
        verbunden, _ = await communicator.connect(timeout=5)
        self.assertFalse(verbunden)

    async def test_verbindung_liefert_zaehler_und_pong(self):
        communicator = self.bauen()
        verbunden, _ = await communicator.connect(timeout=5)
        self.assertTrue(verbunden)
        bereit = await communicator.receive_json_from()
        self.assertEqual(bereit["type"], "ready")
        self.assertEqual(bereit["counters"], {"band": 0, "personal": 0})
        await communicator.send_json_to({"type": "ping"})
        antwort = await communicator.receive_json_from()
        self.assertEqual(antwort["type"], "pong")
        await communicator.disconnect()

    async def test_nicht_objekt_wird_verworfen(self):
        communicator = self.bauen()
        verbunden, _ = await communicator.connect(timeout=5)
        self.assertTrue(verbunden)
        await communicator.receive_json_from()
        await communicator.send_json_to([1, 2, 3])
        await communicator.send_json_to({"type": "ping"})
        antwort = await communicator.receive_json_from()
        self.assertEqual(antwort["type"], "pong")
        await communicator.disconnect()

    async def test_ohne_mitgliedschaft_abgelehnt(self):
        await database_sync_to_async(
            Membership.objects.filter(band=self.band, user=self.benutzer).delete
        )()
        communicator = self.bauen()
        verbunden, _ = await communicator.connect(timeout=5)
        self.assertFalse(verbunden)

    async def test_gesperrtes_konto_abgelehnt(self):
        self.benutzer.is_active = False
        await database_sync_to_async(self.benutzer.save)(update_fields=["is_active"])
        communicator = self.bauen()
        verbunden, _ = await communicator.connect(timeout=5)
        self.assertFalse(verbunden)

    async def test_rechteentzug_sperrt_auslieferung(self):
        communicator = self.bauen()
        verbunden, _ = await communicator.connect(timeout=5)
        self.assertTrue(verbunden)
        await communicator.receive_json_from()
        await database_sync_to_async(
            Membership.objects.filter(band=self.band, user=self.benutzer).delete
        )()
        await get_channel_layer().group_send(
            f"band.{self.band.id}",
            {
                "type": "event.aus.puffer",
                "strom": "band",
                "seq": 1,
                "ereignis": "song.created",
                "daten": {"id": 1},
            },
        )
        antwort = await communicator.receive_json_from()
        self.assertEqual(antwort, {"type": "closed", "reason": "unauthorized"})
        await communicator.disconnect()

    async def test_passwortwechsel_sperrt_auslieferung(self):
        communicator = self.bauen()
        verbunden, _ = await communicator.connect(timeout=5)
        self.assertTrue(verbunden)
        await communicator.receive_json_from()

        def wechsle():
            self.benutzer.set_password("neues-geheim-5678")
            self.benutzer.save(update_fields=["password"])

        await database_sync_to_async(wechsle)()
        await get_channel_layer().group_send(
            f"band.{self.band.id}",
            {
                "type": "event.aus.puffer",
                "strom": "band",
                "seq": 1,
                "ereignis": "song.created",
                "daten": {"id": 1},
            },
        )
        antwort = await communicator.receive_json_from()
        self.assertEqual(antwort, {"type": "closed", "reason": "unauthorized"})
        await communicator.disconnect()

    async def test_verbindungsgrenze_je_konto_und_band(self):
        offen = []
        for _ in range(20):
            communicator = self.bauen()
            verbunden, _ = await communicator.connect(timeout=5)
            self.assertTrue(verbunden)
            await communicator.receive_json_from()
            offen.append(communicator)
        zuviel = self.bauen()
        verbunden, _ = await zuviel.connect(timeout=5)
        self.assertFalse(verbunden)
        for communicator in offen:
            await communicator.disconnect()

    async def test_ereignis_wird_ausgeliefert(self):
        communicator = self.bauen()
        verbunden, _ = await communicator.connect(timeout=5)
        self.assertTrue(verbunden)
        await communicator.receive_json_from()
        await get_channel_layer().group_send(
            f"band.{self.band.id}",
            {
                "type": "event.aus.puffer",
                "strom": "band",
                "seq": 1,
                "ereignis": "song.created",
                "daten": {"id": 7},
            },
        )
        antwort = await communicator.receive_json_from()
        self.assertEqual(
            antwort,
            {
                "type": "event",
                "stream": "band",
                "seq": 1,
                "event": "song.created",
                "data": {"id": 7},
            },
        )
        await communicator.disconnect()
