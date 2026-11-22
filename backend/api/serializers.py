import json
from collections.abc import Mapping

from rest_framework import serializers

from bands.models import Band, Membership
from library.models import Song
from setlists.content import MAX_ABSCHNITTE, MAX_EINTRAEGE
from setlists.models import NAME_VERGEBEN, Entry, Section, Setlist, name_frei


class SongSerializer(serializers.ModelSerializer):
    class Meta:
        model = Song
        fields = ["id", "title", "artist", "key", "bpm", "notes"]


class BandSerializer(serializers.ModelSerializer):
    songs = SongSerializer(many=True, read_only=True)
    role = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()

    class Meta:
        model = Band
        fields = [
            "id",
            "name",
            "genre",
            "location",
            "description",
            "internal_notes",
            "role",
            "can_manage",
            "songs",
        ]

    def validate_name(self, name):
        sauber = (name or "").strip()
        if not sauber:
            raise serializers.ValidationError("Bitte einen Bandnamen eintragen.")
        if len(sauber) > 120:
            raise serializers.ValidationError("Höchstens 120 Zeichen.")
        return sauber

    def _begrenzt(self, wert, grenze):
        if len(wert or "") > grenze:
            raise serializers.ValidationError(f"Höchstens {grenze} Zeichen.")
        return wert

    def validate_genre(self, wert):
        return self._begrenzt(wert, 120)

    def validate_location(self, wert):
        return self._begrenzt(wert, 200)

    def validate_description(self, wert):
        return self._begrenzt(wert, 2_000)

    def validate_internal_notes(self, wert):
        return self._begrenzt(wert, 10_000)

    def _mitgliedschaft(self, band):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return None
        zwischengespeichert = getattr(self, "_mitgliedschaften", None)
        if zwischengespeichert is None:
            zwischengespeichert = {}
            self._mitgliedschaften = zwischengespeichert
        if band.id not in zwischengespeichert:
            zwischengespeichert[band.id] = Membership.objects.filter(
                band=band, user=user
            ).first()
        return zwischengespeichert[band.id]

    def get_role(self, band):
        mitgliedschaft = self._mitgliedschaft(band)
        return mitgliedschaft.role if mitgliedschaft is not None else None

    def get_can_manage(self, band):
        mitgliedschaft = self._mitgliedschaft(band)
        return bool(
            mitgliedschaft is not None
            and mitgliedschaft.role == Membership.ROLE_OWNER
        )


class SetlistNamePruefung:
    """Gleiche Regel für Anlegen und Umbenennen."""

    def validate_name(self, name):
        band = self.context.get("band")
        ausser_id = self.instance.id if self.instance is not None else None
        if band is not None and not name_frei(band, name, ausser_id):
            raise serializers.ValidationError(NAME_VERGEBEN)
        return name


class SetlistKurzSerializer(SetlistNamePruefung, serializers.ModelSerializer):
    class Meta:
        model = Setlist
        fields = ["id", "uuid", "name", "revision", "updated_at"]


class EintragSerializer(serializers.ModelSerializer):
    song = SongSerializer(read_only=True)

    class Meta:
        model = Entry
        fields = [
            "id",
            "uuid",
            "position",
            "entry_type",
            "song",
            "label",
            "duration_seconds",
        ]


class AbschnittSerializer(serializers.ModelSerializer):
    entries = EintragSerializer(many=True, read_only=True)

    class Meta:
        model = Section
        fields = ["id", "uuid", "name", "kind", "position", "entries"]


class SetlistSerializer(SetlistNamePruefung, serializers.ModelSerializer):
    sections = AbschnittSerializer(many=True, read_only=True)

    class Meta:
        model = Setlist
        fields = ["id", "uuid", "name", "revision", "sections"]
        read_only_fields = ["id", "uuid", "revision"]


class EintragEingabeSerializer(serializers.Serializer):
    uuid = serializers.UUIDField(required=False, allow_null=True)
    entry_type = serializers.ChoiceField(choices=Entry.TYP_CHOICES)
    song_id = serializers.IntegerField(required=False, allow_null=True)
    label = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    duration_seconds = serializers.IntegerField(
        required=False, allow_null=True, min_value=1, max_value=86400
    )

    def validate(self, daten):
        band = self.context["band"]
        typ = daten["entry_type"]
        song_id = daten.get("song_id")
        if typ == Entry.TYP_SONG:
            if not song_id:
                raise serializers.ValidationError({"song_id": "Song ist Pflicht."})
            try:
                daten["song"] = Song.objects.get(id=song_id, band=band)
            except Song.DoesNotExist as fehler:
                raise serializers.ValidationError(
                    {"song_id": "Song gehört nicht zu dieser Band."}
                ) from fehler
        else:
            if song_id:
                raise serializers.ValidationError(
                    {"song_id": "Nur Song-Einträge haben einen Song."}
                )
            daten["song"] = None
            bezeichnung = (daten.get("label") or "").strip()
            if typ == Entry.TYP_PAUSE and not bezeichnung:
                daten["label"] = "Pause"
            elif typ == Entry.TYP_NOTIZ and not bezeichnung:
                raise serializers.ValidationError(
                    {"label": "Eine Notiz braucht eine Bezeichnung."}
                )
        return daten


class AbschnittEingabeSerializer(serializers.Serializer):
    uuid = serializers.UUIDField(required=False, allow_null=True)
    name = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    kind = serializers.ChoiceField(choices=Section.KIND_CHOICES)
    entries = EintragEingabeSerializer(many=True, required=False, default=list)

    def validate_entries(self, eintraege):
        if len(eintraege) > MAX_EINTRAEGE:
            raise serializers.ValidationError("Höchstens 200 Einträge je Abschnitt.")
        return eintraege


class InhaltEingabeSerializer(serializers.Serializer):
    revision = serializers.IntegerField(min_value=0)
    sections = AbschnittEingabeSerializer(many=True)

    def validate_sections(self, abschnitte):
        if not abschnitte:
            raise serializers.ValidationError("Mindestens ein Abschnitt.")
        if len(abschnitte) > MAX_ABSCHNITTE:
            raise serializers.ValidationError("Höchstens 50 Abschnitte.")
        return abschnitte


class BefehlEingabeSerializer(serializers.Serializer):
    command_id = serializers.UUIDField()
    kind = serializers.CharField(max_length=32)
    payload = serializers.DictField()

    def to_internal_value(self, data):
        if not isinstance(data, Mapping):
            raise serializers.ValidationError({"detail": "JSON-Objekt erwartet."})
        return super().to_internal_value(data)

    def validate_payload(self, payload):
        # Gleiche Grenze wie im WebSocket-Pfad.
        if len(json.dumps(payload, default=str)) > 16 * 1024:
            raise serializers.ValidationError("Nutzdaten sind zu groß.")
        return payload


class TextUpdateEingabeSerializer(serializers.Serializer):
    object_type = serializers.ChoiceField(
        choices=["setlist", "section", "entry"],
    )
    object_uuid = serializers.UUIDField()
    field = serializers.ChoiceField(choices=["name", "label", "text"])
    epoch = serializers.IntegerField(min_value=0)
    update = serializers.CharField(max_length=90_000)
