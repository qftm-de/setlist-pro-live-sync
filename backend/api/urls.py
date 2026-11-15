from django.urls import path

from . import (
    annotations,
    bands,
    document_datei,
    documents,
    gigs,
    session,
    setlists,
    songs,
    sync,
    views,
)

urlpatterns = [
    path("health/", views.health),
    path("config/", views.konfiguration),
    path("session/", session.sitzung),
    path("anmeldung/", session.anmeldung),
    path("abmeldung/", session.abmeldung),
    path("bands/", bands.BandListe.as_view()),
    path("bands/<int:band_id>/", bands.BandDetail.as_view()),
    path("bands/<int:band_id>/sync/", sync.BandAbgleich.as_view()),
    path("bands/<int:band_id>/songs/", songs.SongListe.as_view()),
    path("bands/<int:band_id>/songs/<int:song_id>/", songs.SongDetail.as_view()),
    path(
        "bands/<int:band_id>/songs/<int:song_id>/document/",
        documents.DokumentDetail.as_view(),
    ),
    path(
        "bands/<int:band_id>/songs/<int:song_id>/document/versions/",
        documents.DokumentVersionen.as_view(),
    ),
    path(
        "bands/<int:band_id>/songs/<int:song_id>/document/versions/<int:version_id>/file/",
        document_datei.DokumentDatei.as_view(),
    ),
    path(
        "bands/<int:band_id>/songs/<int:song_id>/document/versions/<int:version_id>/annotations/",
        annotations.AnnotationListe.as_view(),
    ),
    path(
        "bands/<int:band_id>/songs/<int:song_id>/document/versions/<int:version_id>/annotations/<int:annotation_id>/",
        annotations.AnnotationDetail.as_view(),
    ),
    path("bands/<int:band_id>/setlists/", setlists.SetlistListe.as_view()),
    path("bands/<int:band_id>/setlists/<int:setlist_id>/", setlists.SetlistDetail.as_view()),
    path(
        "bands/<int:band_id>/setlists/<int:setlist_id>/content/",
        setlists.SetlistInhalt.as_view(),
    ),
    path("bands/<int:band_id>/gigs/", gigs.GigListe.as_view()),
    path("bands/<int:band_id>/gigs/<int:gig_id>/", gigs.GigDetail.as_view()),
]
