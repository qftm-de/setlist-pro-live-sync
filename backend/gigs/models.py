from django.db import models


class Gig(models.Model):
    band = models.ForeignKey("bands.Band", on_delete=models.CASCADE, related_name="gigs")
    title = models.CharField("Titel", max_length=200)
    date = models.DateField("Datum")
    time = models.TimeField("Uhrzeit", null=True, blank=True)
    location = models.CharField("Ort", max_length=200, blank=True, default="")
    notes = models.TextField("Notiz", blank=True, default="")
    setlist = models.ForeignKey(
        "setlists.Setlist",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="gigs",
    )

    class Meta:
        ordering = ["date", "time", "id"]
        indexes = [models.Index(fields=["band", "date"], name="gig_band_datum_idx")]

    def __str__(self) -> str:
        return self.title
