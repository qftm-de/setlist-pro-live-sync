import json
from datetime import date

from django.test import Client

from api.gig_serializers import SETLIST_REFERENZ
from api.test_gigs_basis import GigsBasis
from gigs.models import Gig
from setlists.models import Setlist


class GigsTest(GigsBasis):
    def test_anlegen_mit_allen_feldern_und_eigener_setlist(self):
        with self.frieren("2026-06-15T10:00:00+00:00"):
            antwort = self.anlegen(
                title="Sommerfest",
                date="2026-06-20",
                time="20:30",
                location="Hof",
                notes="Open Air",
                setlist_id=self.setlist.id,
            )
            self.assertEqual(antwort.status_code, 201)
            daten = antwort.json()
            self.assertEqual(daten["title"], "Sommerfest")
            self.assertEqual(daten["date"], "2026-06-20")
            self.assertEqual(daten["time"], "20:30:00")
            self.assertEqual(daten["location"], "Hof")
            self.assertEqual(daten["notes"], "Open Air")
            self.assertEqual(daten["setlist_id"], self.setlist.id)
            self.assertEqual(daten["setlist_name"], "Hauptset")

            gruppen = self.client.get(self.liste).json()
            self.assertEqual([gig["id"] for gig in gruppen["upcoming"]], [daten["id"]])
            self.assertEqual(gruppen["past"], [])

    def test_lesen_patch_verknuepfung_entfernen_und_loeschen(self):
        antwort = self.anlegen(
            title="Termin",
            date="2099-01-01",
            time="19:00",
            location="Halle",
            notes="Notiz",
            setlist_id=self.setlist.id,
        )
        gig_id = antwort.json()["id"]

        gelesen = self.client.get(self.detail(gig_id))
        self.assertEqual(gelesen.status_code, 200)
        self.assertEqual(gelesen.json()["setlist_name"], "Hauptset")

        nur_titel = self.client.patch(
            self.detail(gig_id),
            data=json.dumps({"title": "Neuer Titel"}),
            content_type="application/json",
        )
        self.assertEqual(nur_titel.status_code, 200)
        self.assertEqual(nur_titel.json()["title"], "Neuer Titel")
        self.assertEqual(nur_titel.json()["time"], "19:00:00")
        self.assertEqual(nur_titel.json()["setlist_id"], self.setlist.id)
        self.assertEqual(nur_titel.json()["setlist_name"], "Hauptset")

        zugabe = Setlist.objects.create(band=self.band, name="Zugabe")
        umgehaengt = self.client.patch(
            self.detail(gig_id),
            data=json.dumps({"setlist_id": zugabe.id}),
            content_type="application/json",
        )
        self.assertEqual(umgehaengt.status_code, 200)
        self.assertEqual(umgehaengt.json()["setlist_id"], zugabe.id)
        self.assertEqual(umgehaengt.json()["setlist_name"], "Zugabe")

        entfernt = self.client.patch(
            self.detail(gig_id),
            data=json.dumps({"setlist_id": None, "time": None}),
            content_type="application/json",
        )
        self.assertEqual(entfernt.status_code, 200)
        self.assertIsNone(entfernt.json()["setlist_id"])
        self.assertIsNone(entfernt.json()["setlist_name"])
        self.assertIsNone(entfernt.json()["time"])
        self.assertEqual(entfernt.json()["location"], "Halle")
        self.assertEqual(entfernt.json()["notes"], "Notiz")

        self.assertEqual(self.client.delete(self.detail(gig_id)).status_code, 204)
        self.assertFalse(Gig.objects.filter(id=gig_id).exists())

    def test_einfaches_mitglied_darf_schreiben(self):
        self.client.logout()
        self.client.login(username="mitglied", password="geheim-1234")
        antwort = self.anlegen(title="Mitgliedstermin", date="2099-02-02")
        self.assertEqual(antwort.status_code, 201)
        gig_id = antwort.json()["id"]
        geaendert = self.client.patch(
            self.detail(gig_id),
            data=json.dumps({"location": "Proberaum"}),
            content_type="application/json",
        )
        self.assertEqual(geaendert.status_code, 200)
        self.assertEqual(geaendert.json()["location"], "Proberaum")
        self.assertEqual(self.client.delete(self.detail(gig_id)).status_code, 204)

    def test_doppelte_titel_und_ohne_optionale_felder(self):
        self.assertEqual(
            self.anlegen(title="Gleich", date="2099-03-03").status_code, 201
        )
        zweite = self.anlegen(title="Gleich", date="2099-03-04")
        self.assertEqual(zweite.status_code, 201)
        leer = self.anlegen(title="Nur Pflicht", date="2099-03-05")
        self.assertEqual(leer.status_code, 201)
        self.assertEqual(leer.json()["time"], None)
        self.assertEqual(leer.json()["location"], "")
        self.assertEqual(leer.json()["notes"], "")
        self.assertEqual(leer.json()["setlist_id"], None)
        self.assertEqual(leer.json()["setlist_name"], None)

    def test_anonyme_zugriffe_401(self):
        gig_id = self.anlegen(title="Termin", date="2099-04-04").json()["id"]
        anonym = Client()
        self.assertEqual(anonym.get(self.liste).status_code, 401)
        self.assertEqual(
            anonym.post(
                self.liste,
                data=json.dumps({"title": "Anonym", "date": "2099-04-05"}),
                content_type="application/json",
            ).status_code,
            401,
        )
        self.assertEqual(anonym.get(self.detail(gig_id)).status_code, 401)
        self.assertEqual(
            anonym.patch(
                self.detail(gig_id),
                data=json.dumps({"title": "Anonym"}),
                content_type="application/json",
            ).status_code,
            401,
        )
        self.assertEqual(anonym.delete(self.detail(gig_id)).status_code, 401)

    def test_schreiben_ohne_csrf_403(self):
        gig_id = self.anlegen(title="Termin", date="2099-04-04").json()["id"]
        ohne_csrf = Client(enforce_csrf_checks=True)
        self.assertTrue(ohne_csrf.login(username="band1", password="geheim-1234"))
        self.assertEqual(
            ohne_csrf.post(
                self.liste,
                data=json.dumps({"title": "Ohne", "date": "2099-04-05"}),
                content_type="application/json",
            ).status_code,
            403,
        )
        self.assertEqual(
            ohne_csrf.patch(
                self.detail(gig_id),
                data=json.dumps({"title": "Ohne"}),
                content_type="application/json",
            ).status_code,
            403,
        )
        self.assertEqual(ohne_csrf.delete(self.detail(gig_id)).status_code, 403)

    def test_fremde_band_und_fremder_auftritt_404(self):
        eigener = self.anlegen(title="Eigener", date="2099-05-05").json()["id"]
        fremder_gig = Gig.objects.create(
            band=self.fremdband, title="Fremder", date=date(2099, 5, 6)
        )
        fremde_liste = f"/api/bands/{self.fremdband.id}/gigs/"
        fremdes_detail = f"/api/bands/{self.fremdband.id}/gigs/{fremder_gig.id}/"

        self.assertEqual(self.client.get(fremde_liste).status_code, 404)
        self.assertEqual(
            self.client.post(
                fremde_liste,
                data=json.dumps({"title": "X", "date": "2099-05-07"}),
                content_type="application/json",
            ).status_code,
            404,
        )
        self.assertEqual(self.client.get(fremdes_detail).status_code, 404)
        self.assertEqual(
            self.client.patch(
                fremdes_detail,
                data=json.dumps({"title": "X"}),
                content_type="application/json",
            ).status_code,
            404,
        )
        self.assertEqual(self.client.delete(fremdes_detail).status_code, 404)

        falsche_band = f"/api/bands/{self.band.id}/gigs/{fremder_gig.id}/"
        self.assertEqual(self.client.get(falsche_band).status_code, 404)
        self.assertEqual(
            self.client.patch(
                falsche_band,
                data=json.dumps({"title": "X"}),
                content_type="application/json",
            ).status_code,
            404,
        )
        self.assertEqual(self.client.delete(falsche_band).status_code, 404)
        self.assertTrue(Gig.objects.filter(id=eigener).exists())

    def test_validierungsfehler_400(self):
        faelle = [
            {"title": "", "date": "2099-06-06"},
            {"title": "x" * 201, "date": "2099-06-06"},
            {"title": "Termin", "date": "2026-02-30"},
            {"title": "Termin"},
            {"title": "Termin", "date": "2099-06-06", "time": "25:99"},
            {"title": "Termin", "date": "2099-06-06", "location": "x" * 201},
            {"title": "Termin", "date": "2099-06-06", "notes": "x" * 10001},
            {"title": "Termin", "date": "2099-06-06", "setlist_id": 999999},
            {
                "title": "Termin",
                "date": "2099-06-06",
                "setlist_id": self.fremdsetlist.id,
            },
        ]
        for daten in faelle:
            with self.subTest(daten=daten):
                self.assertEqual(self.anlegen(**daten).status_code, 400)
        self.assertFalse(Gig.objects.filter(band=self.band).exists())

    def test_setlist_fehler_ist_einheitlich(self):
        unbekannt = self.anlegen(
            title="A", date="2099-07-07", setlist_id=999999
        )
        fremd = self.anlegen(
            title="B", date="2099-07-07", setlist_id=self.fremdsetlist.id
        )
        self.assertEqual(unbekannt.status_code, 400)
        self.assertEqual(fremd.status_code, 400)
        self.assertEqual(unbekannt.json()["setlist_id"], [SETLIST_REFERENZ])
        self.assertEqual(unbekannt.json()["setlist_id"], fremd.json()["setlist_id"])

        gig_id = self.anlegen(title="C", date="2099-07-08").json()["id"]
        patch_unbekannt = self.client.patch(
            self.detail(gig_id),
            data=json.dumps({"setlist_id": 999999}),
            content_type="application/json",
        )
        patch_fremd = self.client.patch(
            self.detail(gig_id),
            data=json.dumps({"setlist_id": self.fremdsetlist.id}),
            content_type="application/json",
        )
        self.assertEqual(patch_unbekannt.status_code, 400)
        self.assertEqual(patch_fremd.status_code, 400)
        self.assertEqual(patch_unbekannt.json()["setlist_id"], [SETLIST_REFERENZ])
        self.assertEqual(
            patch_unbekannt.json()["setlist_id"],
            patch_fremd.json()["setlist_id"],
        )

    def test_ungueltiger_patch_erhaelt_alten_datensatz_und_band_bleibt(self):
        antwort = self.anlegen(
            title="Alt",
            date="2099-08-08",
            time="18:00",
            location="Altort",
            notes="Alte Notiz",
            setlist_id=self.setlist.id,
        )
        gig_id = antwort.json()["id"]

        ungueltig = self.client.patch(
            self.detail(gig_id),
            data=json.dumps({"title": "   ", "location": "x" * 201}),
            content_type="application/json",
        )
        self.assertEqual(ungueltig.status_code, 400)
        alt = self.client.get(self.detail(gig_id)).json()
        self.assertEqual(alt["title"], "Alt")
        self.assertEqual(alt["time"], "18:00:00")
        self.assertEqual(alt["location"], "Altort")
        self.assertEqual(alt["notes"], "Alte Notiz")
        self.assertEqual(alt["setlist_id"], self.setlist.id)

        verschoben = self.client.patch(
            self.detail(gig_id),
            data=json.dumps(
                {"band": self.fremdband.id, "band_id": self.fremdband.id}
            ),
            content_type="application/json",
        )
        self.assertEqual(verschoben.status_code, 200)
        self.assertEqual(Gig.objects.get(id=gig_id).band_id, self.band.id)

    def test_grenzlaengen(self):
        self.assertEqual(
            self.anlegen(title="x" * 200, date="2099-09-09").status_code, 201
        )
        self.assertEqual(
            self.anlegen(title="x" * 201, date="2099-09-09").status_code, 400
        )
        self.assertEqual(
            self.anlegen(
                title="Ort", date="2099-09-09", location="x" * 200
            ).status_code,
            201,
        )
        self.assertEqual(
            self.anlegen(
                title="Ort", date="2099-09-09", location="x" * 201
            ).status_code,
            400,
        )
        self.assertEqual(
            self.anlegen(
                title="Notiz", date="2099-09-09", notes="x" * 10000
            ).status_code,
            201,
        )
        self.assertEqual(
            self.anlegen(
                title="Notiz", date="2099-09-09", notes="x" * 10001
            ).status_code,
            400,
        )

    def test_setlist_aenderung_und_loeschung(self):
        antwort = self.anlegen(
            title="Termin",
            date="2099-10-10",
            time="20:00",
            location="Halle",
            notes="Notiz",
            setlist_id=self.setlist.id,
        )
        gig_id = antwort.json()["id"]

        self.setlist.name = "Umbenannt"
        self.setlist.save()
        self.assertEqual(
            self.client.get(self.detail(gig_id)).json()["setlist_name"],
            "Umbenannt",
        )

        self.setlist.delete()
        nach_loeschung = self.client.get(self.detail(gig_id))
        self.assertEqual(nach_loeschung.status_code, 200)
        daten = nach_loeschung.json()
        self.assertIsNone(daten["setlist_id"])
        self.assertIsNone(daten["setlist_name"])
        self.assertEqual(daten["title"], "Termin")
        self.assertEqual(daten["date"], "2099-10-10")
        self.assertEqual(daten["time"], "20:00:00")
        self.assertEqual(daten["location"], "Halle")
        self.assertEqual(daten["notes"], "Notiz")

