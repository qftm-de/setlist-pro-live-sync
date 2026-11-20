"""Bandexport als ZIP. Zugriff nur für Mitglieder, Größe begrenzt."""

from __future__ import annotations

import unicodedata
from urllib.parse import quote

from django.conf import settings
from django.http import FileResponse, JsonResponse
from rest_framework.renderers import BaseRenderer, JSONRenderer
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView, exception_handler

from export.archiv import ExportZuGross, baue_archiv, pruefe_groesse
from export.inhalt import band_export

from .bands import band_fuer

ZU_GROSS = {"detail": "Der Export überschreitet die Größenobergrenze."}


class ZipRenderer(BaseRenderer):
    """Nur für die Inhaltsaushandlung; die ZIP-Antwort ist ein FileResponse."""

    media_type = "application/zip"
    format = "zip"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


def fehler_als_json(exc, context):
    """Fehlerpfade umgehen den ZIP-Renderer, damit Status und JSON stimmen."""
    antwort = exception_handler(exc, context)
    if antwort is None:
        return None
    return JsonResponse(antwort.data, status=antwort.status_code, safe=False)


def download_name(bandname: str) -> str:
    sauber = "".join(
        zeichen
        for zeichen in str(bandname or "")
        if zeichen >= " " and zeichen not in '\\/:*?"<>|'
    )
    sauber = "-".join(sauber.split())[:80] or "band"
    return f"{sauber}-export.zip"


def disposition(bandname: str) -> str:
    name = download_name(bandname)
    ascii_name = (
        unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
        or "band-export.zip"
    )
    return (
        f'attachment; filename="{ascii_name}"; '
        f"filename*=UTF-8''{quote(name, safe='')}"
    )


class BandExport(APIView):
    renderer_classes = [JSONRenderer, ZipRenderer]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "export"

    def get_exception_handler(self):
        return fehler_als_json

    def get(self, request, band_id: int):
        band = band_fuer(request.user, band_id)
        manifest, pdfs = band_export(band, request.user)
        try:
            pruefe_groesse(pdfs, settings.EXPORT_MAX_BYTES)
            archiv, _ = baue_archiv(manifest, pdfs, settings.EXPORT_MAX_BYTES)
        except ExportZuGross:
            return JsonResponse(ZU_GROSS, status=413)
        antwort = FileResponse(
            archiv,
            as_attachment=True,
            content_type="application/zip",
        )
        antwort["Content-Disposition"] = disposition(band.name)
        antwort["Cache-Control"] = "private, no-store"
        antwort["X-Content-Type-Options"] = "nosniff"
        return antwort
