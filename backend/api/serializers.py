from rest_framework import serializers

from bands.models import Band
from library.models import Song
from setlists.models import NAME_VERGEBEN, Entry, Section, Setlist, name_frei


class SongSerializer(serializers.ModelSerializer):
    class Meta:
        model = Song
        fields = ["id", "title", "artist", "key", "bpm", "notes"]


class BandSerializer(serializers.ModelSerializer):
    songs = SongSerializer(many=True, read_only=True)

    class Meta:
        model = Band
        fields = ["id", "name", "songs"]


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
        fields = ["id", "name", "updated_at"]


class EintragSerializer(serializers.ModelSerializer):
    song = SongSerializer(read_only=True)

    class Meta:
        model = Entry
        fields = ["id", "position", "entry_type", "song", "label", "duration_seconds"]


class AbschnittSerializer(serializers.ModelSerializer):
    entries = EintragSerializer(many=True, read_only=True)

    class Meta:
        model = Section
        fields = ["id", "name", "kind", "position", "entries"]


class SetlistSerializer(SetlistNamePruefung, serializers.ModelSerializer):
    sections = AbschnittSerializer(many=True, read_only=True)

    class Meta:
        model = Setlist
        fields = ["id", "name", "sections"]


class EintragEingabeSerializer(serializers.Serializer):
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
    name = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    kind = serializers.ChoiceField(choices=Section.KIND_CHOICES)
    entries = EintragEingabeSerializer(many=True, required=False, default=list)

    def validate_entries(self, eintraege):
        if len(eintraege) > 200:
            raise serializers.ValidationError("Höchstens 200 Einträge je Abschnitt.")
        return eintraege


class InhaltEingabeSerializer(serializers.Serializer):
    sections = AbschnittEingabeSerializer(many=True)

    def validate_sections(self, abschnitte):
        if not abschnitte:
            raise serializers.ValidationError("Mindestens ein Abschnitt.")
        if len(abschnitte) > 50:
            raise serializers.ValidationError("Höchstens 50 Abschnitte.")
        return abschnitte
