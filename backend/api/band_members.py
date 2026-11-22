"""Mitgliederliste, Rollenwechsel und Entfernen für eine Band."""

from __future__ import annotations

from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from bands.dienste import (
    LetzterOwnerFehler,
    MitgliedNichtErlaubt,
    MitgliedNichtGefunden,
    UngueltigeRolle,
    ist_letzter_aktiver_owner,
    mitglied_entfernen,
    rolle_aendern,
)
from bands.models import Band, Membership

from .bands import band_fuer, band_fuer_owner


def _liste(band: Band) -> list[Membership]:
    return list(
        Membership.objects.filter(band=band)
        .select_related("user")
        .order_by("id")
    )


def _mitglied_daten(
    mitglied: Membership,
    akteur: Membership,
    ist_owner: bool,
    mitglieder: list[Membership],
) -> dict:
    letzter_owner = ist_letzter_aktiver_owner(mitglieder, mitglied)
    return {
        "id": mitglied.id,
        "user_id": mitglied.user_id,
        "username": mitglied.user.username,
        "display_name": mitglied.user.display_name or mitglied.user.get_username(),
        "role": mitglied.role,
        "is_self": mitglied.id == akteur.id,
        "can_change_role": ist_owner and not letzter_owner,
        "can_remove": (ist_owner or mitglied.id == akteur.id) and not letzter_owner,
    }


def _antwort(band: Band, akteur_user) -> list[dict]:
    mitglieder = _liste(band)
    akteur = next(
        (m for m in mitglieder if m.user_id == akteur_user.id), None
    )
    if akteur is None:
        raise Http404
    ist_owner = akteur.role == Membership.ROLE_OWNER
    return [
        _mitglied_daten(m, akteur, ist_owner, mitglieder) for m in mitglieder
    ]


class MitgliederListe(APIView):
    def get(self, request, band_id: int):
        band = band_fuer(request.user, band_id)
        return Response(_antwort(band, request.user))


class MitgliedDetail(APIView):
    def patch(self, request, band_id: int, membership_id: int):
        band = band_fuer_owner(request.user, band_id)
        daten = request.data
        if not isinstance(daten, dict):
            return Response(
                {"detail": "JSON-Objekt erwartet."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        rolle = daten.get("role")
        if not isinstance(rolle, str):
            return Response(
                {"role": "Rolle owner oder member ist Pflicht."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            rolle_aendern(band, request.user, membership_id, rolle)
        except UngueltigeRolle:
            return Response(
                {"role": "Rolle owner oder member ist Pflicht."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except MitgliedNichtErlaubt as fehler:
            raise PermissionDenied("Nur Band-Owner dürfen Rollen ändern.") from fehler
        except LetzterOwnerFehler:
            return Response(
                {"detail": "Die Band braucht mindestens einen Owner."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except MitgliedNichtGefunden as fehler:
            raise Http404 from fehler
        return Response(_antwort(band, request.user))

    def delete(self, request, band_id: int, membership_id: int):
        band = band_fuer(request.user, band_id)
        try:
            mitglied_entfernen(band, request.user, membership_id)
        except MitgliedNichtErlaubt as fehler:
            raise PermissionDenied("Nur Owner entfernen andere Mitglieder.") from fehler
        except LetzterOwnerFehler:
            return Response(
                {"detail": "Die Band braucht mindestens einen Owner."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except MitgliedNichtGefunden as fehler:
            raise Http404 from fehler
        return Response(status=status.HTTP_204_NO_CONTENT)
