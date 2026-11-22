"""Einzelne Verhaltensfälle für Einladungslinks (R22)."""

import json
import re
from datetime import datetime, timedelta, timezone as dt_timezone
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.utils import timezone

from bands.einladungen import erstelle_einladung, token_hash, widerrufe_einladung
from bands.models import Band, BandInvitation, Membership

User = get_user_model()


class EinladungFaelle(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner", email="owner@example.test", password="geheim-1234"
        )
        self.band = Band.objects.create(name="Die Band", created_by=self.owner)
        Membership.objects.create(
            band=self.band, user=self.owner, role=Membership.ROLE_OWNER
        )

    def neue_einladung(self, **felder):
        return erstelle_einladung(self.band, self.owner, **felder)

    def beitreten(self, token, nummer):
        return Client().post(
            f"/api/invitations/{token}/accept/",
            data=json.dumps(
                {
                    "mode": "register",
                    "username": f"gast{nummer}",
                    "email": f"gast{nummer}@example.test",
                    "password": "testpasswort-1111",
                }
            ),
            content_type="application/json",
        )

    def test_token_format_entropie_und_einmaligkeit(self):
        erste, token1 = self.neue_einladung()
        zweite, token2 = self.neue_einladung()
        self.assertNotEqual(token1, token2)
        for einladung, token in ((erste, token1), (zweite, token2)):
            self.assertGreaterEqual(len(token), 43)
            self.assertRegex(token, r"^[A-Za-z0-9_-]+$")
            gespeichert = BandInvitation.objects.get(id=einladung.id)
            self.assertEqual(len(gespeichert.token_hash), 64)
            self.assertRegex(gespeichert.token_hash, r"^[0-9a-f]{64}$")
            self.assertEqual(gespeichert.token_hash, token_hash(token))
            self.assertNotEqual(gespeichert.token_hash, token)

    def test_laufzeit_liegt_exakt_48_stunden_ab_erstellung(self):
        fest = datetime(2026, 11, 22, 9, 30, tzinfo=dt_timezone.utc)
        with patch("bands.einladungen.timezone.now", return_value=fest):
            einladung, _ = self.neue_einladung()
        frisch = BandInvitation.objects.get(id=einladung.id)
        self.assertEqual(frisch.expires_at, fest + timedelta(hours=48))
        self.assertEqual(
            frisch.expires_at - frisch.created_at, timedelta(hours=48)
        )

    def test_widerruf_nutzt_den_frischen_datenbankstand(self):
        einladung, _ = self.neue_einladung()
        BandInvitation.objects.filter(pk=einladung.pk).update(
            uses_count=3, last_used_at=timezone.now()
        )
        frisch = widerrufe_einladung(einladung, self.owner)
        self.assertEqual(frisch.uses_count, 3)
        self.assertIsNotNone(frisch.last_used_at)
        self.assertIsNotNone(frisch.revoked_at)

    def test_schwaches_passwort_verraet_kein_konto(self):
        _, rohtoken = self.neue_einladung()
        pfad = f"/api/invitations/{rohtoken}/accept/"
        antworten = []
        for benutzername, email in (
            ("owner", "frei@example.test"),
            ("frei", "owner@example.test"),
        ):
            antworten.append(
                Client().post(
                    pfad,
                    data=json.dumps(
                        {
                            "mode": "register",
                            "username": benutzername,
                            "email": email,
                            "password": "x",
                        }
                    ),
                    content_type="application/json",
                )
            )
        self.assertEqual([antwort.status_code for antwort in antworten], [400, 400])
        self.assertEqual(antworten[0].content, antworten[1].content)
        self.assertFalse(User.objects.filter(username="frei").exists())

    def test_unbegrenztes_limit_erlaubt_mehrere_beitritte(self):
        einladung, token = self.neue_einladung(max_uses=None)
        for nummer in range(1, 4):
            antwort = self.beitreten(token, nummer)
            self.assertEqual(antwort.status_code, 201, nummer)
            self.assertTrue(antwort.json()["joined"])
        einladung.refresh_from_db()
        self.assertIsNone(einladung.max_uses)
        self.assertEqual(einladung.uses_count, 3)
        self.assertEqual(
            Membership.objects.filter(band=self.band).count(), 4
        )
        self.assertEqual(Client().get(f"/api/invitations/{token}/").status_code, 200)

    def test_unicode_benutzername_bleibt_nach_abmeldung_anmeldbar(self):
        _, token = self.neue_einladung()
        rohname = "ba\ufb01nd"
        zweite_band = Band.objects.create(name="Zweitband", created_by=self.owner)
        Membership.objects.create(
            band=zweite_band, user=self.owner, role=Membership.ROLE_OWNER
        )
        _, zweit_token = erstelle_einladung(zweite_band, self.owner)

        client = Client()
        registriert = client.post(
            f"/api/invitations/{token}/accept/",
            data=json.dumps(
                {
                    "mode": "register",
                    "username": rohname,
                    "email": "unicode@example.test",
                    "password": "testpasswort-1111",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(registriert.status_code, 201)
        client.post("/api/abmeldung/")

        normal = client.post(
            "/api/anmeldung/",
            data=json.dumps({"username": rohname, "password": "testpasswort-1111"}),
            content_type="application/json",
        )
        self.assertEqual(normal.status_code, 200)
        client.post("/api/abmeldung/")

        einladung_login = client.post(
            f"/api/invitations/{zweit_token}/accept/",
            data=json.dumps(
                {
                    "mode": "login",
                    "username": rohname,
                    "password": "testpasswort-1111",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(einladung_login.status_code, 200)
        self.assertTrue(einladung_login.json()["joined"])
