"""Instanz-Einladung: Link ohne Band, Konto ohne Mitgliedschaft (R23)."""

from datetime import timedelta
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import Client, TestCase
from django.utils import timezone

from accounts.einladungen import (
    EinladungUngueltigeEingabe,
    erstelle_instanz_einladung,
    token_hash,
)
from accounts.models import InstanzEinladung
from bands.models import Band, Membership

User = get_user_model()

PASSWORT = "testpasswort-1111"


class Basis(TestCase):
    def setUp(self):
        self.betreiber = User.objects.create_user(
            username="betreiber", email="betreiber@example.test", password=PASSWORT
        )
        self.client = Client()

    def einladung(self, **kwargs):
        return erstelle_instanz_einladung(self.betreiber, **kwargs)

    def vorgang(self, token):
        antwort = self.client.get(f"/api/beitritt/{token}/")
        return antwort, antwort.json()

    def registrieren(self, token, client=None, **daten):
        koerper = {
            "mode": "register",
            "username": "neuling",
            "email": "neuling@example.test",
            "password": PASSWORT,
        }
        koerper.update(daten)
        return (client or self.client).post(
            f"/api/beitritt/{token}/accept/",
            data=koerper,
            content_type="application/json",
        )


class Positiv(Basis):
    def test_vorschau_ohne_bandbezug(self):
        einladung, token = self.einladung(note="Für die Nachbarband")
        antwort, daten = self.vorgang(token)
        self.assertEqual(antwort.status_code, 200)
        self.assertEqual(daten["kind"], "instanz")
        self.assertEqual(daten["note"], "Für die Nachbarband")
        self.assertFalse(daten["authenticated"])
        self.assertNotIn("band_name", daten)
        self.assertNotIn(token, antwort.content.decode())
        self.assertNotIn("band", daten)

    def test_registrieren_legt_konto_ohne_band_an(self):
        einladung, token = self.einladung(max_uses=2)
        antwort = self.registrieren(token)
        self.assertEqual(antwort.status_code, 201)
        self.assertTrue(antwort.json()["konto_angelegt"])
        self.assertTrue(User.objects.filter(username="neuling").exists())
        self.assertEqual(Band.objects.count(), 0)
        self.assertEqual(Membership.objects.count(), 0)
        einladung.refresh_from_db()
        self.assertEqual(einladung.uses_count, 1)
        self.assertIsNotNone(einladung.last_used_at)
        self.assertEqual(self.client.get("/api/session/").status_code, 200)

    def test_anmelden_zählt_nicht_hoch(self):
        einladung, token = self.einladung()
        antwort = self.client.post(
            f"/api/beitritt/{token}/accept/",
            data={"mode": "login", "username": "betreiber", "password": PASSWORT},
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 200)
        self.assertFalse(antwort.json()["konto_angelegt"])
        einladung.refresh_from_db()
        self.assertEqual(einladung.uses_count, 0)

    def test_angemeldeter_nutzer_bleibt_unveraendert(self):
        einladung, token = self.einladung()
        self.client.force_login(self.betreiber)
        antwort = self.client.post(
            f"/api/beitritt/{token}/accept/",
            data={},
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 200)
        einladung.refresh_from_db()
        self.assertEqual(einladung.uses_count, 0)

    def test_command_gibt_link_aus_und_speichert_hash(self):
        ausgabe = StringIO()
        call_command(
            "instanz_einladung",
            "--ersteller",
            "betreiber",
            "--basis",
            "https://setlistpro.qftm.de",
            "--tage",
            "3",
            stdout=ausgabe,
        )
        zeilen = ausgabe.getvalue().strip().splitlines()
        link = zeilen[0]
        self.assertTrue(link.startswith("https://setlistpro.qftm.de/beitritt/"))
        rohtoken = link.rsplit("/", 1)[-1]
        self.assertGreaterEqual(len(rohtoken), 43)
        einladung = InstanzEinladung.objects.get()
        self.assertEqual(einladung.token_hash, token_hash(rohtoken))
        self.assertNotEqual(einladung.token_hash, rohtoken)
        self.assertEqual(len(einladung.token_hash), 64)
        self.assertAlmostEqual(
            (einladung.expires_at - timezone.now()).total_seconds(),
            timedelta(days=3).total_seconds(),
            delta=60,
        )

    def test_command_widerruft(self):
        einladung, _ = self.einladung()
        call_command("instanz_einladung", "--widerrufen", str(einladung.pk))
        einladung.refresh_from_db()
        self.assertIsNotNone(einladung.revoked_at)


