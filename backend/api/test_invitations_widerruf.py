from datetime import timedelta

from django.test import Client
from django.utils import timezone

from api.test_invitations import Basis


class WiderrufTest(Basis):
    def test_widerruf_idempotent_und_bei_abgelaufen(self):
        einladung, rohtoken = self.neue_einladung()
        pfad = f"/api/bands/{self.band.id}/invitations/{einladung.id}/"
        erste = self.client.delete(pfad)
        self.assertEqual(erste.status_code, 200)
        erster_zeitpunkt = erste.json()["revoked_at"]
        zweite = self.client.delete(pfad)
        self.assertEqual(zweite.status_code, 200)
        self.assertEqual(zweite.json()["revoked_at"], erster_zeitpunkt)
        self.assertEqual(Client().get(f"/api/invitations/{rohtoken}/").status_code, 404)

        abgelaufen, token2 = self.neue_einladung()
        abgelaufen.expires_at = timezone.now() - timedelta(hours=1)
        abgelaufen.save(update_fields=["expires_at"])
        antwort = self.client.delete(
            f"/api/bands/{self.band.id}/invitations/{abgelaufen.id}/"
        )
        self.assertEqual(antwort.status_code, 200)
        self.assertIsNotNone(antwort.json()["revoked_at"])

    def test_normales_mitglied_darf_nicht_widerrufen(self):
        einladung, _ = self.neue_einladung()
        antwort = self.mitglied_client.delete(
            f"/api/bands/{self.band.id}/invitations/{einladung.id}/"
        )
        self.assertEqual(antwort.status_code, 403)

    def test_schreiben_ohne_csrf(self):
        streng = Client(enforce_csrf_checks=True)
        streng.login(username="owner", password="geheim-1234")
        self.assertEqual(
            streng.post(
                self.listen_pfad(), data="{}", content_type="application/json"
            ).status_code,
            403,
        )
        einladung, _ = self.neue_einladung()
        self.assertEqual(
            streng.delete(
                f"/api/bands/{self.band.id}/invitations/{einladung.id}/"
            ).status_code,
            403,
        )
        anonym = Client()
        self.assertEqual(
            anonym.post(
                self.listen_pfad(), data="{}", content_type="application/json"
            ).status_code,
            401,
        )
        self.assertEqual(
            anonym.delete(
                f"/api/bands/{self.band.id}/invitations/{einladung.id}/"
            ).status_code,
            401,
        )
