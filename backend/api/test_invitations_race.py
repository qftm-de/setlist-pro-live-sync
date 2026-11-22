import json
import threading

from django.contrib.auth import get_user_model
from django.db import close_old_connections, connection, transaction
from django.test import Client, TransactionTestCase

from bands.dienste import (
    MitgliedNichtErlaubt,
    MitgliedNichtGefunden,
    band_owner_sperren,
)
from bands.einladungen import erstelle_einladung, widerrufe_einladung
from bands.models import Band, BandInvitation, Membership

User = get_user_model()


def _ergebnis(speicher, sperre, wert):
    with sperre:
        speicher.append(wert)


class BeitrittsRaceTest(TransactionTestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner", email="owner@example.test", password="geheim-1234"
        )
        self.band = Band.objects.create(name="Race", created_by=self.owner)
        Membership.objects.create(
            band=self.band, user=self.owner, role=Membership.ROLE_OWNER
        )
        self.einladung, self.rohtoken = erstelle_einladung(
            self.band, self.owner, max_uses=1
        )

    def test_nur_ein_beitritt_bei_limit_eins(self):
        start = threading.Barrier(2)
        ergebnisse = []
        sperre = threading.Lock()

        def beitreten(nummer):
            close_old_connections()
            try:
                start.wait(timeout=10)
                antwort = Client().post(
                    f"/api/invitations/{self.rohtoken}/accept/",
                    data=json.dumps(
                        {
                            "mode": "register",
                            "username": f"neu{nummer}",
                            "email": f"neu{nummer}@example.test",
                            "password": "testpasswort-1111",
                        }
                    ),
                    content_type="application/json",
                )
                wert = antwort.status_code
            except Exception as fehler:  # noqa: BLE001 - Ergebnis wird nur gesammelt
                wert = type(fehler).__name__
            finally:
                connection.close()
            with sperre:
                ergebnisse.append(wert)

        threads = [
            threading.Thread(target=beitreten, args=(nummer,))
            for nummer in (1, 2)
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=20)

        self.assertEqual(sorted(ergebnisse), [201, 404])
        frisch = BandInvitation.objects.get(id=self.einladung.id)
        self.assertEqual(frisch.uses_count, 1)
        self.assertEqual(
            Membership.objects.filter(band=self.band).exclude(user=self.owner).count(),
            1,
        )

    def test_mitglied_erstellt_oder_widerruft_keine_einladung(self):
        mitglied = User.objects.create_user(
            username="mitglied", email="mitglied@example.test", password="geheim-1234"
        )
        Membership.objects.create(
            band=self.band, user=mitglied, role=Membership.ROLE_MEMBER
        )
        anzahl = BandInvitation.objects.filter(band=self.band).count()
        with self.assertRaises(MitgliedNichtErlaubt):
            erstelle_einladung(self.band, mitglied)
        with self.assertRaises(MitgliedNichtErlaubt):
            widerrufe_einladung(self.einladung, mitglied)
        self.assertEqual(
            BandInvitation.objects.filter(band=self.band).count(), anzahl
        )
        self.einladung.refresh_from_db()
        self.assertIsNone(self.einladung.revoked_at)

    def test_gleichzeitig_entfernter_owner_erstellt_keine_einladung(self):
        zweiter = User.objects.create_user(
            username="owner2", email="owner2@example.test", password="geheim-1234"
        )
        Membership.objects.create(
            band=self.band, user=zweiter, role=Membership.ROLE_OWNER
        )
        entfernt = threading.Event()
        anfrage = threading.Event()
        ergebnisse = []
        sperre = threading.Lock()

        def entfernen():
            close_old_connections()
            try:
                with transaction.atomic():
                    band_owner_sperren(self.band, self.owner)
                    Membership.objects.filter(band=self.band, user=zweiter).delete()
                    entfernt.set()
                    anfrage.wait(timeout=10)
                wert = "ok"
            except Exception as fehler:  # noqa: BLE001 - Ergebnis wird nur gesammelt
                wert = type(fehler).__name__
            finally:
                connection.close()
            _ergebnis(ergebnisse, sperre, wert)

        def erstellen():
            close_old_connections()
            try:
                entfernt.wait(timeout=10)
                anfrage.set()
                try:
                    erstelle_einladung(self.band, zweiter)
                    wert = "ok"
                except (MitgliedNichtGefunden, MitgliedNichtErlaubt) as fehler:
                    wert = type(fehler).__name__
            except Exception as fehler:  # noqa: BLE001 - Ergebnis wird nur gesammelt
                wert = type(fehler).__name__
            finally:
                connection.close()
            _ergebnis(ergebnisse, sperre, wert)

        threads = [
            threading.Thread(target=entfernen),
            threading.Thread(target=erstellen),
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=20)

        self.assertIn("ok", ergebnisse)
        self.assertIn("MitgliedNichtGefunden", ergebnisse)
        self.assertEqual(
            BandInvitation.objects.filter(band=self.band).count(), 1
        )

    def test_gleichzeitig_herabgestufter_owner_widerruft_keine_einladung(self):
        zweiter = User.objects.create_user(
            username="owner2", email="owner2@example.test", password="geheim-1234"
        )
        Membership.objects.create(
            band=self.band, user=zweiter, role=Membership.ROLE_OWNER
        )
        geaendert = threading.Event()
        anfrage = threading.Event()
        ergebnisse = []
        sperre = threading.Lock()

        def herabstufen():
            close_old_connections()
            try:
                with transaction.atomic():
                    band_owner_sperren(self.band, self.owner)
                    Membership.objects.filter(band=self.band, user=zweiter).update(
                        role=Membership.ROLE_MEMBER
                    )
                    geaendert.set()
                    anfrage.wait(timeout=10)
                wert = "ok"
            except Exception as fehler:  # noqa: BLE001 - Ergebnis wird nur gesammelt
                wert = type(fehler).__name__
            finally:
                connection.close()
            _ergebnis(ergebnisse, sperre, wert)

        def widerrufen():
            close_old_connections()
            try:
                geaendert.wait(timeout=10)
                anfrage.set()
                try:
                    widerrufe_einladung(self.einladung, zweiter)
                    wert = "ok"
                except (MitgliedNichtGefunden, MitgliedNichtErlaubt) as fehler:
                    wert = type(fehler).__name__
            except Exception as fehler:  # noqa: BLE001 - Ergebnis wird nur gesammelt
                wert = type(fehler).__name__
            finally:
                connection.close()
            _ergebnis(ergebnisse, sperre, wert)

        threads = [
            threading.Thread(target=herabstufen),
            threading.Thread(target=widerrufen),
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=20)

        self.assertIn("ok", ergebnisse)
        self.assertIn("MitgliedNichtErlaubt", ergebnisse)
        frisch = BandInvitation.objects.get(id=self.einladung.id)
        self.assertIsNone(frisch.revoked_at)

    def test_beitritt_und_widerruf_zweier_einladungen_parallel(self):
        einladung, _ = erstelle_einladung(self.band, self.owner)
        _, rohtoken = erstelle_einladung(self.band, self.owner)
        start = threading.Barrier(2)
        ergebnisse = []
        sperre = threading.Lock()

        def widerrufen():
            close_old_connections()
            try:
                start.wait(timeout=10)
                widerrufe_einladung(einladung, self.owner)
                wert = "ok"
            except Exception as fehler:  # noqa: BLE001 - Ergebnis wird nur gesammelt
                wert = type(fehler).__name__
            finally:
                connection.close()
            _ergebnis(ergebnisse, sperre, wert)

        def beitreten():
            close_old_connections()
            try:
                start.wait(timeout=10)
                antwort = Client().post(
                    f"/api/invitations/{rohtoken}/accept/",
                    data=json.dumps(
                        {
                            "mode": "register",
                            "username": "parallel",
                            "email": "parallel@example.test",
                            "password": "testpasswort-1111",
                        }
                    ),
                    content_type="application/json",
                )
                wert = antwort.status_code
            except Exception as fehler:  # noqa: BLE001 - Ergebnis wird nur gesammelt
                wert = type(fehler).__name__
            finally:
                connection.close()
            _ergebnis(ergebnisse, sperre, wert)

        threads = [
            threading.Thread(target=widerrufen),
            threading.Thread(target=beitreten),
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=20)

        self.assertIn("ok", ergebnisse)
        self.assertIn(201, ergebnisse)
        self.assertIsNotNone(
            BandInvitation.objects.get(id=einladung.id).revoked_at
        )
        self.assertTrue(
            Membership.objects.filter(
                band=self.band, user__username="parallel"
            ).exists()
        )
