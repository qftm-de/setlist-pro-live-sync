from django.db import IntegrityError, transaction
from django.http import Http404
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from collaboration.models import TextState
from collaboration.services import (
    EpocheVeraltet,
    update_anwenden,
    zustand_daten,
    zustand_initial,
)
from collaboration.text import TextFehler, dekodiere, kodiere
from realtime.services import band_ereignis
from setlists.commands import (
    BefehlUngueltig,
    NachbarFehlt,
    NutzdatenKonflikt,
    UnbekannterBefehl,
    fuehre_befehl_aus,
)
from setlists.content import (
    DoppelteId,
    EntfernteId,
    RevisionFehlt,
    RevisionKonflikt,
    UnbekannteId,
    ersetze_inhalt,
)
from setlists.models import NAME_VERGEBEN, Entry, Section, Setlist

from .annotations import revision_aus
from .bands import band_fuer
from .serializers import (
    BefehlEingabeSerializer,
    InhaltEingabeSerializer,
    SetlistKurzSerializer,
    SetlistSerializer,
    TextUpdateEingabeSerializer,
)


def setlist_fuer(user, band_id: int, setlist_id: int) -> Setlist:
    band = band_fuer(user, band_id)
    try:
        return Setlist.objects.prefetch_related("sections__entries__song").get(
            id=setlist_id, band=band
        )
    except Setlist.DoesNotExist as fehler:
        raise Http404 from fehler


class SetlistListe(generics.ListCreateAPIView):
    serializer_class = SetlistKurzSerializer

    def get_queryset(self):
        band = band_fuer(self.request.user, self.kwargs["band_id"])
        return Setlist.objects.filter(band=band).order_by("name", "id")

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "band": band_fuer(
            self.request.user, self.kwargs["band_id"]
        )}

    def perform_create(self, serializer):
        band = band_fuer(self.request.user, self.kwargs["band_id"])
        serializer.save(band=band)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                self.perform_create(serializer)
                band_ereignis(
                    serializer.instance.band,
                    "setlist.created",
                    id=serializer.instance.id,
                )
        except IntegrityError:
            # Zwei gleichzeitige Anfragen haben die Prüfung beide passiert.
            return Response(
                {"name": [NAME_VERGEBEN]}, status=status.HTTP_400_BAD_REQUEST
            )
        return Response(SetlistSerializer(serializer.instance).data, status=201)


