import json
from datetime import datetime, timezone as dt_timezone
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from bands.models import Band, Membership
from setlists.models import Setlist

User = get_user_model()


class GigsBasis(TestCase):
    def setUp(self):
        self.benutzer = User.objects.create_user(
            username="band1", email="band1@example.test", password="geheim-1234"
        )
        self.mitglied = User.objects.create_user(
            username="mitglied", email="mitglied@example.test", password="geheim-1234"
        )
        self.fremder = User.objects.create_user(
            username="band2", email="band2@example.test", password="geheim-1234"
        )
        self.band = Band.objects.create(name="Die Band", created_by=self.benutzer)
        Membership.objects.create(band=self.band, user=self.benutzer, role="owner")
        Membership.objects.create(band=self.band, user=self.mitglied, role="member")
        self.fremdband = Band.objects.create(name="Fremde", created_by=self.fremder)
        Membership.objects.create(band=self.fremdband, user=self.fremder, role="owner")
        self.setlist = Setlist.objects.create(band=self.band, name="Hauptset")
        self.fremdsetlist = Setlist.objects.create(band=self.fremdband, name="Fremd")
        self.client = Client()
        self.client.login(username="band1", password="geheim-1234")
        self.liste = f"/api/bands/{self.band.id}/gigs/"

    def frieren(self, iso_utc):
        return mock.patch(
            "django.utils.timezone.now",
            return_value=datetime.fromisoformat(iso_utc).astimezone(dt_timezone.utc),
        )

    def anlegen(self, **daten):
        daten.setdefault("title", "Auftritt")
        return self.client.post(
            self.liste, data=json.dumps(daten), content_type="application/json"
        )

    def detail(self, gig_id):
        return f"/api/bands/{self.band.id}/gigs/{gig_id}/"
