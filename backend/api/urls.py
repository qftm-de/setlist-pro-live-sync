from django.urls import path

from . import bands, session, songs, views

urlpatterns = [
    path("health/", views.health),
    path("config/", views.konfiguration),
    path("session/", session.sitzung),
    path("anmeldung/", session.anmeldung),
    path("abmeldung/", session.abmeldung),
    path("bands/", bands.BandListe.as_view()),
    path("bands/<int:band_id>/", bands.BandDetail.as_view()),
    path("bands/<int:band_id>/songs/", songs.SongListe.as_view()),
    path("bands/<int:band_id>/songs/<int:song_id>/", songs.SongDetail.as_view()),
]
