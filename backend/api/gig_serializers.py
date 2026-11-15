from rest_framework import serializers

from gigs.models import Gig
from setlists.models import Setlist

SETLIST_REFERENZ = "Die Setlist gehört nicht zu dieser Band."


def setlist_gehoert_zu_band(band, setlist_id: int) -> bool:
    """Eine Prüfung für unbekannte und bandfremde IDs, damit beide gleich antworten."""
    return Setlist.objects.filter(id=setlist_id, band=band).exists()


class GigSerializer(serializers.ModelSerializer):
    setlist_id = serializers.IntegerField(required=False, allow_null=True)
    setlist_name = serializers.SerializerMethodField()
    notes = serializers.CharField(
        max_length=10000,
        required=False,
        allow_blank=True,
        trim_whitespace=False,
    )

    class Meta:
        model = Gig
        fields = [
            "id",
            "title",
            "date",
            "time",
            "location",
            "notes",
            "setlist_id",
            "setlist_name",
        ]

    def validate_title(self, wert):
        sauber = wert.strip()
        if not sauber:
            raise serializers.ValidationError("Titel ist Pflicht.")
        return sauber

    def validate_setlist_id(self, wert):
        if wert is None:
            return None
        band = self.context.get("band")
        if band is None or not setlist_gehoert_zu_band(band, wert):
            raise serializers.ValidationError(SETLIST_REFERENZ)
        return wert

    def get_setlist_name(self, gig):
        if not gig.setlist_id:
            return None
        try:
            return gig.setlist.name
        except Setlist.DoesNotExist:
            # Zwischen Commit und Antwort gelöscht. Der nächste Abruf zeigt null.
            return None
