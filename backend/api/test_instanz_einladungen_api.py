"""Instanz-Einladungen in der Oberflaeche anlegen und widerrufen (R25)."""

from __future__ import annotations

import json

from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from accounts.models import InstanzEinladung

User = get_user_model()

BETREIBER = {
    "username": "betreiber",
    "email": "betreiber@example.org",
    "password": "testpasswort-1111",
    "is_staff": True,
}


def betreiber() -> User:
    return User.objects.create_user(**BETREIBER)


def normal() -> User:
    return User.objects.create_user(
        username="mitglied", email="mitglied@example.org", password="testpasswort-1111"
    )


def post(client, pfad, koerper):
    return client.post(
        pfad, data=json.dumps(koerper), content_type="application/json"
    )


class Anlegen(TestCase):
    def test_betreiber_legt_einladung_an_und_bekommt_link(self):
        User.objects.create_user(**BETREIBER)
        client = Client()
        client.login(username="betreiber", password="testpasswort-1111")
        antwort = post(
            client, "/api/instanz-einladungen/", {"note": "Band B", "tage": 14}
        )
        self.assertEqual(antwort.status_code, 201)
        daten = antwort.json()
        self.assertTrue(daten["invite_path"].startswith("/beitritt/"))
        self.assertEqual(daten["status"], "active")
        self.assertEqual(daten["note"], "Band B")
        einladung = InstanzEinladung.objects.get()
        self.assertNotEqual(einladung.token_hash, daten["token"])
        self.assertEqual(einladung.created_by.username, "betreiber")

    def test_max_uses_wird_uebernommen(self):
        User.objects.create_user(**BETREIBER)
        client = Client()
        client.login(username="betreiber", password="testpasswort-1111")
        antwort = post(
            client, "/api/instanz-einladungen/", {"note": "", "max_uses": 3}
        )
        self.assertEqual(antwort.status_code, 201)
        self.assertEqual(antwort.json()["max_uses"], 3)

    def test_laufzeit_ausserhalb_der_grenzen_ist_400(self):
        User.objects.create_user(**BETREIBER)
        client = Client()
        client.login(username="betreiber", password="testpasswort-1111")
        antwort = post(client, "/api/instanz-einladungen/", {"tage": 0})
        self.assertEqual(antwort.status_code, 400)
        self.assertEqual(InstanzEinladung.objects.count(), 0)

    def test_laufzeit_als_text_ist_400(self):
        User.objects.create_user(**BETREIBER)
        client = Client()
        client.login(username="betreiber", password="testpasswort-1111")
        antwort = post(client, "/api/instanz-einladungen/", {"tage": "14"})
        self.assertEqual(antwort.status_code, 400)


class Rechte(TestCase):
    def test_band_mitglied_darf_weder_lesen_noch_anlegen(self):
        User.objects.create_user(**BETREIBER)
        normal()
        client = Client()
        client.login(username="mitglied", password="testpasswort-1111")
        self.assertEqual(client.get("/api/instanz-einladungen/").status_code, 403)
        self.assertEqual(
            post(client, "/api/instanz-einladungen/", {"note": "x"}).status_code, 403
        )
        self.assertEqual(InstanzEinladung.objects.count(), 0)

    def test_anonym_wird_abgewiesen(self):
        antwort = Client().get("/api/instanz-einladungen/")
        self.assertIn(antwort.status_code, (401, 403))


class ListeUndWiderruf(TestCase):
    def setUp(self):
        User.objects.create_user(**BETREIBER)
        self.client = Client()
        self.client.login(username="betreiber", password="testpasswort-1111")

    def test_liste_zeigt_angelegte_einladung(self):
        post(self.client, "/api/instanz-einladungen/", {"note": "Band B"})
        antwort = self.client.get("/api/instanz-einladungen/")
        self.assertEqual(antwort.status_code, 200)
        self.assertEqual(len(antwort.json()), 1)
        self.assertEqual(antwort.json()[0]["note"], "Band B")

    def test_widerruf_setzt_status_und_bleibt_widerrufen(self):
        angelegt = post(
            self.client, "/api/instanz-einladungen/", {"note": "Band B"}
        ).json()
        antwort = self.client.delete(
            f"/api/instanz-einladungen/{angelegt['id']}/"
        )
        self.assertEqual(antwort.status_code, 200)
        self.assertEqual(antwort.json()["status"], "revoked")
        zweite = self.client.delete(f"/api/instanz-einladungen/{angelegt['id']}/")
        self.assertEqual(zweite.json()["status"], "revoked")

    def test_widerruf_unbekannter_id_ist_404(self):
        antwort = self.client.delete("/api/instanz-einladungen/999/")
        self.assertEqual(antwort.status_code, 404)
