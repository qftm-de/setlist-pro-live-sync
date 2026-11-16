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
from collaboration.models import TextState
from collaboration.services import (
    EpocheVeraltet,
    ist_entfernt,
    merke_entfernt,
    text_ersetzen,
    update_anwenden,
    zustand,
    zustand_daten,
)
from collaboration.text import TextFehler, dekodiere, kodiere
from documents.models import DocumentVersion
from realtime.services import band_ereignis, persoenliches_ereignis

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


def _textzustaende(liste) -> dict:
    kennungen = [eintrag.uuid for eintrag in liste]
    if not kennungen:
        return {}
    vorhanden = {
        zeile.object_uuid: zeile
        for zeile in TextState.objects.filter(
            object_type=TextState.TYP_ANNOTATION,
            object_uuid__in=kennungen,
            field="text",
        )
    }
    return {kennung: vorhanden.get(kennung) for kennung in kennungen}


def daten(annotation: Annotation, request, owner: bool, textzustaende=None) -> dict:
    return AnnotationSerializer(
        annotation,
        context={
            "request": request,
            "ist_owner": owner,
            "textzustaende": textzustaende,
        },
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
        liste = list(sichtbare(version, request.user).order_by("id"))
        zustaende = _textzustaende(liste)
        return Response(
            [daten(eintrag, request, owner, zustaende) for eintrag in liste]
        )

    def post(self, request, band_id: int, song_id: int, version_id: int):
        band, version = version_fuer(request.user, band_id, song_id, version_id)
        owner = ist_owner(band, request.user)
        eingabe = AnnotationAnlageSerializer(
            data=request.data, context={"version": version, "request": request}
        )
        eingabe.is_valid(raise_exception=True)
        kennung = eingabe.validated_data["uuid"]
        if ist_entfernt(TextState.TYP_ANNOTATION, kennung):
            return Response(
                {"detail": "Diese UUID wurde gelöscht."},
                status=status.HTTP_409_CONFLICT,
            )
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
                zustand(
                    TextState.TYP_ANNOTATION,
                    annotation.uuid,
                    "text",
                    annotation.text,
                )
                self._melde(band, version, annotation)
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

    def _melde(self, band, version, annotation: Annotation) -> None:
        daten = {"id": annotation.id, "version_id": version.id}
        if annotation.visibility == Annotation.SICHTBAR_BAND:
            band_ereignis(band, "annotation.created", **daten)
        else:
            persoenliches_ereignis(band, annotation.author, "annotation.created", **daten)

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
        ist_autor = annotation.author_id == request.user.id
        if not ist_autor and annotation.visibility != Annotation.SICHTBAR_BAND:
            raise PermissionDenied("Nur der Autor darf diese Anmerkung ändern.")
        if not ist_autor and "visibility" in request.data:
            raise PermissionDenied("Nur der Autor darf die Sichtbarkeit ändern.")
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
            vorher_band = gesperrt.visibility == Annotation.SICHTBAR_BAND
            alter_text = gesperrt.text
            eingabe = AnnotationAenderungSerializer(
                instance=gesperrt,
                data=request.data,
                partial=True,
                context={"version": version, "request": request},
            )
            eingabe.is_valid(raise_exception=True)
            for feld, wert in eingabe.validated_data.items():
                setattr(gesperrt, feld, wert)
            if gesperrt.text != alter_text:
                text_ersetzen(
                    TextState.TYP_ANNOTATION, gesperrt.uuid, "text", gesperrt.text
                )
            if vorher_band and gesperrt.visibility == Annotation.SICHTBAR_PRIVAT:
                gesperrt.permission_generation += 1
            gesperrt.revision += 1
            gesperrt.save()
            self._melde_aenderung(band, version, gesperrt, vorher_band)
        return Response(daten(gesperrt, request, ist_owner(band, request.user)))

    def _melde_aenderung(self, band, version, annotation: Annotation, vorher_band: bool) -> None:
        daten = {"id": annotation.id, "version_id": version.id}
        jetzt_band = annotation.visibility == Annotation.SICHTBAR_BAND
        if vorher_band and jetzt_band:
            band_ereignis(band, "annotation.updated", **daten)
        elif vorher_band and not jetzt_band:
            band_ereignis(band, "annotation.entfernt", **daten)
            persoenliches_ereignis(band, annotation.author, "annotation.updated", **daten)
        elif not vorher_band and jetzt_band:
            # Immer Band vor Persönlich sperren, sonst deadlocken zwei
            # gleichzeitige Sichtbarkeitswechsel.
            band_ereignis(band, "annotation.created", **daten)
            persoenliches_ereignis(band, annotation.author, "annotation.entfernt", **daten)
        else:
            persoenliches_ereignis(band, annotation.author, "annotation.updated", **daten)

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
            if gesperrt.visibility == Annotation.SICHTBAR_BAND:
                band_ereignis(
                    band,
                    "annotation.entfernt",
                    id=gesperrt.id,
                    version_id=version_id,
                )
            else:
                persoenliches_ereignis(
                    band,
                    gesperrt.author,
                    "annotation.entfernt",
                    id=gesperrt.id,
                    version_id=version_id,
                )
            merke_entfernt(TextState.TYP_ANNOTATION, gesperrt.uuid)
            gesperrt.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
