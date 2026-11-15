"""API für Anmerkungen. Sichtbarkeit und Aktionsrechte werden je Anfrage geprüft."""

from __future__ import annotations

from collections.abc import Mapping

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from annotations.models import Annotation
from bands.models import Membership
from documents.models import DocumentVersion

from .annotation_serializers import (
    AnnotationAenderungSerializer,
    AnnotationAnlageSerializer,
    AnnotationSerializer,
)
from .bands import band_fuer
from .documents import song_fuer


def version_fuer(user, band_id: int, song_id: int, version_id: int):
    band = band_fuer(user, band_id)
    song = song_fuer(user, band_id, song_id)
    try:
        version = DocumentVersion.objects.get(id=version_id, document__song=song)
    except DocumentVersion.DoesNotExist as fehler:
        raise Http404 from fehler
    return band, version


def ist_owner(band, user) -> bool:
    return Membership.objects.filter(
        band=band, user=user, role=Membership.ROLE_OWNER
    ).exists()


def sichtbare(version, user):
    return Annotation.objects.filter(document_version=version).filter(
        Q(author=user) | Q(visibility=Annotation.SICHTBAR_BAND)
    )


def daten(annotation: Annotation, request, owner: bool) -> dict:
    return AnnotationSerializer(
        annotation, context={"request": request, "ist_owner": owner}
    ).data


def revision_aus(wert) -> int:
    if isinstance(wert, bool):
        raise ValueError
    zahl = int(wert)
    if zahl < 0:
        raise ValueError
    return zahl


class AnnotationListe(APIView):
    def get(self, request, band_id: int, song_id: int, version_id: int):
        band, version = version_fuer(request.user, band_id, song_id, version_id)
        owner = ist_owner(band, request.user)
        liste = sichtbare(version, request.user).order_by("id")
        return Response(
            [daten(eintrag, request, owner) for eintrag in liste]
        )

    def post(self, request, band_id: int, song_id: int, version_id: int):
        band, version = version_fuer(request.user, band_id, song_id, version_id)
        owner = ist_owner(band, request.user)
        eingabe = AnnotationAnlageSerializer(
            data=request.data, context={"version": version, "request": request}
        )
        eingabe.is_valid(raise_exception=True)
        kennung = eingabe.validated_data["uuid"]
        bestehend = Annotation.objects.filter(uuid=kennung).first()
        if bestehend is not None:
            return self._wiederholung(bestehend, eingabe, request, owner, version)

        try:
            with transaction.atomic():
                annotation = Annotation.objects.create(
                    document_version=version,
                    author=request.user,
                    **eingabe.validated_data,
                )
        except IntegrityError:
            bestehend = Annotation.objects.filter(uuid=kennung).first()
            if bestehend is None:
                return Response(
                    {"detail": "Die Anmerkung wurde gleichzeitig angelegt. Bitte abgleichen."},
                    status=status.HTTP_409_CONFLICT,
                )
            return self._wiederholung(bestehend, eingabe, request, owner, version)
        return Response(
            daten(annotation, request, owner), status=status.HTTP_201_CREATED
        )

    def _wiederholung(self, bestehend, eingabe, request, owner, version) -> Response:
        gleich = (
            bestehend.document_version_id == version.id
            and bestehend.author_id == request.user.id
            and {
                "page_number": bestehend.page_number,
                "kind": bestehend.kind,
                "visibility": bestehend.visibility,
                "geometry": bestehend.geometry,
                "color": bestehend.color,
                "text": bestehend.text,
                "font_size": bestehend.font_size,
            }
            == eingabe.signatur()
        )
        if gleich:
            return Response(daten(bestehend, request, owner))
        return Response(
            {"detail": "Diese UUID gehört bereits zu anderen Anlagedaten."},
            status=status.HTTP_409_CONFLICT,
        )


class AnnotationDetail(APIView):
    def _objekt(self, request, band_id, song_id, version_id, annotation_id):
        band, version = version_fuer(request.user, band_id, song_id, version_id)
        try:
            annotation = sichtbare(version, request.user).get(id=annotation_id)
        except Annotation.DoesNotExist as fehler:
            raise Http404 from fehler
        return band, version, annotation

    def get(self, request, band_id: int, song_id: int, version_id: int, annotation_id: int):
        band, _, annotation = self._objekt(
            request, band_id, song_id, version_id, annotation_id
        )
        return Response(daten(annotation, request, ist_owner(band, request.user)))

    def patch(self, request, band_id: int, song_id: int, version_id: int, annotation_id: int):
        band, version, annotation = self._objekt(
            request, band_id, song_id, version_id, annotation_id
        )
        if annotation.author_id != request.user.id:
            raise PermissionDenied("Nur der Autor darf diese Anmerkung ändern.")
        if not isinstance(request.data, Mapping):
            return Response(
                {"detail": "JSON-Objekt erwartet."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            erwartet = revision_aus(request.data.get("revision"))
        except (TypeError, ValueError):
            return Response(
                {"revision": ["Erwartete Revision fehlt."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            gesperrt = Annotation.objects.select_for_update().filter(id=annotation.id).first()
            if gesperrt is None:
                raise Http404
            if gesperrt.revision != erwartet:
                return Response(
                    {"detail": "Die Anmerkung wurde inzwischen geändert."},
                    status=status.HTTP_409_CONFLICT,
                )
            eingabe = AnnotationAenderungSerializer(
                instance=gesperrt,
                data=request.data,
                partial=True,
                context={"version": version, "request": request},
            )
            eingabe.is_valid(raise_exception=True)
            for feld, wert in eingabe.validated_data.items():
                setattr(gesperrt, feld, wert)
            gesperrt.revision += 1
            gesperrt.save()
        return Response(daten(gesperrt, request, ist_owner(band, request.user)))

    def delete(self, request, band_id: int, song_id: int, version_id: int, annotation_id: int):
        band, _, annotation = self._objekt(
            request, band_id, song_id, version_id, annotation_id
        )
        try:
            erwartet = revision_aus(request.query_params.get("revision"))
        except (TypeError, ValueError):
            return Response(
                {"revision": ["Erwartete Revision fehlt."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        owner = ist_owner(band, request.user)
        darf = annotation.author_id == request.user.id or (
            owner and annotation.visibility == Annotation.SICHTBAR_BAND
        )
        if not darf:
            raise PermissionDenied("Diese Anmerkung darf nicht gelöscht werden.")
        with transaction.atomic():
            gesperrt = Annotation.objects.select_for_update().filter(id=annotation.id).first()
            if gesperrt is None:
                raise Http404
            if gesperrt.revision != erwartet:
                return Response(
                    {"detail": "Die Anmerkung wurde inzwischen geändert."},
                    status=status.HTTP_409_CONFLICT,
                )
            gesperrt.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