class Negativ(Basis):
    def test_unbekannter_token_ist_404(self):
        antwort = self.client.get("/api/beitritt/unbekannt/")
        self.assertEqual(antwort.status_code, 404)
        antwort = self.client.post(
            "/api/beitritt/unbekannt/accept/", data={}, content_type="application/json"
        )
        self.assertEqual(antwort.status_code, 404)
        self.assertEqual(InstanzEinladung.objects.count(), 0)

    def test_ungueltiger_token_vor_koerperpruefung_ist_404(self):
        # Ein ungueltiger Link liefert 404, auch wenn der Koerper kaputt ist.
        for koerper in ('kein json', '[1, 2]'):
            antwort = self.client.post(
                "/api/beitritt/unbekannt/accept/",
                data=koerper,
                content_type="application/json",
            )
            self.assertEqual(antwort.status_code, 404, koerper)

    def test_gueltiger_token_mit_kaputtem_koerper_ist_400(self):
        _, token = self.einladung()
        for koerper in ('kein json', '[1, 2]'):
            antwort = self.client.post(
                f"/api/beitritt/{token}/accept/",
                data=koerper,
                content_type="application/json",
            )
            self.assertEqual(antwort.status_code, 400, koerper)

    def test_abgelaufen_widerrufen_ausgeschoepft_ist_404(self):
        einladung, token = self.einladung()
        einladung.expires_at = timezone.now() - timedelta(seconds=1)
        einladung.save(update_fields=["expires_at"])
        self.assertEqual(self.client.get(f"/api/beitritt/{token}/").status_code, 404)

        zweite, token2 = self.einladung()
        zweite.revoked_at = timezone.now()
        zweite.save(update_fields=["revoked_at"])
        self.assertEqual(self.client.get(f"/api/beitritt/{token2}/").status_code, 404)

        dritte, token3 = self.einladung(max_uses=1)
        dritte.uses_count = 1
        dritte.save(update_fields=["uses_count"])
        self.assertEqual(self.client.get(f"/api/beitritt/{token3}/").status_code, 404)

    def test_beitritt_ohne_csrf_ist_403(self):
        _, token = self.einladung()
        ohne = Client(enforce_csrf_checks=True)
        antwort = ohne.post(
            f"/api/beitritt/{token}/accept/",
            data={"mode": "register"},
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 403)

    def test_fehlender_modus_ist_400(self):
        _, token = self.einladung()
        antwort = self.client.post(
            f"/api/beitritt/{token}/accept/", data={}, content_type="application/json"
        )
        self.assertEqual(antwort.status_code, 400)

    def test_falsches_passwort_verraet_nichts(self):
        _, token = self.einladung()
        falsch = self.client.post(
            f"/api/beitritt/{token}/accept/",
            data={"mode": "login", "username": "betreiber", "password": "falschpasswort"},
            content_type="application/json",
        )
        unbekannt = self.client.post(
            f"/api/beitritt/{token}/accept/",
            data={"mode": "login", "username": "gibtsnicht", "password": "falschpasswort"},
            content_type="application/json",
        )
        self.assertEqual(falsch.status_code, 400)
        self.assertEqual(falsch.json(), unbekannt.json())

    def test_registrieren_lehnt_schlechte_eingaben_ab(self):
        einladung, token = self.einladung()
        faelle = [
            {"password": "kurz"},
            {"email": "keine-mail"},
            {"email": ""},
            {"username": ""},
            {"username": "mit leerzeichen"},
        ]
        for fall in faelle:
            antwort = self.registrieren(token, **fall)
            self.assertEqual(antwort.status_code, 400, fall)
        einladung.refresh_from_db()
        self.assertEqual(einladung.uses_count, 0)
        self.assertEqual(User.objects.count(), 1)

    def test_vergebene_namen_werden_abgelehnt(self):
        _, token = self.einladung()
        self.assertEqual(self.registrieren(token).status_code, 201)
        self.assertEqual(
            self.registrieren(
                token, client=Client(), email="andere@example.test"
            ).status_code,
            400,
        )
        self.assertEqual(
            self.registrieren(token, client=Client(), username="neuling2").status_code,
            400,
        )


class Grenzen(Basis):
    def test_letzte_nutzung_und_danach_404(self):
        einladung, token = self.einladung(max_uses=1)
        self.assertEqual(self.registrieren(token).status_code, 201)
        self.assertEqual(
            self.registrieren(token, username="zweiter", email="z@example.test").status_code,
            404,
        )
        self.assertEqual(self.client.get(f"/api/beitritt/{token}/").status_code, 404)

    def test_eingabegrenzen(self):
        with self.assertRaises(EinladungUngueltigeEingabe):
            self.einladung(tage=0)
        with self.assertRaises(EinladungUngueltigeEingabe):
            self.einladung(tage=91)
        with self.assertRaises(EinladungUngueltigeEingabe):
            self.einladung(max_uses=101)
        with self.assertRaises(EinladungUngueltigeEingabe):
            self.einladung(note="x" * 121)
        einladung, _ = self.einladung(tage=90, max_uses=100, note="x" * 120)
        self.assertEqual(einladung.max_uses, 100)

    def test_command_ohne_ersteller_ist_fehler(self):
        with self.assertRaises(CommandError):
            call_command("instanz_einladung", stdout=StringIO())
        with self.assertRaises(CommandError):
            call_command(
                "instanz_einladung", "--ersteller", "fehlt", stdout=StringIO()
            )


class LogRedaktion(TestCase):
    def protokoll(self, text):
        import logging

        from core.log_redaktion import RedigiereEinladungstoken

        eintrag = logging.LogRecord("x", logging.WARNING, "", 0, text, None, None)
        RedigiereEinladungstoken().filter(eintrag)
        return eintrag.getMessage()

    def test_beitritt_token_wird_redigiert(self):
        self.assertEqual(
            self.protokoll("Not Found: /api/beitritt/geheim123/"),
            "Not Found: /api/beitritt/[token]/",
        )
        self.assertEqual(
            self.protokoll("GET /beitritt/abc-xyz?x=1"),
            "GET /beitritt/[token]?x=1",
        )

    def test_bandpfade_bleiben_redigiert(self):
        self.assertEqual(
            self.protokoll("Not Found: /api/invitations/geheim/"),
            "Not Found: /api/invitations/[token]/",
        )
