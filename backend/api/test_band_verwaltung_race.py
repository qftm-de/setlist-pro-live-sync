import threading

from django.contrib.auth import get_user_model
from django.db import close_old_connections, connection
from django.http import Http404
from django.test import TransactionTestCase

from api.sync import BandAbgleich
from bands.dienste import (
    LetzterOwnerFehler,
    MitgliedNichtErlaubt,
    MitgliedNichtGefunden,
    mitglied_entfernen,
    rolle_aendern,
)
from bands.models import Band, Membership

User = get_user_model()


def parallel(aufgaben):
    ergebnisse = []
    sperre = threading.Lock()
    start = threading.Barrier(len(aufgaben))

    def lauf(aufgabe):
        close_old_connections()
        try:
            start.wait(timeout=10)
            wert = aufgabe()
        except Exception as fehler:  # noqa: BLE001 - Ergebnis wird nur gesammelt
            wert = type(fehler).__name__
        finally:
            connection.close()
        with sperre:
            ergebnisse.append(wert)

    threads = [threading.Thread(target=lauf, args=(a,)) for a in aufgaben]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=20)
    return ergebnisse


class RollenRaceTest(TransactionTestCase):
    def setUp(self):
        self.eins = User.objects.create_user(
            username="eins", email="eins@example.test", password="geheim-1234"
        )
        self.zwei = User.objects.create_user(
            username="zwei", email="zwei@example.test", password="geheim-1234"
        )
        self.band = Band.objects.create(name="Race", created_by=self.eins)
        self.zeile_eins = Membership.objects.create(
            band=self.band, user=self.eins, role="owner"
        )
        self.zeile_zwei = Membership.objects.create(
            band=self.band, user=self.zwei, role="owner"
        )

    def test_gleichzeitiges_herabstufen_laesst_einen_owner(self):
        def herab(akteur, ziel_id):
            def lauf():
                try:
                    rolle_aendern(self.band, akteur, ziel_id, "member")
                    return "ok"
                except LetzterOwnerFehler:
                    return "letzter"
            return lauf

        ergebnisse = parallel(
            [
                herab(self.zwei, self.zeile_eins.id),
                herab(self.eins, self.zeile_zwei.id),
            ]
        )
        self.assertIn("ok", ergebnisse)
        self.assertTrue(
            all(
                wert in ("ok", "letzter", "MitgliedNichtErlaubt")
                for wert in ergebnisse
            ),
            ergebnisse,
        )
        self.assertEqual(
            Membership.objects.filter(band=self.band, role="owner").count(), 1
        )

    def test_gleichzeitiges_entfernen_laesst_einen_owner(self):
        ziele = [
            (self.eins, self.zeile_zwei.id),
            (self.zwei, self.zeile_eins.id),
        ]

        def entfernen(akteur, ziel_id):
            def lauf():
                try:
                    mitglied_entfernen(self.band, akteur, ziel_id)
                    return "ok"
                except (LetzterOwnerFehler, MitgliedNichtGefunden) as fehler:
                    return type(fehler).__name__
            return lauf

        ergebnisse = parallel([entfernen(a, z) for a, z in ziele])
        self.assertEqual(ergebnisse.count("ok"), 1)
        self.assertGreaterEqual(
            Membership.objects.filter(band=self.band, role="owner").count(), 1
        )

    def test_abgleich_prueft_mitgliedschaft_im_snapshot(self):
        fremder = User.objects.create_user(
            username="fremd", email="fremd@example.test", password="geheim-1234"
        )
        with self.assertRaises(Http404):
            BandAbgleich()._daten(self.band.id, fremder)

    def test_entfernter_owner_kann_niemanden_mehr_befoerdern(self):
        ziel = Membership.objects.create(
            band=self.band,
            user=User.objects.create_user(
                username="drei", email="drei@example.test", password="geheim-1234"
            ),
            role="member",
        )
        Membership.objects.filter(id=self.zeile_zwei.id).delete()
        with self.assertRaises(MitgliedNichtGefunden):
            rolle_aendern(self.band, self.zwei, ziel.id, "owner")
        ziel.refresh_from_db()
        self.assertEqual(ziel.role, "member")

    def test_herabgestufter_owner_kann_niemanden_mehr_befoerdern(self):
        ziel = Membership.objects.create(
            band=self.band,
            user=User.objects.create_user(
                username="vier", email="vier@example.test", password="geheim-1234"
            ),
            role="member",
        )
        Membership.objects.filter(id=self.zeile_zwei.id).update(role="member")
        with self.assertRaises(MitgliedNichtErlaubt):
            rolle_aendern(self.band, self.zwei, ziel.id, "owner")
        ziel.refresh_from_db()
        self.assertEqual(ziel.role, "member")
