"""Einzelne Verhaltensfälle für Band-Einstellungen und Mitglieder (R21)."""

import json

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

from bands.models import Band, Membership

User = get_user_model()


class BandVerwaltungFaelle(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner", email="owner@example.test", password="geheim-1234"
        )
        self.mitglied = User.objects.create_user(
            username="mitglied", email="mitglied@example.test", password="geheim-1234"
        )
        self.band = Band.objects.create(name="Die Band", created_by=self.owner)
        Membership.objects.create(
            band=self.band, user=self.owner, role=Membership.ROLE_OWNER
        )
        self.mitglied_zeile = Membership.objects.create(
            band=self.band, user=self.mitglied, role=Membership.ROLE_MEMBER
        )
        self.client = Client()
        self.client.login(username="owner", password="geheim-1234")
        self.mitglied_client = Client()
        self.mitglied_client.login(username="mitglied", password="geheim-1234")

    def band_pfad(self, suffix=""):
        return f"/api/bands/{self.band.id}/{suffix}"

    def patch_band(self, client, daten):
        return client.patch(
            self.band_pfad(),
            data=json.dumps(daten),
            content_type="application/json",
        )

    def test_hochstufen_gibt_owner_rechte(self):
        antwort = self.client.patch(
            self.band_pfad(f"members/{self.mitglied_zeile.id}/"),
            data=json.dumps({"role": "owner"}),
            content_type="application/json",
        )
        self.assertEqual(antwort.status_code, 200)
        detail = self.mitglied_client.get(self.band_pfad())
        self.assertEqual(detail.json()["role"], "owner")
        self.assertTrue(detail.json()["can_manage"])
        geaendert = self.patch_band(self.mitglied_client, {"name": "Neue Band"})
        self.assertEqual(geaendert.status_code, 200)
        self.assertEqual(Band.objects.get(id=self.band.id).name, "Neue Band")

    def test_exakte_feldgrenzen(self):
        self.assertEqual(self.patch_band(self.client, {"name": "x"}).status_code, 200)
        self.assertEqual(
            self.patch_band(self.client, {"name": "x" * 120}).status_code, 200
        )
        self.assertEqual(
            self.patch_band(self.client, {"name": "x" * 121}).status_code, 400
        )
        grenzen = (
            ("genre", 120),
            ("location", 200),
            ("description", 2_000),
            ("internal_notes", 10_000),
        )
        for feld, grenze in grenzen:
            self.assertEqual(
                self.patch_band(self.client, {feld: "x" * grenze}).status_code,
                200,
                feld,
            )
            self.assertEqual(
                self.patch_band(self.client, {feld: "x" * (grenze + 1)}).status_code,
                400,
                feld,
            )

    def test_optionale_felder_duerfen_leer_sein(self):
        gefuellt = {
            "genre": "Rock",
            "location": "Proberaum",
            "description": "Text",
            "internal_notes": "Intern",
        }
        self.assertEqual(self.patch_band(self.client, gefuellt).status_code, 200)
        leer = {feld: "" for feld in gefuellt}
        self.assertEqual(self.patch_band(self.client, leer).status_code, 200)
        frisch = Band.objects.get(id=self.band.id)
        for feld in gefuellt:
            self.assertEqual(getattr(frisch, feld), "", feld)

    def test_entferntes_mitglied_verliert_zugriff_sofort(self):
        antwort = self.client.delete(
            self.band_pfad(f"members/{self.mitglied_zeile.id}/")
        )
        self.assertEqual(antwort.status_code, 204)
        self.assertEqual(self.mitglied_client.get(self.band_pfad()).status_code, 404)
        self.assertEqual(
            self.mitglied_client.get(self.band_pfad("members/")).status_code, 404
        )
        self.assertEqual(
            self.mitglied_client.get(self.band_pfad("sync/")).status_code, 404
        )
        sichtbar = [band["id"] for band in self.mitglied_client.get("/api/bands/").json()]
        self.assertNotIn(self.band.id, sichtbar)
        owner_liste = self.client.get(self.band_pfad("members/")).json()
        self.assertNotIn(self.mitglied_zeile.id, [eintrag["id"] for eintrag in owner_liste])

    def test_teil_patch_erhaelt_uebrige_felder(self):
        self.patch_band(
            self.client,
            {
                "name": "Die Band",
                "genre": "Rock",
                "location": "Proberaum",
                "description": "Text",
                "internal_notes": "Intern",
            },
        )
        antwort = self.patch_band(self.client, {"genre": "Funk"})
        self.assertEqual(antwort.status_code, 200)
        frisch = Band.objects.get(id=self.band.id)
        self.assertEqual(frisch.genre, "Funk")
        self.assertEqual(frisch.name, "Die Band")
        self.assertEqual(frisch.location, "Proberaum")
        self.assertEqual(frisch.description, "Text")
        self.assertEqual(frisch.internal_notes, "Intern")

    def test_mitgliederliste_ohne_email_auch_fuer_owner(self):
        antwort = self.client.get(self.band_pfad("members/"))
        self.assertEqual(antwort.status_code, 200)
        daten = antwort.json()
        for eintrag in daten:
            self.assertNotIn("email", eintrag)
        roh = json.dumps(daten)
        self.assertNotIn("owner@example.test", roh)
        self.assertNotIn("mitglied@example.test", roh)


