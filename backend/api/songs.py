from django.db.models.deletion import ProtectedError
from django.http import Http404
from rest_framework import generics, status
from rest_framework.response import Response

from library.models import Song

from .bands import band_fuer
from .serializers import SongSerializer


class SongListe(generics.ListCreateAPIView):
    serializer_class = SongSerializer

    def get_queryset(self):
        band = band_fuer(self.request.user, self.kwargs["band_id"])
        return Song.objects.filter(band=band)

    def perform_create(self, serializer):
        band = band_fuer(self.request.user, self.kwargs["band_id"])
        serializer.save(band=band)


class SongDetail(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SongSerializer

    def get_object(self):
        band = band_fuer(self.request.user, self.kwargs["band_id"])
        try:
            return Song.objects.get(id=self.kwargs["song_id"], band=band)
        except Song.DoesNotExist as fehler:
            raise Http404 from fehler

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "Song steht in einer Setlist. Erst dort entfernen."},
                status=status.HTTP_400_BAD_REQUEST,
            )
