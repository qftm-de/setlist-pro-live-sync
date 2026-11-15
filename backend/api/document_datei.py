"""Private Dateiauslieferung mit Byte-Ranges. Niemals öffentliche URLs."""

from __future__ import annotations

import unicodedata
from pathlib import Path
from urllib.parse import quote

from django.http import Http404, HttpResponse, StreamingHttpResponse
from rest_framework.renderers import BaseRenderer, JSONRenderer
from rest_framework.views import APIView

from documents.models import DocumentVersion
from documents.storage import AblageFehler, dateipfad

from .documents import song_fuer

BLOCKGROESSE = 64 * 1024


class PdfRenderer(BaseRenderer):
    media_type = "application/pdf"
    format = "pdf"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


def _bereich(header: str | None, groesse: int) -> tuple[int, int] | None:
    if not header:
        return None
    if not header.startswith("bytes="):
        raise ValueError
    angabe = header[len("bytes=") :].strip()
    if "," in angabe or "-" not in angabe:
        raise ValueError
    von, bis = angabe.split("-", 1)
    if not von:
        if not bis.isdigit():
            raise ValueError
        laenge = int(bis)
        if laenge <= 0:
            raise ValueError
        return max(groesse - laenge, 0), groesse - 1
    if not von.isdigit():
        raise ValueError
    start = int(von)
    if start >= groesse:
        raise ValueError
    if not bis:
        return start, groesse - 1
    if not bis.isdigit():
        raise ValueError
    ende = int(bis)
    if ende < start:
        raise ValueError
    return start, min(ende, groesse - 1)


def _bloecke(pfad: Path, start: int, laenge: int):
    with pfad.open("rb") as datei:
        datei.seek(start)
        rest = laenge
        while rest > 0:
            block = datei.read(min(BLOCKGROESSE, rest))
            if not block:
                break
            rest -= len(block)
            yield block


def _disposition(name: str, download: bool) -> str:
    sauber = name.replace('"', "").replace("\\", "").replace(";", "")
    sauber = "".join(zeichen for zeichen in sauber if zeichen >= " ")[:200]
    sauber = sauber or "dokument.pdf"
    ascii_name = (
        unicodedata.normalize("NFKD", sauber).encode("ascii", "ignore").decode() or "dokument.pdf"
    )
    art = "attachment" if download else "inline"
    return f"{art}; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(sauber)}"


class DokumentDatei(APIView):
    renderer_classes = [PdfRenderer, JSONRenderer]

    def get(self, request, band_id: int, song_id: int, version_id: int):
        song = song_fuer(request.user, band_id, song_id)
        try:
            version = DocumentVersion.objects.get(
                id=version_id, document__song=song
            )
        except DocumentVersion.DoesNotExist as fehler:
            raise Http404 from fehler
        try:
            pfad = dateipfad(version.file_key)
        except AblageFehler as fehler:
            raise Http404 from fehler
        if not pfad.is_file():
            raise Http404

        groesse = pfad.stat().st_size
        try:
            bereich = _bereich(request.headers.get("Range"), groesse)
        except ValueError:
            antwort = HttpResponse(status=416)
            antwort["Content-Range"] = f"bytes */{groesse}"
            antwort["Accept-Ranges"] = "bytes"
            return antwort

        download = request.query_params.get("download") in ("1", "true")
        if bereich is None:
            start, laenge, status_code = 0, groesse, 200
        else:
            start = bereich[0]
            laenge = bereich[1] - start + 1
            status_code = 206

        antwort = StreamingHttpResponse(
            _bloecke(pfad, start, laenge),
            status=status_code,
            content_type="application/pdf",
        )
        antwort["Content-Length"] = str(laenge)
        antwort["Content-Disposition"] = _disposition(version.original_name, download)
        antwort["X-Content-Type-Options"] = "nosniff"
        antwort["Cache-Control"] = "private, no-store"
        antwort["Accept-Ranges"] = "bytes"
        if status_code == 206:
            antwort["Content-Range"] = f"bytes {start}-{start + laenge - 1}/{groesse}"
        return antwort