class SetlistDetail(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SetlistSerializer
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def update(self, request, *args, **kwargs):
        # Ein PATCH braucht die Revision, auf der er beruht. Sonst überschreibt
        # ein veralteter Name den bestätigten Text der anderen Mitglieder.
        try:
            erwartet = revision_aus(request.data.get("revision"))
        except (TypeError, ValueError):
            return Response(
                {"revision": ["Erwartete Revision fehlt."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        instance = self.get_object()
        try:
            with transaction.atomic():
                gesperrt = (
                    Setlist.objects.select_for_update().filter(pk=instance.pk).first()
                )
                if gesperrt is None:
                    raise Http404
                if gesperrt.revision != erwartet:
                    return Response(
                        {"detail": "Die Setlist wurde inzwischen geändert."},
                        status=status.HTTP_409_CONFLICT,
                    )
                alter_name = gesperrt.name
                serializer = self.get_serializer(
                    gesperrt, data=request.data, partial=True
                )
                serializer.is_valid(raise_exception=True)
                setlist = serializer.save()
                if setlist.name != alter_name:
                    from collaboration.services import epoche_erhoehen

                    epoche_erhoehen(
                        TextState.TYP_SETLIST, setlist.uuid, "name", setlist.name
                    )
                    # Eine Namensänderung ist eine Inhaltsänderung.
                    setlist.revision += 1
                    setlist.save(update_fields=["revision", "updated_at"])
                band_ereignis(
                    setlist.band,
                    "setlist.updated",
                    id=setlist.id,
                )
        except IntegrityError:
            return Response(
                {"name": [NAME_VERGEBEN]}, status=status.HTTP_400_BAD_REQUEST
            )
        return Response(self.get_serializer(setlist).data)

    def get_object(self):
        return setlist_fuer(
            self.request.user, self.kwargs["band_id"], self.kwargs["setlist_id"]
        )

    def perform_destroy(self, instance):
        with transaction.atomic():
            band = instance.band
            kennung = instance.id
            from collaboration.services import merke_entfernt

            # Gelöschte UUIDs nie wiederverwenden: sonst hängt an einem neuen
            # Abschnitt derselben UUID der alte Textstand.
            merke_entfernt(TextState.TYP_SETLIST, instance.uuid)
            for abschnitt in instance.sections.all():
                merke_entfernt(TextState.TYP_SECTION, abschnitt.uuid)
                for eintrag in abschnitt.entries.all():
                    merke_entfernt(TextState.TYP_ENTRY, eintrag.uuid)
            instance.delete()
            band_ereignis(
                band,
                "setlist.deleted",
                id=kennung,
            )

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "band": band_fuer(
            self.request.user, self.kwargs["band_id"]
        )}


class SetlistInhalt(generics.GenericAPIView):
    """Inhalt als Ganzes ersetzen. Ein Aufruf, eine Transaktion."""

    def put(self, request, band_id: int, setlist_id: int):
        setlist = setlist_fuer(request.user, band_id, setlist_id)
        band = setlist.band
        eingabe = InhaltEingabeSerializer(data=request.data, context={"band": band})
        eingabe.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                frisch = ersetze_inhalt(
                    setlist,
                    eingabe.validated_data["sections"],
                    eingabe.validated_data["revision"],
                )
                band_ereignis(
                    frisch.band,
                    "setlist.content",
                    id=frisch.id,
                    revision=frisch.revision,
                )
        except RevisionFehlt:
            return Response(
                {"revision": ["Erwartete Revision fehlt."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except RevisionKonflikt:
            return Response(
                {"detail": "Die Setlist wurde inzwischen geändert."},
                status=status.HTTP_409_CONFLICT,
            )
        except (UnbekannteId, DoppelteId, EntfernteId) as fehler:
            return Response(
                {"sections": [str(fehler)]},
                status=status.HTTP_409_CONFLICT,
            )
        except Setlist.DoesNotExist as fehler:
            # Ein anderes Mitglied hat die Setlist im selben Moment gelöscht.
            raise Http404 from fehler
        except IntegrityError:
            # Ein Song wurde im selben Moment gelöscht.
            return Response(
                {"sections": ["Ein Song wurde inzwischen entfernt."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(SetlistSerializer(frisch).data, status=status.HTTP_200_OK)


class SetlistBefehle(APIView):
    """Idempotenter Einzelbefehl. Gleiche Kennung und Daten wiederholen sich."""

    def post(self, request, band_id: int, setlist_id: int):
        setlist = setlist_fuer(request.user, band_id, setlist_id)
        eingabe = BefehlEingabeSerializer(data=request.data)
        eingabe.is_valid(raise_exception=True)
        try:
            ergebnis = fuehre_befehl_aus(
                setlist=setlist,
                user=request.user,
                kind=eingabe.validated_data["kind"],
                payload=eingabe.validated_data["payload"],
                command_id=eingabe.validated_data["command_id"],
            )
        except NutzdatenKonflikt as fehler:
            return Response(
                {"detail": str(fehler)}, status=status.HTTP_409_CONFLICT
            )
        except NachbarFehlt as fehler:
            return Response(
                {"detail": str(fehler), "abgleich": True},
                status=status.HTTP_409_CONFLICT,
            )
        except (UnbekannterBefehl, BefehlUngueltig) as fehler:
            return Response(
                {"detail": str(fehler)}, status=status.HTTP_400_BAD_REQUEST
            )
        except Setlist.DoesNotExist as fehler:
            raise Http404 from fehler
        return Response(ergebnis, status=status.HTTP_200_OK)


def _textziel(setlist: Setlist, typ: str, kennung, feld: str):
    """Liefert (uuid, feld, initialtext) oder None."""
    if typ == TextState.TYP_SETLIST:
        if setlist.uuid != kennung or feld != "name":
            return None
        return setlist.uuid, "name", setlist.name
    if typ == TextState.TYP_SECTION:
        bereich = Section.objects.filter(setlist=setlist, uuid=kennung).first()
        if bereich is None or feld != "name":
            return None
        return bereich.uuid, "name", bereich.name
    if typ == TextState.TYP_ENTRY:
        eintrag = Entry.objects.filter(section__setlist=setlist, uuid=kennung).first()
        if eintrag is None or feld != "label":
            return None
        return eintrag.uuid, "label", eintrag.label
    return None


def _textzustand_karte(typ: str, feld: str, paare) -> list[TextState]:
    kennungen = [kennung for kennung, _ in paare]
    vorhanden = {
        zeile.object_uuid: zeile
        for zeile in TextState.objects.filter(
            object_type=typ, object_uuid__in=kennungen, field=feld
        )
    }
    return [
        vorhanden.get(kennung)
        or zustand_initial(typ, kennung, feld, text)
        for kennung, text in paare
    ]


class SetlistTexte(APIView):
    def get(self, request, band_id: int, setlist_id: int):
        setlist = setlist_fuer(request.user, band_id, setlist_id)
        bereiche = list(setlist.sections.all())
        zustaende = _textzustand_karte(
            TextState.TYP_SETLIST,
            "name",
            [(setlist.uuid, setlist.name)],
        )
        zustaende += _textzustand_karte(
            TextState.TYP_SECTION,
            "name",
            [(bereich.uuid, bereich.name) for bereich in bereiche],
        )
        zustaende += _textzustand_karte(
            TextState.TYP_ENTRY,
            "label",
            [
                (eintrag.uuid, eintrag.label)
                for bereich in bereiche
                for eintrag in bereich.entries.all()
            ],
        )
        return Response(
            {
                "revision": setlist.revision,
                "texts": [zustand_daten(eintrag) for eintrag in zustaende],
            }
        )


class SetlistTextUpdate(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "text"

    def post(self, request, band_id: int, setlist_id: int):
        setlist = setlist_fuer(request.user, band_id, setlist_id)
        eingabe = TextUpdateEingabeSerializer(data=request.data)
        eingabe.is_valid(raise_exception=True)
        daten = eingabe.validated_data
        ziel = _textziel(
            setlist, daten["object_type"], daten["object_uuid"], daten["field"]
        )
        if ziel is None:
            return Response(
                {"detail": "Textfeld gehört nicht zu dieser Setlist."},
                status=status.HTTP_409_CONFLICT,
            )
        kennung, feld, initial = ziel
        try:
            with transaction.atomic():
                # Sperrreihenfolge wie in ersetze_inhalt: Setlist-Zeile, dann
                # Strukturzeile, dann TextState. Andersherum entsteht mit dem
                # Gesamt-PUT ein Deadlock.
                gesperrt_setlist = (
                    Setlist.objects.select_for_update().filter(pk=setlist.pk).first()
                )
                if gesperrt_setlist is None:
                    return Response(
                        {"detail": "Die Setlist wurde inzwischen gelöscht."},
                        status=status.HTTP_409_CONFLICT,
                    )
                if daten["object_type"] == TextState.TYP_SETLIST:
                    gesperrt = gesperrt_setlist
                elif daten["object_type"] == TextState.TYP_SECTION:
                    gesperrt = (
                        Section.objects.select_for_update()
                        .filter(uuid=kennung)
                        .first()
                    )
                else:
                    gesperrt = (
                        Entry.objects.select_for_update().filter(uuid=kennung).first()
                    )
                if gesperrt is None:
                    return Response(
                        {"detail": "Das Feld wurde inzwischen gelöscht."},
                        status=status.HTTP_409_CONFLICT,
                    )
                obj, text = update_anwenden(
                    daten["object_type"],
                    kennung,
                    feld,
                    daten["epoch"],
                    dekodiere(daten["update"]),
                    initial,
                )
                spalte = "label" if daten["object_type"] == TextState.TYP_ENTRY else "name"
                setattr(gesperrt, spalte, text)
                gesperrt.save(update_fields=[spalte])
                # Textänderungen zählen als Inhaltsänderung. Ohne das bleibt
                # ein veralteter Gesamt-PUT revisionsgültig und überschreibt
                # den bestätigten Text über die Epoche.
                gesperrt_setlist.revision += 1
                gesperrt_setlist.save(update_fields=["revision", "updated_at"])
                setlist.revision = gesperrt_setlist.revision
                band_ereignis(
                    setlist.band,
                    "text.updated",
                    object_type=obj.object_type,
                    object_uuid=str(obj.object_uuid),
                    field=obj.field,
                    epoch=obj.epoch,
                    revision=obj.revision,
                    # Empfänger ziehen ihre Revision nach, sonst laufen sie
                    # beim nächsten Struktur-Save in ein 409.
                    setlist_id=setlist.id,
                    setlist_revision=setlist.revision,
                    # Vollzustand statt Delta: das Frontend vergleicht den
                    # bestätigten Stand mit der vollen Kodierung. Ein Delta
                    # erzeugt dort eine Rücksende-Schleife. Die Größe deckelt
                    # MAX_ZUSTAND_BYTES in collaboration/text.py.
                    update=kodiere(bytes(obj.state)),
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
        except IntegrityError:
            return Response(
                {"detail": "Der Name ist in dieser Band schon vergeben."},
                status=status.HTTP_409_CONFLICT,
            )
        except TextFehler as fehler:
            return Response(
                {"detail": str(fehler)}, status=status.HTTP_400_BAD_REQUEST
            )
        return Response(
            {
                "object_type": obj.object_type,
                "object_uuid": str(obj.object_uuid),
                "field": obj.field,
                "epoch": obj.epoch,
                "revision": obj.revision,
                "setlist_revision": setlist.revision,
                "text": text,
                "update": kodiere(bytes(obj.state)),
            }
        )
