from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.http import JsonResponse
from django.test import Client, RequestFactory, SimpleTestCase, TestCase, override_settings
from django.urls import path
from django.contrib.auth import get_user_model

from core.config import cookie_secure, load_runtime_config


def sitzung_setzen(request):
    request.session["probe"] = 1
    return JsonResponse({"ok": True})


urlpatterns = [path("test/session/", sitzung_setzen)]

GUELTIGE_ENV = {
    "APP_MODE": "core",
    "DJANGO_SECRET_KEY": "test-schluessel-mit-mindestens-32-zeichen",
    "ALLOWED_HOSTS": "testserver,api,localhost",
    "POSTGRES_HOST": "db",
    "POSTGRES_DB": "setlist",
    "POSTGRES_USER": "setlist",
    "POSTGRES_PASSWORD": "testpasswort",
    "INSTANCE_NAME": "Testband",
    "COMMUNITY_URL": "https://community.example/pinnwand",
    "CSRF_TRUSTED_ORIGINS": "https://pilot.example",
    "TRUST_PROXY_HEADERS": "true",
}


def env(**aenderungen):
    werte = dict(GUELTIGE_ENV)
    for name, wert in aenderungen.items():
        if wert is None:
            werte.pop(name, None)
        else:
            werte[name] = wert
    return werte


class LaufzeitKonfigurationTest(SimpleTestCase):
    def test_gueltige_konfiguration(self):
        konfiguration = load_runtime_config(env())
        self.assertEqual(konfiguration.modus, "core")
        self.assertEqual(konfiguration.instanzname, "Testband")
        self.assertEqual(konfiguration.community_url, "https://community.example/pinnwand")
        self.assertEqual(konfiguration.db_port, "5432")
        self.assertFalse(konfiguration.debug)
        self.assertTrue(konfiguration.trust_proxy_headers)

    def test_modus_fehlt_leer_hub_und_unbekannt(self):
        for wert in (None, "", "hub", "unbekannt"):
            with self.subTest(wert=wert):
                with self.assertRaises(ImproperlyConfigured):
                    load_runtime_config(env(APP_MODE=wert))

    def test_secret_fehlt_oder_ist_zu_kurz(self):
        for wert in (None, "", "kurz"):
            with self.subTest(wert=wert):
                with self.assertRaises(ImproperlyConfigured):
                    load_runtime_config(env(DJANGO_SECRET_KEY=wert))

    def test_datenbankpflichtwerte_fehlen(self):
        for name in (
            "POSTGRES_HOST",
            "POSTGRES_DB",
            "POSTGRES_USER",
            "POSTGRES_PASSWORD",
        ):
            with self.subTest(name=name):
                with self.assertRaises(ImproperlyConfigured):
                    load_runtime_config(env(**{name: None}))

    def test_sqlite_als_host_wird_abgelehnt(self):
        with self.assertRaises(ImproperlyConfigured):
            load_runtime_config(env(POSTGRES_HOST="sqlite"))

    def test_allowed_hosts_pflicht(self):
        with self.assertRaises(ImproperlyConfigured):
            load_runtime_config(env(ALLOWED_HOSTS=""))

    def test_community_url_wird_geprueft(self):
        for wert in (
            "ftp://community.example",
            "community.example",
            "https://nutzer:geheim@community.example",
        ):
            with self.subTest(wert=wert):
                with self.assertRaises(ImproperlyConfigured):
                    load_runtime_config(env(COMMUNITY_URL=wert))
        self.assertIsNone(load_runtime_config(env(COMMUNITY_URL=None)).community_url)
        self.assertEqual(
            load_runtime_config(env(COMMUNITY_URL="http://localhost:9000")).community_url,
            "http://localhost:9000",
        )

    def test_trust_proxy_muss_explizit_sein(self):
        for wert in (None, "", "ja"):
            with self.subTest(wert=wert):
                with self.assertRaises(ImproperlyConfigured):
                    load_runtime_config(env(TRUST_PROXY_HEADERS=wert))

    def test_csrf_origin_ohne_pfad(self):
        for wert in (
            "https://pilot.example/pfad",
            "https://pilot.example/",
            "https://pilot.example?x",
            "https://pilot.example#fragment",
        ):
            with self.subTest(wert=wert):
                with self.assertRaises(ImproperlyConfigured):
                    load_runtime_config(env(CSRF_TRUSTED_ORIGINS=wert))

    def test_cookie_secure_aus_debug_und_proxy_vertrauen(self):
        self.assertTrue(cookie_secure(False, True))
        self.assertFalse(cookie_secure(False, False))
        self.assertFalse(cookie_secure(True, True))
        self.assertFalse(cookie_secure(True, False))

    def test_secret_bleibt_bei_gleicher_konfiguration(self):
        erst = load_runtime_config(env())
        zweit = load_runtime_config(env())
        self.assertEqual(erst.secret_key, zweit.secret_key)

    def test_pdf_grenzen_werden_validiert(self):
        for name in (
            "PDF_MAX_UPLOAD_BYTES",
            "PDF_MAX_PAGES",
            "PDF_CHECK_TIMEOUT_SECONDS",
            "PDF_CHECK_MEMORY_MB",
        ):
            for wert in ("-1", "viele", "1.5"):
                with self.subTest(name=name, wert=wert):
                    with self.assertRaises(ImproperlyConfigured):
                        load_runtime_config(env(**{name: wert}))
        for name in ("PDF_CHECK_TIMEOUT_SECONDS", "PDF_CHECK_MEMORY_MB"):
            with self.subTest(name=name):
                with self.assertRaises(ImproperlyConfigured):
                    load_runtime_config(env(**{name: "0"}))

    def test_pdf_grenzen_null_und_standard(self):
        standard = load_runtime_config(env())
        self.assertEqual(standard.pdf_max_upload_bytes, 20 * 1024 * 1024)
        self.assertEqual(standard.pdf_max_pages, 100)
        aus = load_runtime_config(env(PDF_MAX_UPLOAD_BYTES="0", PDF_MAX_PAGES="0"))
        self.assertEqual(aus.pdf_max_upload_bytes, 0)
        self.assertEqual(aus.pdf_max_pages, 0)


