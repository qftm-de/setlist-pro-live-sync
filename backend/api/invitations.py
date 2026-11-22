"""Owner-Verwaltung der 48-Stunden-Einladungslinks."""

from __future__ import annotations

from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from bands.dienste import MitgliedNichtErlaubt, MitgliedNichtGefunden
from bands.einladungen import (
    EinladungUngueltig,
    EinladungUngueltigeEingabe,
    erstelle_einladung,
    widerrufe_einladung,
)
from bands.models import BandInvitation

from .bands import band_fuer_owner


def _zeit(wert):
    return wert.isoformat() if wert is not None else None


def _owner_fehler(fehler: Exception) -> None:
    if isinstance(fehler, MitgliedNichtGefunden):
        raise Http404 from fehler
    raise PermissionDenied("Nur Band-Owner dürfen Einladungen verwalten.") from fehler


def einladung_daten(einladung: BandInvitation) -> dict:
    return {
        "id": einladung.id,
        "note": einladung.note,
        "expires_at": _zeit(einladung.expires_at),
        "revoked_at": _zeit(einladung.revoked_at),
        "uses_count": einladung.uses_count,
        "max_uses": einladung.max_uses,
        "status": einladung.status(),
        "created_at": _zeit(einladung.created_at),
        "last_used_at": _zeit(einladung.last_used_at),
        "created_by": einladung.created_by.display_name
        or einladung.created_by.get_username(),
    }


class EinladungsListe(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "invitations-owner"

    def get_throttles(self):
        # Lesen darf häufiger nachladen als Schreiben. Sonst blockiert das
        # Nachladen nach einer Aktion am Schreiblimit.
        self.throttle_scope = (
            "invitations-list"
            if self.request.method == "GET"
            else "invitations-owner"
        )
        return super().get_throttles()

    def get(self, request, band_id: int):
        band = band_fuer_owner(request.user, band_id)
        einladungen = BandInvitation.objects.filter(band=band).select_related(
            "created_by"
        )
        return Response([einladung_daten(e) for e in einladungen])

    def post(self, request, band_id: int):
        band = band_fuer_owner(request.user, band_id)
        daten = request.data
        if not isinstance(daten, dict):
            return Response(
                {"detail": "JSON-Objekt erwartet."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        note = daten.get("note", "")
        if note is None:
            note = ""
        if not isinstance(note, str):
            return Response(
                {"note": "Hinweis muss Text sein."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        max_uses = daten.get("max_uses")
        try:
            einladung, rohtoken = erstelle_einladung(
                band, request.user, note=note, max_uses=max_uses
            )
        except EinladungUngueltigeEingabe as fehler:
            return Response(fehler.felder, status=status.HTTP_400_BAD_REQUEST)
        except (MitgliedNichtGefunden, MitgliedNichtErlaubt) as fehler:
            _owner_fehler(fehler)
        antwort = einladung_daten(einladung)
        antwort["token"] = rohtoken
        antwort["invite_path"] = f"/einladung/{rohtoken}"
        return Response(antwort, status=status.HTTP_201_CREATED)


class EinladungDetail(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "invitations-owner"

    def delete(self, request, band_id: int, invitation_id: int):
        band = band_fuer_owner(request.user, band_id)
        try:
            einladung = BandInvitation.objects.select_related("band").get(
                id=invitation_id, band=band
            )
        except BandInvitation.DoesNotExist as fehler:
            raise Http404 from fehler
        try:
            einladung = widerrufe_einladung(einladung, request.user)
        except (MitgliedNichtGefunden, MitgliedNichtErlaubt) as fehler:
            _owner_fehler(fehler)
        except EinladungUngueltig as fehler:
            raise Http404 from fehler
        return Response(einladung_daten(einladung))
