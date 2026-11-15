from datetime import date, timedelta

from gigs.models import Gig

from api.test_gigs_basis import GigsBasis


class GigsGruppierungTest(GigsBasis):
    def test_gruppierung_nach_berliner_heute(self):
        with self.frieren("2026-06-15T10:00:00+00:00"):
            self.anlegen(title="Gestern", date="2026-06-14")
            self.anlegen(title="Heute früh", date="2026-06-15", time="00:01")
            self.anlegen(title="Heute spät", date="2026-06-15", time="23:59")
            self.anlegen(title="Morgen", date="2026-06-16")
            gruppen = self.client.get(self.liste).json()

        self.assertEqual(
            [gig["title"] for gig in gruppen["past"]], ["Gestern"]
        )
        self.assertEqual(
            [gig["title"] for gig in gruppen["upcoming"]],
            ["Heute früh", "Heute spät", "Morgen"],
        )

    def test_sortierung_je_gruppe(self):
        with self.frieren("2026-06-15T10:00:00+00:00"):
            self.anlegen(title="K25", date="2026-06-25")
            self.anlegen(title="K20spät", date="2026-06-20", time="20:00")
            self.anlegen(title="K20ohne", date="2026-06-20")
            self.anlegen(title="K20früh", date="2026-06-20", time="08:00")
            self.anlegen(title="K18", date="2026-06-18")
            self.anlegen(title="V10", date="2026-06-10")
            self.anlegen(title="V12spät", date="2026-06-12", time="18:00")
            self.anlegen(title="V12früh", date="2026-06-12", time="09:00")
            self.anlegen(title="V12ohne", date="2026-06-12")
            self.anlegen(title="V12früh2", date="2026-06-12", time="09:00")
            gruppen = self.client.get(self.liste).json()

        self.assertEqual(
            [gig["title"] for gig in gruppen["upcoming"]],
            ["K18", "K20früh", "K20spät", "K20ohne", "K25"],
        )
        self.assertEqual(
            [gig["title"] for gig in gruppen["past"]],
            ["V12früh", "V12früh2", "V12spät", "V12ohne", "V10"],
        )

    def test_leere_gruppen_und_jahreswechsel(self):
        with self.frieren("2026-06-15T10:00:00+00:00"):
            leer = self.client.get(self.liste).json()
        self.assertEqual(leer, {"upcoming": [], "past": []})

        with self.frieren("2026-12-31T22:30:00+00:00"):
            # Die Sitzung aus setUp wäre zu diesem Zeitpunkt abgelaufen.
            self.client.login(username="band1", password="geheim-1234")
            self.anlegen(title="Altjahr", date="2026-12-30")
            self.anlegen(title="Sylvester", date="2026-12-31")
            self.anlegen(title="Neujahr", date="2027-01-01")
            gruppen = self.client.get(self.liste).json()

        self.assertEqual([gig["title"] for gig in gruppen["past"]], ["Altjahr"])
        self.assertEqual(
            [gig["title"] for gig in gruppen["upcoming"]], ["Sylvester", "Neujahr"]
        )

    def test_sommerzeit_bestimmt_das_berliner_datum(self):
        faelle = [
            ("2026-03-28T23:30:00+00:00", date(2026, 3, 29)),
            ("2026-03-29T01:30:00+00:00", date(2026, 3, 29)),
            ("2026-10-24T22:30:00+00:00", date(2026, 10, 25)),
            ("2026-10-25T23:30:00+00:00", date(2026, 10, 26)),
        ]
        for iso_utc, berliner_tag in faelle:
            with self.subTest(iso_utc=iso_utc):
                Gig.objects.all().delete()
                Gig.objects.create(
                    band=self.band,
                    title="gestern",
                    date=berliner_tag - timedelta(days=1),
                )
                Gig.objects.create(band=self.band, title="heute", date=berliner_tag)
                Gig.objects.create(
                    band=self.band,
                    title="morgen",
                    date=berliner_tag + timedelta(days=1),
                )
                with self.frieren(iso_utc):
                    gruppen = self.client.get(self.liste).json()
                self.assertEqual(
                    [gig["title"] for gig in gruppen["past"]], ["gestern"]
                )
                self.assertEqual(
                    [gig["title"] for gig in gruppen["upcoming"]],
                    ["heute", "morgen"],
                )

