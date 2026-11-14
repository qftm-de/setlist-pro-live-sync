from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Song(models.Model):
    band = models.ForeignKey("bands.Band", on_delete=models.CASCADE, related_name="songs")
    title = models.CharField("Titel", max_length=200)
    artist = models.CharField("Interpret", max_length=200, blank=True)
    key = models.CharField("Tonart", max_length=20, blank=True)
    bpm = models.PositiveSmallIntegerField(
        "BPM",
        null=True,
        blank=True,
        validators=[MinValueValidator(20), MaxValueValidator(400)],
    )
    notes = models.TextField("Notiz", blank=True)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return self.title
