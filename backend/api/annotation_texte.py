"""CRDT-Text einer Anmerkung. Rechte, Art und Generation je Aufruf prüfen."""

from __future__ import annotations

from collections.abc import Mapping

from django.db import transaction
from django.http import Http404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from annotations.models import Annotation
from collaboration.models import TextState
from collaboration.services import (
    EpocheVeraltet,
    update_anwenden,
    zustand_daten,
    zustand_lesen,
)
from collaboration.text import TextFehler, dekodiere, kodiere
from realtime.services import band_ereignis, persoenliches_ereignis

from .annotations import revision_aus, sichtbare, version_fuer


class AnnotationTexte(APIView):
    """CRDT-Text einer Anmerkung. Rechte und Generation werden je Aufruf geprüft."""

    def _objekt(self, request, band_id, song_id, version_id, annotation_id):
        band, version = version_fuer(request.user, band_id, song_id, version_id)
        try:
            annotation = sichtbare(version, request.user).get(id=annotation_id)
        except Annotation.DoesNotExist as fehler:
            raise Http404 from fehler
        autor = annotation.author_id == request.user.id
        if annotation.visibility == Annotation.SICHTBAR_PRIVAT and not autor:
            raise Http404
        return band, version, annotation, autor

    def get(self, request, band_id, song_id, version_id, annotation_id):
        band, version, annotation, _ = self._objekt(
            request, band_id, song_id, version_id, annotation_id
        )
        obj = zustand_lesen(
            TextState.TYP_ANNOTATION, annotation.uuid, "text", annotation.text
        )
        return Response(
            {
                **zustand_daten(obj),
                "generation": annotation.permission_generation,
                "annotation_revision": annotation.revision,
            }
        )

    def post(self, request, band_id, song_id, version_id, annotation_id):
        band, version, annotation, _ = self._objekt(
            request, band_id, song_id, version_id, annotation_id
        )
        if annotation.kind != Annotation.ART_TEXT:
            return Response(
                {"detail": "Nur Textanmerkungen haben Text."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not isinstance(request.data, Mapping):
            return Response(
                {"detail": "JSON-Objekt erwartet."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            erwartete_epoche = revision_aus(request.data.get("epoch"))
            generation = revision_aus(request.data.get("generation"))
        except (TypeError, ValueError):
            return Response(
                {"epoch": ["Epoche und Generation sind Pflicht."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if generation != annotation.permission_generation:
            return Response(
                {"detail": "Die Berechtigungsgeneration ist veraltet."},
                status=status.HTTP_409_CONFLICT,
            )
        try:
            with transaction.atomic():
                gesperrt = (
                    Annotation.objects.select_for_update()
                    .filter(id=annotation.id)
                    .first()
                )
                if gesperrt is None:
                    raise Http404
                if gesperrt.kind != Annotation.ART_TEXT:
                    raise TextFehler("Nur Textanmerkungen haben Text.")
                if gesperrt.permission_generation != generation:
                    return Response(
                        {"detail": "Die Berechtigungsgeneration ist veraltet."},
                        status=status.HTTP_409_CONFLICT,
                    )
                obj, text = update_anwenden(
                    TextState.TYP_ANNOTATION,
                    gesperrt.uuid,
                    "text",
                    erwartete_epoche,
                    dekodiere(request.data.get("update")),
                    gesperrt.text,
                )
                if not text.strip():
                    # Als Ausnahme, damit der bereits geschriebene CRDT-Zustand
                    # zurückgerollt wird. Keine Teiländerung.
                    raise TextFehler("Eine Textanmerkung braucht Text.")
                gesperrt.text = text.strip()
                # Textänderungen sind über Epoche und Generation geschützt.
                # Die REST-Revision bleibt für Geometrie, Farbe usw. stabil.
                gesperrt.save(update_fields=["text", "updated_at"])
                daten = {
                    "id": gesperrt.id,
                    "version_id": version.id,
                    "uuid": str(gesperrt.uuid),
                    "epoch": obj.epoch,
                    "generation": gesperrt.permission_generation,
                    "revision": gesperrt.revision,
                    # Delta statt Vollzustand: der Vollzustand wächst mit jeder
                    # Bearbeitung und geht an alle Berechtigten.
                    "update": request.data.get("update"),
                }
                if gesperrt.visibility == Annotation.SICHTBAR_BAND:
                    band_ereignis(band, "annotation.text", **daten)
                else:
                    persoenliches_ereignis(
                        band, gesperrt.author, "annotation.text", **daten
                    )
        except EpocheVeraltet as fehler:
            return Response(
                {
                    "detail": str(fehler),
                    "epoch": True,
                    "current_epoch": fehler.current_epoch,
                },
                status=status.HTTP_409_CONFLICT,
            )
        except TextFehler as fehler:
            return Response(
                {"detail": str(fehler)}, status=status.HTTP_400_BAD_REQUEST
            )
        return Response(
            {
                "text": text.strip(),
                "epoch": obj.epoch,
                "generation": gesperrt.permission_generation,
                "revision": gesperrt.revision,
                "update": kodiere(bytes(obj.state)),
            }
        )
