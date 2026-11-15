import json
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import Client, TransactionTestCase

from api.gig_serializers import SETLIST_REFERENZ
from bands.models import Band, Membership
from gigs.models import Gig

User = get_user_model()


class GigsRaceTest(TransactionTestCase):
    """Fremdschlüsselprüfung ohne den TestCase-Savepoint, damit der Konflikt sofort auffällt."""

    def setUp(self):
        self.benutzer = User.objects.create_user(
            username="race", email="race@example.test", password="geheim-1234"
        )
        self.band = Band.objects.create(name="Race-Band", created_by=self.benutzer)
        Membership.objects.create(band=self.band, user=self.benutzer, role="owner")
        self.client = Client()
        self.client.login(username="race", password="geheim-1234")
        self.liste = f"/api/bands/{self.band.id}/gigs/"

    def test_parallele_setlist_loeschung_wird_als_400_beantwortet(self):
        with mock.patch(
            "api.gig_serializers.setlist_gehoert_zu_band", return_value=True
        ):
            antwort = self.client.post(
                self.liste,
                data=json.dumps(
                    {"title": "Race", "date": "2099-11-11", "setlist_id": 999999}
                ),
                content_type="application/json",
            )
        self.assertEqual(antwort.status_code, 400)
        self.assertEqual(antwort.json()["setlist_id"], [SETLIST_REFERENZ])
        self.assertFalse(Gig.objects.filter(title="Race").exists())

        angelegt = self.client.post(
            self.liste,
            data=json.dumps({"title": "Bleibt", "date": "2099-11-12"}),
            content_type="application/json",
        )
        gig_id = angelegt.json()["id"]
        with mock.patch(
            "api.gig_serializers.setlist_gehoert_zu_band", return_value=True
        ):
            geaendert = self.client.patch(
                f"{self.liste}{gig_id}/",
                data=json.dumps({"setlist_id": 999999}),
                content_type="application/json",
            )
        self.assertEqual(geaendert.status_code, 400)
        self.assertEqual(geaendert.json()["setlist_id"], [SETLIST_REFERENZ])
        self.assertIsNone(Gig.objects.get(id=gig_id).setlist_id)
