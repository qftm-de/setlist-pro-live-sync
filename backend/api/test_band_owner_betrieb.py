"""Aktiver Owner-Schutz, Betreiber-Wiederherstellung und Einladungs-Admin (R21, R22)."""

from __future__ import annotations

import io
import json

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone

from bands.einladungen import erstelle_einladung, widerrufe_einladung
from bands.models import Band, BandInvitation, Membership
from realtime.models import OutboxEvent

User = get_user_model()


class AktiverOwnerUndBetreiberTest(TestCase):
    def setUp(self):
        self.aktiv = User.objects.create_user(
            username="owner_aktiv",
            email="aktiv@example.test",
            password="geheim-1234",
        )
        self.gesperrt = User.objects.create_user(
            username="owner_gesperrt",
            email="gesperrt@example.test",
            password="geheim-1234",
            is_active=False,
        )
        self.mitglied = User.objects.create_user(
            username="mitglied",
            email="mitglied@example.test",
            password="geheim-1234",
        )
        self.band = Band.objects.create(name="Betriebsband", created_by=self.aktiv)
        self.aktiv_zeile = Membership.objects.create(
            band=self.band, user=self.aktiv, role=Membership.ROLE_OWNER
        )
        self.gesperrt_zeile = Membership.objects.create(
            band=self.band, user=self.gesperrt, role=Membership.ROLE_OWNER
        )
        self.mitglied_zeile = Membership.objects.create(
            band=self.band, user=self.mitglied, role=Membership.ROLE_MEMBER
        )
        self.client = Client()
        self.client.login(username="owner_aktiv", password="geheim-1234")

    def pfad(self, suffix: str = "") -> str:
        return f"/api/bands/{self.band.id}/{suffix}"

    def test_gesperrter_owner_zaehlt_nicht_als_aktiver_owner(self):
        liste = self.client.get(self.pfad("members/")).json()
        eintraege = {eintrag["id"]: eintrag for eintrag in liste}
        self.assertFalse(eintraege[self.aktiv_zeile.id]["can_change_role"])
        self.assertFalse(eintraege[self.aktiv_zeile.id]["can_remove"])
        self.assertTrue(eintraege[self.gesperrt_zeile.id]["can_change_role"])
        self.assertTrue(eintraege[self.gesperrt_zeile.id]["can_remove"])

        herabstufen = self.client.patch(
            self.pfad(f"members/{self.aktiv_zeile.id}/"),
            data=json.dumps({"role": "member"}),
            content_type="application/json",
        )
        self.assertEqual(herabstufen.status_code, 400)

        austritt = self.client.delete(self.pfad(f"members/{self.aktiv_zeile.id}/"))
        self.assertEqual(austritt.status_code, 400)

        entfernen = self.client.delete(
            self.pfad(f"members/{self.gesperrt_zeile.id}/")
        )
        self.assertEqual(entfernen.status_code, 204)
        self.assertFalse(
            Membership.objects.filter(id=self.gesperrt_zeile.id).exists()
        )
        self.assertTrue(
            Membership.objects.filter(
                id=self.aktiv_zeile.id, role=Membership.ROLE_OWNER
            ).exists()
        )

    def test_betreiber_kommando_setzt_neuen_aktiven_owner_und_lehnt_gesperrtes_konto_ab(self):
        self.aktiv.is_active = False
        self.aktiv.save(update_fields=["is_active"])

        with self.assertRaises(CommandError):
            call_command("band_owner_setzen", str(self.band.id), "owner_gesperrt")
        with self.assertRaises(CommandError):
            call_command("band_owner_setzen", "999999", "mitglied")
        with self.assertRaises(CommandError):
            call_command("band_owner_setzen", str(self.band.id), "unbekannt")

        ausgabe = io.StringIO()
        call_command(
            "band_owner_setzen",
            str(self.band.id),
            self.mitglied.username,
            stdout=ausgabe,
        )
        self.mitglied_zeile.refresh_from_db()
        self.assertEqual(self.mitglied_zeile.role, Membership.ROLE_OWNER)
        self.assertTrue(
            OutboxEvent.objects.filter(
                stream__band=self.band, event_type="band.members.updated"
            ).exists()
        )

        neu_client = Client()
        neu_client.login(username="mitglied", password="geheim-1234")
        aufraeumen = neu_client.delete(
            self.pfad(f"members/{self.gesperrt_zeile.id}/")
        )
        self.assertEqual(aufraeumen.status_code, 204)

    def test_betreiber_kommando_nimmt_neues_aktives_konto_als_owner_auf(self):
        extern = User.objects.create_user(
            username="ersatz", email="ersatz@example.test", password="geheim-1234"
        )
        call_command(
            "band_owner_setzen", str(self.band.id), extern.username, stdout=io.StringIO()
        )
        self.assertEqual(
            Membership.objects.get(band=self.band, user=extern).role,
            Membership.ROLE_OWNER,
        )

    def test_admin_kann_keine_einladung_ohne_token_anlegen(self):
        betreiber = User.objects.create_superuser(
            username="betreiber",
            email="betreiber@example.test",
            password="geheim-1234",
        )
        admin_client = Client()
        admin_client.force_login(betreiber)
        antwort = admin_client.post(
            reverse("admin:bands_bandinvitation_add"),
            {
                "band": self.band.id,
                "created_by": self.aktiv.id,
                "note": "Admin-Anlage",
            },
        )
        self.assertEqual(antwort.status_code, 403)
        self.assertEqual(BandInvitation.objects.count(), 0)

    def test_admin_kann_einladung_nicht_aendern_oder_loeschen(self):
        einladung, _ = erstelle_einladung(self.band, self.aktiv, note="Aktiv")
        einladung = widerrufe_einladung(einladung, self.aktiv)
        alter_ablauf = einladung.expires_at
        alter_widerruf = einladung.revoked_at

        betreiber = User.objects.create_superuser(
            username="betreiber2",
            email="betreiber2@example.test",
            password="geheim-1234",
        )
        admin_client = Client()
        admin_client.force_login(betreiber)

        wechsel = reverse("admin:bands_bandinvitation_change", args=[einladung.id])
        ansicht = admin_client.get(wechsel)
        self.assertEqual(ansicht.status_code, 200)
        self.assertNotContains(ansicht, "Speichern")

        neu_ablauf = timezone.now() + timedelta(days=30)
        aendern = admin_client.post(
            wechsel,
            {
                "band": self.band.id,
                "created_by": self.aktiv.id,
                "note": "Manipuliert",
                "expires_at_0": neu_ablauf.date().isoformat(),
                "expires_at_1": "12:00:00",
                "revoked_at_0": "",
                "revoked_at_1": "",
                "uses_count": 0,
                "max_uses": "",
                "_save": "Speichern",
            },
        )
        self.assertEqual(aendern.status_code, 403)

        loeschen = admin_client.post(
            reverse("admin:bands_bandinvitation_delete", args=[einladung.id]),
            {"post": "yes"},
        )
        self.assertEqual(loeschen.status_code, 403)

        sammel = admin_client.post(
            reverse("admin:bands_bandinvitation_changelist"),
            {
                "action": "delete_selected",
                "_selected_action": [einladung.id],
                "post": "yes",
            },
        )
        self.assertIn(sammel.status_code, (200, 403))

        einladung.refresh_from_db()
        self.assertEqual(einladung.expires_at, alter_ablauf)
        self.assertEqual(einladung.revoked_at, alter_widerruf)
        self.assertEqual(einladung.note, "Aktiv")


