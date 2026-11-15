"""Testbasis für Anmerkungen: zwei Bands, PDF-Versionen und drei Konten."""

from __future__ import annotations

import uuid

from bands.models import Band, Membership
from documents.testhelfer import DokumentTestBasis, pdf_bytes, upload
from library.models import Song


def annotations_pfad(band_id: int, song_id: int, version_id: int, annotation_id: int | None = None) -> str:
    basis = (
        f"/api/bands/{band_id}/songs/{song_id}/document/versions/"
        f"{version_id}/annotations/"
    )
    return basis if annotation_id is None else f"{basis}{annotation_id}/"


def anlage(**felder) -> dict:
    daten = {
        "uuid": str(uuid.uuid4()),
        "page_number": 1,
        "kind": "text",
        "visibility": "private",
        "geometry": {"x": 0.1, "y": 0.1, "width": 0.2, "height": 0.05},
        "color": "gelb",
        "text": "Leiser spielen",
        "font_size": 0.0225,
    }
    daten.update(felder)
    return daten


class AnnotationTestBasis(DokumentTestBasis):
    def setUp(self):
        super().setUp()
        self.version = upload(
            self.client, self.band.id, self.song.id, pdf_bytes(2)
        ).json()

        self.zweite_band = Band.objects.create(
            name="Zweite Band", created_by=self.benutzer
        )
        Membership.objects.create(
            band=self.zweite_band, user=self.benutzer, role=Membership.ROLE_OWNER
        )
        Membership.objects.create(
            band=self.zweite_band, user=self.mitglied, role=Membership.ROLE_OWNER
        )
        self.zweiter_song = Song.objects.create(
            band=self.zweite_band, title="Zweites Lied"
        )
        self.zweite_version = upload(
            self.client, self.zweite_band.id, self.zweiter_song.id, pdf_bytes()
        ).json()

    def pfad(self, version=None, annotation_id=None, band=None, song=None) -> str:
        return annotations_pfad(
            (band or self.band).id,
            (song or self.song).id,
            (version or self.version)["id"],
            annotation_id,
        )

    def erstelle(self, **felder):
        pfad_werte = {}
        for name in ("band", "song", "version"):
            if name in felder:
                pfad_werte[name] = felder.pop(name)
        return self.client.post(
            self.pfad(**pfad_werte),
            data=anlage(**felder),
            content_type="application/json",
        )

    def mitglied_client(self):
        client = self.client_class()
        client.login(username="mitglied", password="geheim-1234")
        return client