class KonfigurationsEndpunktTest(TestCase):
    def test_liefert_nur_erlaubte_felder(self):
        response = self.client.get("/api/config/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            set(response.json()),
            {"mode", "instance_name", "community_url"},
        )
        self.assertEqual(response.json()["mode"], "core")

    def test_antwort_enthaelt_keine_internen_werte(self):
        response = self.client.get("/api/config/")
        text = response.content.decode("utf-8")
        for wert in (
            settings.SECRET_KEY,
            "POSTGRES",
            "testpasswort",
            "db:5432",
            "SECRET",
        ):
            self.assertNotIn(wert, text)

    def test_sicherheitsheader(self):
        response = self.client.get("/api/config/")
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertEqual(response["X-Frame-Options"], "DENY")
        self.assertEqual(response["Referrer-Policy"], "same-origin")

    def test_fremde_origin_wird_von_csrf_abgewiesen(self):
        client = Client(enforce_csrf_checks=True)
        client.get("/api/config/", secure=True)
        token = client.cookies["csrftoken"].value
        fremd = client.post(
            "/api/config/",
            secure=True,
            HTTP_X_CSRFTOKEN=token,
            HTTP_ORIGIN="https://fremd.example",
        )
        self.assertEqual(fremd.status_code, 403)
        eigene = client.post(
            "/api/config/",
            secure=True,
            HTTP_X_CSRFTOKEN=token,
            HTTP_ORIGIN="https://testserver",
        )
        self.assertEqual(eigene.status_code, 405)

    @override_settings(
        ROOT_URLCONF="api.test_config",
        SESSION_COOKIE_SECURE=False,
        CSRF_COOKIE_SECURE=False,
    )
    def test_session_cookie_ohne_proxy_vertrauen_nicht_secure(self):
        response = self.client.get("/test/session/", secure=False)
        cookie = response.cookies["sessionid"]
        self.assertFalse(cookie["secure"])
        self.assertTrue(cookie["httponly"])

    @override_settings(
        ROOT_URLCONF="api.test_config",
        SESSION_COOKIE_SECURE=True,
        CSRF_COOKIE_SECURE=True,
    )
    def test_session_cookie_mit_tls_proxy_ist_secure(self):
        response = self.client.get("/test/session/", secure=True)
        cookie = response.cookies["sessionid"]
        self.assertTrue(cookie["secure"])
        self.assertTrue(cookie["httponly"])

    def test_cookie_secure_haengt_am_proxy_vertrauen(self):
        from core import settings as core_settings

        erwartet = not core_settings.DEBUG and core_settings.konfiguration.trust_proxy_headers
        self.assertEqual(core_settings.SESSION_COOKIE_SECURE, erwartet)
        self.assertEqual(core_settings.CSRF_COOKIE_SECURE, erwartet)


class SitzungTest(TestCase):
    def test_anonymer_zugriff_wird_abgewiesen(self):
        response = self.client.get("/api/session/")
        self.assertEqual(response.status_code, 401)

    def test_angemeldete_sitzung_liefert_konto(self):
        konto = get_user_model().objects.create_user(
            username="betreiber", email="betreiber@example.test", password="testpasswort-mit-laenge"
        )
        self.client.force_login(konto)
        response = self.client.get("/api/session/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["username"], "betreiber")


class ProxyVertrauenTest(SimpleTestCase):
    @override_settings(SECURE_PROXY_SSL_HEADER=None)
    def test_unvertrauter_proxy_header_zaehlt_nicht(self):
        request = RequestFactory().get("/", HTTP_X_FORWARDED_PROTO="https")
        self.assertFalse(request.is_secure())

    @override_settings(SECURE_PROXY_SSL_HEADER=("HTTP_X_FORWARDED_PROTO", "https"))
    def test_vertrauter_proxy_header_zaehlt(self):
        request = RequestFactory().get("/", HTTP_X_FORWARDED_PROTO="https")
        self.assertTrue(request.is_secure())
