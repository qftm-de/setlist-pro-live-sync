"""Betreiber-Verwaltung der Instanz-Einladungen."""

from __future__ import annotations

from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.einladungen import (
    EinladungUngueltigeEingabe,
    erstelle_instanz_einladung,
    widerrufe_instanz_einladung,
)
from accounts.models import InstanzEinladung


def _zeit(wert):
    return wert.isoformat() if wert is not None else None


def einladung_daten(einladung: InstanzEinladung) -> dict:
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
    }


def _nur_betreiber(request) -> None:
    # Betreiber ist das Staff-Konto; Band-Owner dürfen das nicht.
    if not request.user.is_authenticated:
        raise PermissionDenied("Anmeldung erforderlich.")
    if not request.user.is_staff:
        raise PermissionDenied("Nur der Betreiber darf Instanz-Einladungen verwalten.")


class InstanzEinladungsListe(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "invitations-owner"

    def get(self, request):
        _nur_betreiber(request)
        return Response([einladung_daten(e) for e in InstanzEinladung.objects.all()])

    def post(self, request):
        _nur_betreiber(request)
        daten = request.data
        if not isinstance(daten, dict):
            return Response(
                {"detail": "JSON-Objekt erwartet."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        note = daten.get("note") or ""
        tage = daten.get("tage", 7)
        max_uses = daten.get("max_uses")
        if not isinstance(tage, int) or isinstance(tage, bool):
            return Response(
                {"tage": "Laufzeit muss eine ganze Zahl sein."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            einladung, rohtoken = erstelle_instanz_einladung(
                request.user, note=note, max_uses=max_uses, tage=tage
            )
        except EinladungUngueltigeEingabe as fehler:
            return Response(fehler.felder, status=status.HTTP_400_BAD_REQUEST)
        antwort = einladung_daten(einladung)
        antwort["token"] = rohtoken
        antwort["invite_path"] = f"/beitritt/{rohtoken}"
        return Response(antwort, status=status.HTTP_201_CREATED)


class InstanzEinladungDetail(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "invitations-owner"

    def delete(self, request, einladung_id: int):
        _nur_betreiber(request)
        try:
            einladung = InstanzEinladung.objects.get(id=einladung_id)
        except InstanzEinladung.DoesNotExist as fehler:
            raise Http404 from fehler
        return Response(einladung_daten(widerrufe_instanz_einladung(einladung)))
