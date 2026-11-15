from django.db import IntegrityError, transaction
from django.http import Http404
from rest_framework import generics, status
from rest_framework.response import Response

from realtime.services import band_ereignis
from setlists.content import ersetze_inhalt
from setlists.models import NAME_VERGEBEN, Setlist

from .bands import band_fuer
from .serializers import InhaltEingabeSerializer, SetlistKurzSerializer, SetlistSerializer


def setlist_fuer(user, band_id: int, setlist_id: int) -> Setlist:
    band = band_fuer(user, band_id)
    try:
        return Setlist.objects.prefetch_related("sections__entries__song").get(
            id=setlist_id, band=band
        )
    except Setlist.DoesNotExist as fehler:
        raise Http404 from fehler


class SetlistListe(generics.ListCreateAPIView):
    serializer_class = SetlistKurzSerializer

    def get_queryset(self):
        band = band_fuer(self.request.user, self.kwargs["band_id"])
        return Setlist.objects.filter(band=band)

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "band": band_fuer(
            self.request.user, self.kwargs["band_id"]
        )}

    def perform_create(self, serializer):
        band = band_fuer(self.request.user, self.kwargs["band_id"])
        serializer.save(band=band)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                self.perform_create(serializer)
                band_ereignis(
                    serializer.instance.band,
                    "setlist.created",
                    id=serializer.instance.id,
                )
        except IntegrityError:
            # Zwei gleichzeitige Anfragen haben die Prüfung beide passiert.
            return Response(
                {"name": [NAME_VERGEBEN]}, status=status.HTTP_400_BAD_REQUEST
            )
        return Response(SetlistSerializer(serializer.instance).data, status=201)


class SetlistDetail(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SetlistSerializer
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def update(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
                return super().update(request, *args, **kwargs)
        except IntegrityError:
            return Response(
                {"name": [NAME_VERGEBEN]}, status=status.HTTP_400_BAD_REQUEST
            )

    def get_object(self):
        return setlist_fuer(
            self.request.user, self.kwargs["band_id"], self.kwargs["setlist_id"]
        )

    def perform_update(self, serializer):
        with transaction.atomic():
            setlist = serializer.save()
            band_ereignis(setlist.band, "setlist.updated", id=setlist.id)

    def perform_destroy(self, instance):
        with transaction.atomic():
            band = instance.band
            kennung = instance.id
            instance.delete()
            band_ereignis(band, "setlist.deleted", id=kennung)

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "band": band_fuer(
            self.request.user, self.kwargs["band_id"]
        )}


class SetlistInhalt(generics.GenericAPIView):
    """Inhalt als Ganzes ersetzen. Ein Aufruf, eine Transaktion."""

    def put(self, request, band_id: int, setlist_id: int):
        setlist = setlist_fuer(request.user, band_id, setlist_id)
        band = setlist.band
        eingabe = InhaltEingabeSerializer(data=request.data, context={"band": band})
        eingabe.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                ersetze_inhalt(setlist, eingabe.validated_data["sections"])
                band_ereignis(setlist.band, "setlist.content", id=setlist.id)
        except Setlist.DoesNotExist as fehler:
            # Ein anderes Mitglied hat die Setlist im selben Moment gelöscht.
            raise Http404 from fehler
        except IntegrityError:
            # Ein Song wurde im selben Moment gelöscht.
            return Response(
                {"sections": ["Ein Song wurde inzwischen entfernt."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        frisch = Setlist.objects.prefetch_related("sections__entries__song").get(
            pk=setlist.pk
        )
        return Response(SetlistSerializer(frisch).data, status=status.HTTP_200_OK)
