from django.conf import settings
from django.db import models


NAME_VERGEBEN = "Eine Setlist mit diesem Namen gibt es schon."


def name_frei(band, name: str, ausser_id: int | None = None) -> bool:
    """True, wenn der Name in der Band noch nicht vergeben ist."""
    eigene = Setlist.objects.filter(band=band, name=name)
    if ausser_id is not None:
        eigene = eigene.exclude(id=ausser_id)
    return not eigene.exists()


class Setlist(models.Model):
    band = models.ForeignKey("bands.Band", on_delete=models.CASCADE, related_name="setlists")
    name = models.CharField("Name", max_length=120)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "id"]
        constraints = [
            models.UniqueConstraint(fields=["band", "name"], name="setlist_name_eindeutig")
        ]

    def __str__(self) -> str:
        return self.name


class Section(models.Model):
    KIND_SET = "set"
    KIND_PAUSE = "pause"
    KIND_ZUGABE = "zugabe"
    KIND_CHOICES = [
        (KIND_SET, "Set"),
        (KIND_PAUSE, "Pause"),
        (KIND_ZUGABE, "Zugabe"),
    ]

    setlist = models.ForeignKey(Setlist, on_delete=models.CASCADE, related_name="sections")
    name = models.CharField("Name", max_length=120, blank=True)
    kind = models.CharField(max_length=16, choices=KIND_CHOICES, default=KIND_SET)
    position = models.PositiveIntegerField()

    class Meta:
        ordering = ["position", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["setlist", "position"], name="abschnitt_position_eindeutig"
            )
        ]

    def __str__(self) -> str:
        return self.name or self.get_kind_display()


class Entry(models.Model):
    TYP_SONG = "song"
    TYP_PAUSE = "pause"
    TYP_NOTIZ = "notiz"
    TYP_CHOICES = [
        (TYP_SONG, "Song"),
        (TYP_PAUSE, "Pause"),
        (TYP_NOTIZ, "Notiz"),
    ]

    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name="entries")
    position = models.PositiveIntegerField()
    entry_type = models.CharField(max_length=16, choices=TYP_CHOICES, default=TYP_SONG)
    song = models.ForeignKey(
        "library.Song",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="setlist_eintraege",
    )
    label = models.CharField("Bezeichnung", max_length=200, blank=True)
    duration_seconds = models.PositiveIntegerField(
        "Dauer in Sekunden", null=True, blank=True
    )

    class Meta:
        ordering = ["position", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["section", "position"], name="eintrag_position_eindeutig"
            )
        ]

    def __str__(self) -> str:
        return self.label or (self.song.title if self.song else self.get_entry_type_display())
