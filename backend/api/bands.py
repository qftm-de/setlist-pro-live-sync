from django.db import transaction
from django.http import Http404
from rest_framework import generics
from rest_framework.exceptions import PermissionDenied

from bands.dienste import (
    MitgliedNichtErlaubt,
    MitgliedNichtGefunden,
    band_owner_sperren,
    ist_owner,
)
from bands.models import Band, Membership
from realtime.services import band_ereignis

from .serializers import BandSerializer


def band_fuer(user, band_id: int) -> Band:
    """Band nur für Mitglieder. Fremde Band ist 404, nicht 403."""
    try:
        return Band.objects.get(id=band_id, memberships__user=user)
    except Band.DoesNotExist as fehler:
        raise Http404 from fehler


def band_fuer_owner(user, band_id: int) -> Band:
    """Mitglieder ohne Owner-Rolle erhalten 403, Fremde 404."""
    band = band_fuer(user, band_id)
    if not ist_owner(band, user):
        raise PermissionDenied("Nur Band-Owner dürfen das.")
    return band


class BandListe(generics.ListCreateAPIView):
    serializer_class = BandSerializer

    def get_queryset(self):
        return (
            Band.objects.filter(memberships__user=self.request.user)
            .prefetch_related("songs")
            .distinct()
        )

    def perform_create(self, serializer):
        with transaction.atomic():
            band = serializer.save(created_by=self.request.user)
            Membership.objects.create(
                band=band, user=self.request.user, role=Membership.ROLE_OWNER
            )
            band_ereignis(band, "band.created", name=band.name)


class BandDetail(generics.RetrieveUpdateAPIView):
    serializer_class = BandSerializer
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return band_fuer(self.request.user, self.kwargs["band_id"])

    def patch(self, request, *args, **kwargs):
        band = band_fuer_owner(request.user, self.kwargs["band_id"])
        try:
            with transaction.atomic():
                band_owner_sperren(band, request.user)
                return self.partial_update(request, *args, **kwargs)
        except MitgliedNichtGefunden as fehler:
            raise Http404 from fehler
        except MitgliedNichtErlaubt as fehler:
            raise PermissionDenied("Nur Band-Owner dürfen das.") from fehler

    def perform_update(self, serializer):
        with transaction.atomic():
            band = serializer.save()
            band_ereignis(band, "band.updated", name=band.name)
