import json
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import Client
from django.utils import timezone

from api.test_invitations import Basis
from bands.models import Membership
from realtime.models import OutboxEvent

User = get_user_model()


class BeitrittTest(Basis):
    def test_registrierung_legt_konto_und_mitgliedschaft_an(self):
        einladung, rohtoken = self.neue_einladung()
        antwort = Client().post(
            f"/api/invitations/{rohtoken}/accept/",
            data=json.dumps(
                {
                    "mode": "register",
                    "username": "neu",
                    "display_name": "Neue Nina",
                    "email": "  Neu@Example.Test ",
                    "password": "testpasswort-1111",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 201)
        self.assertTrue(antwort.json()["joined"])
        konto = User.objects.get(username="neu")
        self.assertEqual(konto.email, "neu@example.test")
        self.assertTrue(konto.password.startswith("argon2$"))
        self.assertEqual(
            Membership.objects.get(band=self.band, user=konto).role, "member"
        )
        einladung.refresh_from_db()
        self.assertEqual(einladung.uses_count, 1)
        self.assertTrue(
            OutboxEvent.objects.filter(event_type="band.members.updated").exists()
        )
        self.assertIn("sessionid", antwort.cookies)

    def test_fehlender_anzeigename_kuerzt_den_benutzernamen(self):
        _, rohtoken = self.neue_einladung()
        benutzername = "n" * 150
        antwort = Client().post(
            f"/api/invitations/{rohtoken}/accept/",
            data=json.dumps(
                {
                    "mode": "register",
                    "username": benutzername,
                    "email": "langer-name@example.test",
                    "password": "testpasswort-1111",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 201)
        konto = User.objects.get(username=benutzername)
        self.assertEqual(konto.display_name, "n" * 120)

    def test_ungueltiger_anzeigename_wird_abgelehnt(self):
        _, rohtoken = self.neue_einladung()
        pfad = f"/api/invitations/{rohtoken}/accept/"
        for nummer, anzeigename in enumerate(("z" * 121, 7, ["Name"]), start=1):
            antwort = Client().post(
                pfad,
                data=json.dumps(
                    {
                        "mode": "register",
                        "username": f"gast-{nummer}",
                        "display_name": anzeigename,
                        "email": f"gast-{nummer}@example.test",
                        "password": "testpasswort-1111",
                    }
                ),
                content_type="application/json",
            )
            self.assertEqual(antwort.status_code, 400, anzeigename)
        self.assertFalse(User.objects.filter(username__startswith="gast-").exists())

    def test_login_mit_bestehendem_konto(self):
        _, rohtoken = self.neue_einladung()
        antwort = Client().post(
            f"/api/invitations/{rohtoken}/accept/",
            data=json.dumps(
                {"mode": "login", "username": "fremder", "password": "geheim-1234"}
            ),
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 200)
        self.assertTrue(antwort.json()["joined"])
        self.assertTrue(
            Membership.objects.filter(band=self.band, user=self.fremder).exists()
        )

    def test_angemeldeter_beitritt_ist_idempotent(self):
        einladung, rohtoken = self.neue_einladung()
        pfad = f"/api/invitations/{rohtoken}/accept/"
        erste = self.mitglied_client.post(pfad, data="{}", content_type="application/json")
        self.assertEqual(erste.status_code, 200)
        self.assertFalse(erste.json()["joined"])
        einladung.refresh_from_db()
        self.assertEqual(einladung.uses_count, 0)
        self.assertEqual(
            Membership.objects.filter(band=self.band, user=self.mitglied).count(), 1
        )

    def test_login_fehler_ist_einheitlich(self):
        einladung, rohtoken = self.neue_einladung()
        gesperrt = User.objects.create_user(
            username="gesperrt",
            email="gesperrt@example.test",
            password="geheim-1234",
            is_active=False,
        )
        pfad = f"/api/invitations/{rohtoken}/accept/"
        antworten = []
        for koerper in (
            {"mode": "login", "username": "fremder", "password": "falsch"},
            {"mode": "login", "username": "unbekannt", "password": "egal"},
            {"mode": "login", "username": "gesperrt", "password": "geheim-1234"},
        ):
            antworten.append(
                Client().post(
                    pfad, data=json.dumps(koerper), content_type="application/json"
                )
            )
        for antwort in antworten:
            self.assertEqual(antwort.status_code, 400)
            self.assertEqual(antwort.content, antworten[0].content)
        self.assertNotIn("gesperrt", antworten[0].content.decode())
        einladung.refresh_from_db()
        self.assertEqual(einladung.uses_count, 0)
        self.assertFalse(
            Membership.objects.filter(band=self.band, user=gesperrt).exists()
        )

    def test_registrierung_leht_ungueltige_eingaben_ab(self):
        einladung, rohtoken = self.neue_einladung()
        pfad = f"/api/invitations/{rohtoken}/accept/"
        gueltig = {
            "mode": "register",
            "username": "neu",
            "display_name": "Neu",
            "email": "neu@example.test",
            "password": "testpasswort-1111",
        }
        faelle = [
            {**gueltig, "username": "owner"},
            {**gueltig, "username": "mitglied"},
            {**gueltig, "email": "MITGLIED@example.test"},
            {**gueltig, "email": ""},
            {**gueltig, "email": "keine-mail"},
            {**gueltig, "username": "mit leerzeichen"},
            {**gueltig, "password": "123"},
        ]
        for koerper in faelle:
            antwort = Client().post(
                pfad, data=json.dumps(koerper), content_type="application/json"
            )
            self.assertEqual(antwort.status_code, 400, koerper)
            self.assertEqual(
                Membership.objects.filter(band=self.band).count(), 2
            )
        einladung.refresh_from_db()
        self.assertEqual(einladung.uses_count, 0)

    def test_skalarer_koerper_und_fehlender_modus(self):
        _, rohtoken = self.neue_einladung()
        pfad = f"/api/invitations/{rohtoken}/accept/"
        for koerper in ("nur text", ["register"], "null"):
            antwort = Client().post(
                pfad, data=koerper, content_type="application/json"
            )
            self.assertEqual(antwort.status_code, 400, koerper)
        antwort = Client().post(pfad, data="{}", content_type="application/json")
        self.assertEqual(antwort.status_code, 400)
        self.assertFalse(
            Membership.objects.filter(band=self.band).exclude(
                user__in=[self.owner, self.mitglied]
            ).exists()
        )

    def test_ausgeschoepftes_limit(self):
        einladung, rohtoken = self.neue_einladung(max_uses=1)
        pfad = f"/api/invitations/{rohtoken}/accept/"
        erste = Client().post(
            pfad,
            data=json.dumps(
                {
                    "mode": "register",
                    "username": "eins",
                    "email": "eins@example.test",
                    "password": "testpasswort-1111",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(erste.status_code, 201)
        self.assertEqual(Client().get(f"/api/invitations/{rohtoken}/").status_code, 404)
        zweite = Client().post(
            pfad,
            data=json.dumps(
                {
                    "mode": "register",
                    "username": "zwei",
                    "email": "zwei@example.test",
                    "password": "testpasswort-1111",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(zweite.status_code, 404)
        einladung.refresh_from_db()
        self.assertEqual(einladung.uses_count, 1)

    def test_beitritt_an_der_laufzeitgrenze(self):
        einladung, rohtoken = self.neue_einladung()
        einladung.expires_at = timezone.now() + timedelta(seconds=2)
        einladung.save(update_fields=["expires_at"])
        pfad = f"/api/invitations/{rohtoken}/accept/"
        knapp = Client().post(
            pfad,
            data=json.dumps(
                {
                    "mode": "register",
                    "username": "knapp",
                    "email": "knapp@example.test",
                    "password": "testpasswort-1111",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(knapp.status_code, 201)
        einladung.expires_at = timezone.now()
        einladung.save(update_fields=["expires_at"])
        zu_spaet = Client().post(
            pfad,
            data=json.dumps(
                {
                    "mode": "register",
                    "username": "spaet",
                    "email": "spaet@example.test",
                    "password": "testpasswort-1111",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(zu_spaet.status_code, 404)
        self.assertFalse(User.objects.filter(username="spaet").exists())

    def test_integrity_error_bei_kontoanlage(self):
        einladung, rohtoken = self.neue_einladung()
        with patch(
            "api.invitation_accept.User.objects.create_user",
            side_effect=IntegrityError("doppelt"),
        ):
            antwort = Client().post(
                f"/api/invitations/{rohtoken}/accept/",
                data=json.dumps(
                    {
                        "mode": "register",
                        "username": "doppelt",
                        "email": "doppelt@example.test",
                        "password": "testpasswort-1111",
                    }
                ),
                content_type="application/json",
            )
        self.assertEqual(antwort.status_code, 400)
        einladung.refresh_from_db()
        self.assertEqual(einladung.uses_count, 0)
        self.assertFalse(
            Membership.objects.filter(band=self.band, user__username="doppelt").exists()
        )

    def test_beitritt_ohne_csrf(self):
        _, rohtoken = self.neue_einladung()
        streng = Client(enforce_csrf_checks=True)
        antwort = streng.post(
            f"/api/invitations/{rohtoken}/accept/",
            data=json.dumps({"mode": "login", "username": "x", "password": "y"}),
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 403)


