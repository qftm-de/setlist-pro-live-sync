from django.db import transaction
from django.db.models.deletion import ProtectedError
from django.http import Http404
from rest_framework import generics, status
from rest_framework.response import Response

from documents.models import Document
from library.models import Song
from realtime.services import band_ereignis

from .bands import band_fuer
from .serializers import SongSerializer


class SongListe(generics.ListCreateAPIView):
    serializer_class = SongSerializer

    def get_queryset(self):
        band = band_fuer(self.request.user, self.kwargs["band_id"])
        return Song.objects.filter(band=band)

    def perform_create(self, serializer):
        band = band_fuer(self.request.user, self.kwargs["band_id"])
        with transaction.atomic():
            song = serializer.save(band=band)
            band_ereignis(band, "song.created", id=song.id)


class SongDetail(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SongSerializer

    def get_object(self):
        band = band_fuer(self.request.user, self.kwargs["band_id"])
        try:
            return Song.objects.get(id=self.kwargs["song_id"], band=band)
        except Song.DoesNotExist as fehler:
            raise Http404 from fehler

    def perform_update(self, serializer):
        with transaction.atomic():
            song = serializer.save()
            band_ereignis(song.band, "song.updated", id=song.id)

    def perform_destroy(self, instance):
        with transaction.atomic():
            band = instance.band
            kennung = instance.id
            instance.delete()
            band_ereignis(band, "song.deleted", id=kennung)

    def destroy(self, request, *args, **kwargs):
        song = self.get_object()
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            if Document.objects.filter(song=song).exists():
                return Response(
                    {"detail": "Song hat PDF-Versionen und kann nicht gelöscht werden."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(
                {"detail": "Song steht in einer Setlist. Erst dort entfernen."},
                status=status.HTTP_400_BAD_REQUEST,
            )
