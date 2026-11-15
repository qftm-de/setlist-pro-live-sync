from django.conf import settings
from django.db import models
from django.db.models import Q


class Stream(models.Model):
    """Ein sichtbarer Ereignisstrom je Band oder je Band und Konto."""

    ART_BAND = "band"
    ART_PERSOENLICH = "personal"
    ART_CHOICES = [(ART_BAND, "Band"), (ART_PERSOENLICH, "Persönlich")]

    band = models.ForeignKey(
        "bands.Band", on_delete=models.CASCADE, related_name="ereignis_stroeme"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="+",
    )
    kind = models.CharField(max_length=16, choices=ART_CHOICES, default=ART_BAND)
    counter = models.PositiveBigIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["band"],
                condition=Q(kind="band"),
                name="bandstrom_einmal",
            ),
            models.UniqueConstraint(
                fields=["band", "user"],
                condition=Q(kind="personal"),
                name="persoenlicher_strom_einmal",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.kind} {self.band_id} {self.user_id or ''}"


class OutboxEvent(models.Model):
    """Bestätigtes Ereignis. Wird nur innerhalb der Fachtransaktion geschrieben."""

    stream = models.ForeignKey(
        Stream, on_delete=models.CASCADE, related_name="ereignisse"
    )
    seq = models.PositiveBigIntegerField()
    event_type = models.CharField(max_length=64)
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    published_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveIntegerField(default=0)
    last_error = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(
                fields=["stream", "seq"], name="ereignis_nummer_einmal"
            )
        ]
        indexes = [
            models.Index(fields=["published_at", "id"], name="ereignis_offen_idx")
        ]

    def __str__(self) -> str:
        return f"{self.event_type} #{self.seq}"
