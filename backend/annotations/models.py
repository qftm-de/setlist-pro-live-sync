import uuid

from django.conf import settings
from django.db import models


class Annotation(models.Model):
    ART_TEXT = "text"
    ART_MARKER = "marker"
    ART_CHOICES = [(ART_TEXT, "Text"), (ART_MARKER, "Marker")]

    SICHTBAR_PRIVAT = "private"
    SICHTBAR_BAND = "band"
    SICHTBAR_CHOICES = [
        (SICHTBAR_PRIVAT, "Persönlich"),
        (SICHTBAR_BAND, "Band"),
    ]

    FARBEN = [
        ("gelb", "Gelb"),
        ("orange", "Orange"),
        ("blau", "Blau"),
        ("gruen", "Grün"),
    ]

    SCHRIFTGROESSEN = (0.015, 0.0225, 0.03)

    document_version = models.ForeignKey(
        "documents.DocumentVersion",
        on_delete=models.PROTECT,
        related_name="annotations",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="+",
    )
    uuid = models.UUIDField(default=uuid.uuid4, unique=True)
    page_number = models.PositiveIntegerField()
    kind = models.CharField(max_length=16, choices=ART_CHOICES)
    visibility = models.CharField(
        max_length=16, choices=SICHTBAR_CHOICES, default=SICHTBAR_PRIVAT
    )
    geometry = models.JSONField()
    color = models.CharField(max_length=16, choices=FARBEN, default="gelb")
    text = models.TextField(blank=True, default="")
    font_size = models.FloatField(null=True, blank=True)
    revision = models.PositiveIntegerField(default=0)
    permission_generation = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return f"{self.kind} auf Seite {self.page_number}"