class BandAdminEreignisTest(TestCase):
    """Bandänderungen im Admin laufen über denselben Ereignispfad wie die API."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username="admin_owner",
            email="admin_owner@example.test",
            password="geheim-1234",
        )
        self.band = Band.objects.create(name="Adminband", created_by=self.owner)
        Membership.objects.create(
            band=self.band, user=self.owner, role=Membership.ROLE_OWNER
        )
        self.betreiber = User.objects.create_superuser(
            username="admin_betreiber",
            email="admin_betreiber@example.test",
            password="geheim-1234",
        )
        self.client.force_login(self.betreiber)
        self.wechsel = reverse("admin:bands_band_change", args=[self.band.id])

    def test_admin_aenderung_erzeugt_band_updated_ereignis(self):
        antwort = self.client.post(
            self.wechsel,
            {
                "name": "Adminband neu",
                "genre": "Rock",
                "location": "",
                "description": "",
                "internal_notes": "",
                "_save": "Speichern",
            },
        )
        self.assertEqual(antwort.status_code, 302)
        self.band.refresh_from_db()
        self.assertEqual(self.band.name, "Adminband neu")
        ereignis = OutboxEvent.objects.get(event_type="band.updated")
        self.assertEqual(ereignis.stream.kind, "band")
        self.assertEqual(ereignis.payload["band_id"], self.band.id)
        self.assertEqual(ereignis.payload["name"], "Adminband neu")

    def test_admin_ohne_aenderung_erzeugt_kein_ereignis(self):
        antwort = self.client.post(
            self.wechsel,
            {
                "name": "Adminband",
                "genre": "",
                "location": "",
                "description": "",
                "internal_notes": "",
                "_save": "Speichern",
            },
        )
        self.assertEqual(antwort.status_code, 302)
        self.assertFalse(OutboxEvent.objects.exists())
