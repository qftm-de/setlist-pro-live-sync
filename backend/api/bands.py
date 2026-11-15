from django.db import transaction
from django.http import Http404
from rest_framework import generics

from bands.models import Band, Membership
from realtime.services import band_ereignis

from .serializers import BandSerializer


def band_fuer(user, band_id: int) -> Band:
    """Band nur für Mitglieder. Fremde Band ist 404, nicht 403."""
    try:
        return Band.objects.get(id=band_id, memberships__user=user)
    except Band.DoesNotExist as fehler:
        raise Http404 from fehler


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

    def perform_update(self, serializer):
        with transaction.atomic():
            band = serializer.save()
            band_ereignis(band, "band.updated", name=band.name)
