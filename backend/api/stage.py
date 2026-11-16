"""HTTP-Lebenszyklus der Bühnensitzung. Rechte und Verbindung je Anfrage."""

from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from stage.dienste import (
    BuehnenFehler,
    aktive_sitzung,
    beende,
    beitreten,
    kehre_zurueck,
    sitzung_daten,
    sitzung_fuer,
    starte_sitzung,
    uebergebe,
    uebernehme,
)

from .bands import band_fuer
from .stage_serializers import (
    StartEingabeSerializer,
    UebergabeEingabeSerializer,
    VerbindungEingabeSerializer,
)


def _fehler(fehler: BuehnenFehler) -> Response:
    return Response({"detail": fehler.detail}, status=fehler.status)


def _verbindung(request):
    session_key = getattr(request.session, "session_key", None)
    if session_key is None:
        raise BuehnenFehler(409, "Keine aktive Sitzung.")
    return session_key


class StageListe(APIView):
    def get(self, request, band_id: int):
        band = band_fuer(request.user, band_id)
        session = aktive_sitzung(band)
        if session is None:
            return Response({"session": None})
        verbindung = request.query_params.get("connection")
        return Response({"session": sitzung_daten(session, request.user, verbindung)})

    def post(self, request, band_id: int):
        band = band_fuer(request.user, band_id)
        eingabe = StartEingabeSerializer(data=request.data)
        eingabe.is_valid(raise_exception=True)
        try:
            session = starte_sitzung(
                band=band,
                user=request.user,
                setlist_id=eingabe.validated_data["setlist_id"],
                verbindung_id=eingabe.validated_data["connection_id"],
                session_key=_verbindung(request),
            )
        except BuehnenFehler as fehler:
            return _fehler(fehler)
        return Response(
            sitzung_daten(
                session, request.user, eingabe.validated_data["connection_id"]
            ),
            status=status.HTTP_201_CREATED,
        )


class StageDetail(APIView):
    def get(self, request, band_id: int, session_id: int):
        band = band_fuer(request.user, band_id)
        try:
            session = sitzung_fuer(band, session_id)
        except BuehnenFehler as fehler:
            return _fehler(fehler)
        verbindung = request.query_params.get("connection")
        return Response(sitzung_daten(session, request.user, verbindung))


class _Aktion(APIView):
    def _session(self, request, band_id: int, session_id: int):
        band = band_fuer(request.user, band_id)
        return sitzung_fuer(band, session_id)

    def _daten(self, request, session, connection_id):
        session.refresh_from_db()
        return Response(sitzung_daten(session, request.user, connection_id))


class StageJoin(_Aktion):
    def post(self, request, band_id: int, session_id: int):
        eingabe = VerbindungEingabeSerializer(data=request.data)
        eingabe.is_valid(raise_exception=True)
        try:
            session = self._session(request, band_id, session_id)
            beitreten(
                session,
                request.user,
                eingabe.validated_data["connection_id"],
                _verbindung(request),
            )
        except BuehnenFehler as fehler:
            return _fehler(fehler)
        return self._daten(request, session, eingabe.validated_data["connection_id"])


class StageHandover(_Aktion):
    def post(self, request, band_id: int, session_id: int):
        eingabe = UebergabeEingabeSerializer(data=request.data)
        eingabe.is_valid(raise_exception=True)
        try:
            session = self._session(request, band_id, session_id)
            uebergebe(
                session,
                request.user,
                eingabe.validated_data["connection_id"],
                _verbindung(request),
                eingabe.validated_data["target_user_id"],
            )
        except BuehnenFehler as fehler:
            return _fehler(fehler)
        return self._daten(request, session, eingabe.validated_data["connection_id"])


class StageTakeover(_Aktion):
    def post(self, request, band_id: int, session_id: int):
        eingabe = VerbindungEingabeSerializer(data=request.data)
        eingabe.is_valid(raise_exception=True)
        try:
            session = self._session(request, band_id, session_id)
            uebernehme(
                session,
                request.user,
                eingabe.validated_data["connection_id"],
                _verbindung(request),
            )
        except BuehnenFehler as fehler:
            return _fehler(fehler)
        return self._daten(request, session, eingabe.validated_data["connection_id"])


class StageResume(_Aktion):
    def post(self, request, band_id: int, session_id: int):
        eingabe = VerbindungEingabeSerializer(data=request.data)
        eingabe.is_valid(raise_exception=True)
        try:
            session = self._session(request, band_id, session_id)
            kehre_zurueck(
                session,
                request.user,
                eingabe.validated_data["connection_id"],
                _verbindung(request),
            )
        except BuehnenFehler as fehler:
            return _fehler(fehler)
        return self._daten(request, session, eingabe.validated_data["connection_id"])


class StageEnd(_Aktion):
    def post(self, request, band_id: int, session_id: int):
        eingabe = VerbindungEingabeSerializer(data=request.data)
        eingabe.is_valid(raise_exception=True)
        try:
            session = self._session(request, band_id, session_id)
            beende(
                session,
                request.user,
                eingabe.validated_data["connection_id"],
                _verbindung(request),
            )
        except BuehnenFehler as fehler:
            return _fehler(fehler)
        return self._daten(request, session, eingabe.validated_data["connection_id"])
