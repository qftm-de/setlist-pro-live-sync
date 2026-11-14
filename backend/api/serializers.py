from rest_framework import serializers

from bands.models import Band
from library.models import Song


class SongSerializer(serializers.ModelSerializer):
    class Meta:
        model = Song
        fields = ["id", "title", "artist", "key", "bpm", "notes"]


class BandSerializer(serializers.ModelSerializer):
    songs = SongSerializer(many=True, read_only=True)

    class Meta:
        model = Band
        fields = ["id", "name", "songs"]
