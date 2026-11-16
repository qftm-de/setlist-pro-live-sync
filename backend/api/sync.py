"""Autorisierter Vollabgleich der gewählten Band aus einem PostgreSQL-Snapshot."""

from __future__ import annotations

from django.db import connection, transaction
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from gigs.models import Gig
from setlists.models import Setlist

from .bands import band_fuer
from .gig_serializers import GigSerializer
from .gigs import sortierschluessel
from .serializers import SetlistSerializer, SongSerializer
from realtime.services import zaehler
from stage.dienste import aktive_sitzung, sitzung_daten


class BandAbgleich(APIView):
    def get(self, request, band_id: int):
        band = band_fuer(request.user, band_id)
        if request.query_params.get("nur_zaehler"):
            with transaction.atomic():
                zahlen = zaehler(band.id, request.user.id)
            return Response(
                {"counters": zahlen, "server_time": timezone.now().isoformat()}
            )
        if connection.in_atomic_block:
            # Tests und aufrufende Transaktionen erlauben keine neue Isolationsstufe.
            return Response(self._daten(band, request.user))
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
            daten = self._daten(band, request.user)
        return Response(daten)

    def _daten(self, band, user):
        zahlen = zaehler(band.id, user.id)
        songs = list(band.songs.all().order_by("id"))
        setlists = list(
            Setlist.objects.filter(band=band)
            .prefetch_related("sections__entries__song")
            .order_by("name", "id")
        )
        gigs = list(Gig.objects.filter(band=band).select_related("setlist"))

        heute = timezone.localdate()
        kommend = sorted(
            (gig for gig in gigs if gig.date >= heute), key=sortierschluessel
        )
        vergangen = sorted(
            (gig for gig in gigs if gig.date < heute),
            key=lambda gig: sortierschluessel(gig, absteigend=True),
        )
        sitzung = aktive_sitzung(band)
        return {
            "band": {"id": band.id, "name": band.name},
            "songs": SongSerializer(songs, many=True).data,
            "setlists": SetlistSerializer(setlists, many=True).data,
            "gigs": {
                "upcoming": GigSerializer(kommend, many=True).data,
                "past": GigSerializer(vergangen, many=True).data,
            },
            "stage": sitzung_daten(sitzung, user) if sitzung is not None else None,
            "counters": zahlen,
            "server_time": timezone.now().isoformat(),
        }
