"""API für Song-PDFs. Jeder Zugriff prüft die Bandmitgliedschaft neu."""

from __future__ import annotations

import re
import uuid
from pathlib import Path

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Max
from django.http import Http404
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from documents.models import Document, DocumentVersion
from documents.pruefung import PdfUngueltig, pruefe_pdf
from documents.storage import (
    entferne,
    neuer_schluessel,
    streame_upload,
    temporaerer_pfad,
    verschiebe_nach_final,
)
from library.models import Song
from realtime.services import band_ereignis

from .bands import band_fuer
from .document_serializers import AktivierungSerializer, DocumentVersionSerializer

DATEI_ZU_GROSS = {"detail": "Die Datei ist zu groß."}
VERSION_KONFLIKT = {"detail": "Die aktive Version wurde inzwischen geändert."}


def song_fuer(user, band_id: int, song_id: int) -> Song:
    band = band_fuer(user, band_id)
    try:
        return Song.objects.get(id=song_id, band=band)
    except Song.DoesNotExist as fehler:
        raise Http404 from fehler


def sauberer_name(roh: str | None) -> str:
    name = re.split(r"[\\/]", str(roh or ""))[-1]
    name = "".join(zeichen for zeichen in name if zeichen >= " " and zeichen != "\x7f")
    name = name.strip().strip(".") or "dokument.pdf"
    return name[:255]


def grenzen() -> dict:
    return {
        "max_upload_bytes": settings.PDF_MAX_UPLOAD_BYTES,
        "max_pages": settings.PDF_MAX_PAGES,
    }


def dokument_daten(dokument: Document | None) -> dict:
    if dokument is None:
        return {
            "id": None,
            "revision": 0,
            "active_version_id": None,
            "versions": [],
            "limits": grenzen(),
        }
    versionen = dokument.versions.all()
    return {
        "id": dokument.id,
        "revision": dokument.revision,
        "active_version_id": dokument.active_version_id,
        "versions": DocumentVersionSerializer(versionen, many=True).data,
        "limits": grenzen(),
    }


class DokumentDetail(APIView):
    def get(self, request, band_id: int, song_id: int):
        song = song_fuer(request.user, band_id, song_id)
        dokument = Document.objects.filter(song=song).first()
        return Response(dokument_daten(dokument))

    def patch(self, request, band_id: int, song_id: int):
        song = song_fuer(request.user, band_id, song_id)
        eingabe = AktivierungSerializer(data=request.data)
        eingabe.is_valid(raise_exception=True)
        with transaction.atomic():
            dokument = (
                Document.objects.select_for_update().filter(song=song).first()
            )
            if dokument is None:
                raise Http404
            if eingabe.validated_data["revision"] != dokument.revision:
                return Response(VERSION_KONFLIKT, status=status.HTTP_409_CONFLICT)
            version_id = eingabe.validated_data["active_version_id"]
            if version_id is not None and not DocumentVersion.objects.filter(
                id=version_id, document=dokument
            ).exists():
                raise Http404
            dokument.active_version_id = version_id
            dokument.revision += 1
            dokument.save(update_fields=["active_version", "revision", "updated_at"])
            band_ereignis(
                song.band,
                "document.updated",
                song_id=song.id,
                revision=dokument.revision,
            )
        return Response(dokument_daten(dokument))


class DokumentVersionen(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request, band_id: int, song_id: int):
        song = song_fuer(request.user, band_id, song_id)
        roh = request.query_params.get("upload_id", "")
        try:
            upload_id = uuid.UUID(str(roh))
        except (ValueError, AttributeError, TypeError):
            return Response(
                {"upload_id": ["Gültige UUID erforderlich."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        versionen = DocumentVersion.objects.filter(
            document__song=song, upload_id=upload_id
        )
        return Response(DocumentVersionSerializer(versionen, many=True).data)

    def post(self, request, band_id: int, song_id: int):
        song = song_fuer(request.user, band_id, song_id)
        datei = request.FILES.get("file")
        if datei is None:
            return Response(
                {"file": ["PDF-Datei fehlt."]}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            upload_id = uuid.UUID(str(request.data.get("upload_id", "")))
        except (ValueError, AttributeError, TypeError):
            return Response(
                {"upload_id": ["Gültige UUID erforderlich."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        grenze = settings.PDF_MAX_UPLOAD_BYTES
        if grenze > 0 and datei.size is not None and datei.size > grenze:
            return Response(DATEI_ZU_GROSS, status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

        temp = temporaerer_pfad()
        final: Path | None = None
        try:
            sha256, groesse = streame_upload(datei, temp)
            if grenze > 0 and groesse > grenze:
                return Response(DATEI_ZU_GROSS, status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

            vorhanden = DocumentVersion.objects.filter(
                document__song=song, upload_id=upload_id
            ).first()
            if vorhanden is not None:
                return self._wiederholung(vorhanden, sha256)

            try:
                ergebnis = pruefe_pdf(temp)
            except PdfUngueltig as fehler:
                return Response(
                    {"file": [fehler.meldung]}, status=status.HTTP_400_BAD_REQUEST
                )

            name = sauberer_name(datei.name)
            try:
                with transaction.atomic():
                    try:
                        gesperrt = Song.objects.select_for_update().get(id=song.id)
                    except Song.DoesNotExist as fehler:
                        raise Http404 from fehler
                    dokument = (
                        Document.objects.select_for_update()
                        .filter(song=gesperrt)
                        .first()
                    )
                    if dokument is None:
                        dokument = Document.objects.create(song=gesperrt)
                    doppelt = DocumentVersion.objects.filter(
                        document=dokument, upload_id=upload_id
                    ).first()
                    if doppelt is not None:
                        return self._wiederholung(doppelt, sha256)
                    nummer = (
                        dokument.versions.aggregate(Max("number"))["number__max"] or 0
                    ) + 1
                    schluessel = neuer_schluessel()
                    version = DocumentVersion.objects.create(
                        document=dokument,
                        number=nummer,
                        upload_id=upload_id,
                        file_key=schluessel,
                        original_name=name,
                        byte_size=groesse,
                        page_count=ergebnis.seiten,
                        sha256=sha256,
                        uploaded_by=request.user,
                    )
                    band_ereignis(
                        song.band,
                        "document.version_created",
                        song_id=song.id,
                        version_id=version.id,
                    )
                    final = verschiebe_nach_final(temp, schluessel)
            except IntegrityError:
                if final is not None:
                    entferne(final)
                return Response(
                    {"detail": "Der Upload wurde gleichzeitig verarbeitet. Bitte abgleichen."},
                    status=status.HTTP_409_CONFLICT,
                )
            return Response(
                DocumentVersionSerializer(version).data, status=status.HTTP_201_CREATED
            )
        except Exception:
            if final is not None:
                entferne(final)
            raise
        finally:
            entferne(temp)

    def _wiederholung(self, version: DocumentVersion, sha256: str) -> Response:
        if version.sha256 == sha256:
            return Response(DocumentVersionSerializer(version).data)
        return Response(
            {"detail": "Diese Upload-ID gehört bereits zu einer anderen Datei."},
            status=status.HTTP_409_CONFLICT,
        )
