import json

from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from api.session import FEHLER_ANMELDUNG

User = get_user_model()


class AnmeldungTest(TestCase):
    def setUp(self):
        self.benutzer = User.objects.create_user(
            username="band1",
            email="band1@example.test",
            password="geheim-1234",
            display_name="Erste Band",
        )
        self.client = Client(enforce_csrf_checks=True)

    def csrf_token(self):
        antwort = self.client.get("/api/config/")
        return antwort.cookies["csrftoken"].value

    def anmelden(self, benutzername="band1", passwort="geheim-1234", token=None):
        return self.client.post(
            "/api/anmeldung/",
            data=json.dumps({"username": benutzername, "password": passwort}),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=self.csrf_token() if token is None else token,
        )

    def test_anmeldung_setzt_sitzung_mit_anzeigenamen(self):
        antwort = self.anmelden()
        self.assertEqual(antwort.status_code, 200)
        self.assertEqual(antwort.json()["display_name"], "Erste Band")
        self.assertEqual(antwort.cookies["sessionid"]["httponly"], True)

        sitzung = self.client.get("/api/session/")
        self.assertEqual(sitzung.status_code, 200)
        self.assertEqual(sitzung.json()["username"], "band1")

    def test_abmeldung_beendet_sitzung(self):
        self.anmelden()
        antwort = self.client.post("/api/abmeldung/", HTTP_X_CSRFTOKEN=self.csrf_token())
        self.assertEqual(antwort.status_code, 200)
        self.assertEqual(self.client.get("/api/session/").status_code, 401)

    def test_anmeldung_ohne_csrf_token_scheitert(self):
        antwort = self.anmelden(token="")
        self.assertEqual(antwort.status_code, 403)

    def test_falsches_passwort_und_unbekanntes_konto_antworten_gleich(self):
        falsch = self.anmelden(passwort="falsch")
        unbekannt = self.anmelden(benutzername="gibtesnicht")
        self.assertEqual(falsch.status_code, 400)
        self.assertEqual(falsch.json(), FEHLER_ANMELDUNG)
        self.assertEqual(unbekannt.json(), FEHLER_ANMELDUNG)

    def test_gesperrtes_konto_kommt_nicht_rein(self):
        self.benutzer.is_active = False
        self.benutzer.save()
        self.assertEqual(self.anmelden().status_code, 400)
        self.assertEqual(self.client.get("/api/session/").status_code, 401)

    def test_passwort_liegt_als_argon2_hash(self):
        self.benutzer.refresh_from_db()
        self.assertTrue(self.benutzer.password.startswith("argon2$"))

    def test_anonyme_aufrufe_sind_401(self):
        self.assertEqual(self.client.get("/api/session/").status_code, 401)
        self.assertEqual(self.client.get("/api/bands/").status_code, 401)
        self.assertEqual(self.client.post("/api/bands/").status_code, 401)
