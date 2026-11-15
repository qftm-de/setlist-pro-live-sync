from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.test import TestCase
from django.utils import timezone

from bands.models import Band, Membership
from realtime.models import OutboxEvent, Stream
from realtime.services import (
    band_ereignis,
    persoenliches_ereignis,
    raeume_auf,
    strom,
    verarbeite_offene,
    zaehler,
)

User = get_user_model()


class AusgangspufferTest(TestCase):
    def setUp(self):
        self.benutzer = User.objects.create_user(
            username="puffer", email="puffer@example.test", password="geheim-1234"
        )
        self.band = Band.objects.create(name="Pufferband", created_by=self.benutzer)
        Membership.objects.create(band=self.band, user=self.benutzer, role="owner")

    def test_rollback_laesst_weder_ereignis_noch_zaehler(self):
        with self.assertRaises(RuntimeError):
            with transaction.atomic():
                band_ereignis(self.band, "song.created", id=1)
                raise RuntimeError
        self.assertEqual(OutboxEvent.objects.count(), 0)
        self.assertEqual(zaehler(self.band.id, self.benutzer.id), {"band": 0, "personal": 0})

    def test_getrennte_stroeme_zaehlen_unabhaengig(self):
        band_ereignis(self.band, "song.created", id=1)
        band_ereignis(self.band, "song.updated", id=1)
        persoenliches_ereignis(self.band, self.benutzer, "annotation.created", id=9)
        self.assertEqual(zaehler(self.band.id, self.benutzer.id), {"band": 2, "personal": 1})
        self.assertEqual(
            list(OutboxEvent.objects.order_by("id").values_list("seq", flat=True)),
            [1, 2, 1],
        )
        self.assertEqual(
            Stream.objects.get(band=self.band, kind=Stream.ART_BAND).counter, 2
        )

    def test_relay_veroeffentlicht_mindestens_einmal(self):
        band_ereignis(self.band, "song.created", id=1)
        gesehen = []
        veroeffentlicht, offen = verarbeite_offene(
            veroeffentliche=lambda gruppe, nachricht: gesehen.append((gruppe, nachricht))
        )
        self.assertEqual((veroeffentlicht, offen), (1, 1))
        self.assertEqual(gesehen[0][0], f"band.{self.band.id}")
        self.assertEqual(gesehen[0][1]["seq"], 1)
        self.assertEqual(verarbeite_offene(veroeffentliche=lambda g, n: None), (0, 0))

    def test_fehlgeschlagene_veroeffentlichung_bleibt_offen(self):
        band_ereignis(self.band, "song.created", id=1)

        def scheitert(gruppe, nachricht):
            raise ConnectionError("redis weg")

        self.assertEqual(verarbeite_offene(veroeffentliche=scheitert), (0, 1))
        ereignis = OutboxEvent.objects.get()
        self.assertIsNone(ereignis.published_at)
        self.assertEqual(ereignis.attempts, 1)
        self.assertIn("redis weg", ereignis.last_error)

    def test_aufbewahrung_entfernt_nur_veroeffentlichte(self):
        veroeffentlicht = band_ereignis(self.band, "song.created", id=1)
        offen = band_ereignis(self.band, "song.updated", id=1)
        OutboxEvent.objects.filter(pk=veroeffentlicht.pk).update(
            published_at=timezone.now(),
            created_at=timezone.now() - timedelta(days=8),
        )
        OutboxEvent.objects.filter(pk=offen.pk).update(
            created_at=timezone.now() - timedelta(days=8)
        )
        self.assertGreaterEqual(raeume_auf(), 1)
        self.assertEqual(list(OutboxEvent.objects.values_list("pk", flat=True)), [offen.pk])

    def test_persoenlicher_strom_gehoert_zum_konto(self):
        konto = strom(self.band, self.benutzer)
        bandstrom = strom(self.band)
        self.assertNotEqual(konto.pk, bandstrom.pk)
        self.assertEqual(konto.kind, Stream.ART_PERSOENLICH)
        self.assertIsNone(bandstrom.user_id)
