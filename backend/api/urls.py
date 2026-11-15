from django.urls import path

from . import bands, gigs, session, setlists, songs, views

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
    path("bands/<int:band_id>/setlists/", setlists.SetlistListe.as_view()),
    path("bands/<int:band_id>/setlists/<int:setlist_id>/", setlists.SetlistDetail.as_view()),
    path(
        "bands/<int:band_id>/setlists/<int:setlist_id>/content/",
        setlists.SetlistInhalt.as_view(),
    ),
    path("bands/<int:band_id>/gigs/", gigs.GigListe.as_view()),
    path("bands/<int:band_id>/gigs/<int:gig_id>/", gigs.GigDetail.as_view()),
]
