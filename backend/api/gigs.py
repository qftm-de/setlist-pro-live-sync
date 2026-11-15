import datetime

from django.db import IntegrityError, transaction
from django.http import Http404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response

from gigs.models import Gig

from .bands import band_fuer
from .gig_serializers import SETLIST_REFERENZ, GigSerializer


def gig_fuer(user, band_id: int, gig_id: int) -> Gig:
    band = band_fuer(user, band_id)
    try:
        return Gig.objects.select_related("setlist").get(id=gig_id, band=band)
    except Gig.DoesNotExist as fehler:
        raise Http404 from fehler


def sortierschluessel(gig: Gig, absteigend: bool = False):
    datum = gig.date.toordinal()
    return (
        -datum if absteigend else datum,
        gig.time is None,
        gig.time or datetime.time.min,
        gig.id,
    )


class GigListe(generics.ListCreateAPIView):
    serializer_class = GigSerializer

    def get_queryset(self):
        band = band_fuer(self.request.user, self.kwargs["band_id"])
        return Gig.objects.filter(band=band).select_related("setlist")

    def get_serializer_context(self):
        return {
            **super().get_serializer_context(),
            "band": band_fuer(self.request.user, self.kwargs["band_id"]),
        }

    def list(self, request, *args, **kwargs):
        heute = timezone.localdate()
        gigs = list(self.get_queryset())
        kommend = sorted(
            (gig for gig in gigs if gig.date >= heute), key=sortierschluessel
        )
        vergangen = sorted(
            (gig for gig in gigs if gig.date < heute),
            key=lambda gig: sortierschluessel(gig, absteigend=True),
        )
        return Response(
            {
                "upcoming": GigSerializer(kommend, many=True).data,
                "past": GigSerializer(vergangen, many=True).data,
            }
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                self.perform_create(serializer)
        except IntegrityError:
            # Die Setlist wurde zwischen Validierung und Speichern gelöscht.
            return Response(
                {"setlist_id": [SETLIST_REFERENZ]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            GigSerializer(serializer.instance).data,
            status=status.HTTP_201_CREATED,
        )

    def perform_create(self, serializer):
        band = band_fuer(self.request.user, self.kwargs["band_id"])
        serializer.save(band=band)


class GigDetail(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = GigSerializer
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_object(self):
        return gig_fuer(
            self.request.user, self.kwargs["band_id"], self.kwargs["gig_id"]
        )

    def get_serializer_context(self):
        return {
            **super().get_serializer_context(),
            "band": band_fuer(self.request.user, self.kwargs["band_id"]),
        }

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instanz = self.get_object()
        serializer = self.get_serializer(instanz, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                self.perform_update(serializer)
        except IntegrityError:
            # Die Setlist wurde zwischen Validierung und Speichern gelöscht.
            return Response(
                {"setlist_id": [SETLIST_REFERENZ]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Erst nach dem Commit serialisieren, damit ein Fremdschlüsselkonflikt
        # nicht vorher als fehlende Setlist im Response landet. Der neue
        # Setlist-Name kommt frisch aus der Datenbank, nicht aus dem Cache.
        try:
            frisch = Gig.objects.select_related("setlist").get(pk=instanz.pk)
        except Gig.DoesNotExist as fehler:
            raise Http404 from fehler
        return Response(GigSerializer(frisch).data)