class AdminSchutzTest(TestCase):
    """Der Standard-Admin darf den Schutz des letzten Owners nicht umgehen."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner", email="owner@example.test", password="geheim-1234"
        )
        self.mitglied = User.objects.create_user(
            username="mitglied", email="mitglied@example.test", password="geheim-1234"
        )
        self.band = Band.objects.create(name="Die Band", created_by=self.owner)
        Membership.objects.create(
            band=self.band, user=self.owner, role=Membership.ROLE_OWNER
        )
        self.mitglied_zeile = Membership.objects.create(
            band=self.band, user=self.mitglied, role=Membership.ROLE_MEMBER
        )
        self.betreiber = User.objects.create_superuser(
            username="betreiber",
            email="betreiber@example.test",
            password="geheim-1234",
        )
        self.client.force_login(self.betreiber)
        self.wechsel = reverse(
            "admin:bands_membership_change", args=[self.mitglied_zeile.id]
        )

    def test_mitgliedschaft_ist_nur_lesbar(self):
        ansicht = self.client.get(self.wechsel)
        self.assertEqual(ansicht.status_code, 200)
        self.assertNotContains(ansicht, "Speichern")

    def test_admin_kann_rolle_nicht_aendern(self):
        antwort = self.client.post(
            self.wechsel,
            {
                "band": self.band.id,
                "user": self.mitglied.id,
                "role": "owner",
                "_save": "Speichern",
            },
        )
        self.assertEqual(antwort.status_code, 403)
        self.mitglied_zeile.refresh_from_db()
        self.assertEqual(self.mitglied_zeile.role, Membership.ROLE_MEMBER)

    def test_admin_kann_mitgliedschaft_nicht_loeschen(self):
        antwort = self.client.post(
            reverse("admin:bands_membership_delete", args=[self.mitglied_zeile.id]),
            {"post": "yes"},
        )
        self.assertEqual(antwort.status_code, 403)
        self.assertTrue(Membership.objects.filter(id=self.mitglied_zeile.id).exists())

    def test_sammelaktion_loescht_nichts(self):
        antwort = self.client.post(
            reverse("admin:bands_membership_changelist"),
            {
                "action": "delete_selected",
                "_selected_action": [self.mitglied_zeile.id, self.owner.id],
                "post": "yes",
            },
        )
        self.assertIn(antwort.status_code, (200, 403))
        self.assertEqual(Membership.objects.filter(band=self.band).count(), 2)

    def test_admin_kann_keine_band_ohne_owner_anlegen(self):
        antwort = self.client.post(
            reverse("admin:bands_band_add"),
            {"name": "Ohne Owner", "created_by": self.owner.id},
        )
        self.assertEqual(antwort.status_code, 403)
        self.assertEqual(Band.objects.count(), 1)

    def test_admin_kann_alleinigen_owner_nicht_als_konto_loeschen(self):
        # Ein später beförderter alleiniger Owner hängt nicht an Band.created_by.
        self.mitglied_zeile.role = Membership.ROLE_OWNER
        self.mitglied_zeile.save(update_fields=["role"])
        Membership.objects.filter(band=self.band, user=self.owner).delete()

        einzeln = self.client.post(
            reverse("admin:accounts_user_delete", args=[self.mitglied.id]),
            {"post": "yes"},
        )
        self.assertEqual(einzeln.status_code, 403)
        sammel = self.client.post(
            reverse("admin:accounts_user_changelist"),
            {
                "action": "delete_selected",
                "_selected_action": [self.mitglied.id],
                "post": "yes",
            },
        )
        self.assertIn(sammel.status_code, (200, 403))
        self.assertTrue(User.objects.filter(id=self.mitglied.id).exists())
        self.assertEqual(
            Membership.objects.filter(band=self.band, role=Membership.ROLE_OWNER).count(),
            1,
        )
