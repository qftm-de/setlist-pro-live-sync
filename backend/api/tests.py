from unittest.mock import patch

from django.test import TestCase


class HealthTest(TestCase):
    def test_health_antwortet_ok(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_health_meldet_datenbankfehler_ohne_details(self):
        with patch("api.views.connection") as verbindung:
            verbindung.cursor.side_effect = RuntimeError("interner fehler")
            response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"status": "error"})
