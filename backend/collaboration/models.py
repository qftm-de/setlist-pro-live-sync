import uuid

from django.db import models


class TextState(models.Model):
    """Zusammengeführter Textzustand eines Feldes, mit Epoche und Revision."""

    TYP_SETLIST = "setlist"
    TYP_SECTION = "section"
    TYP_ENTRY = "entry"
    TYP_ANNOTATION = "annotation"
    TYP_CHOICES = [
        (TYP_SETLIST, "Setlist"),
        (TYP_SECTION, "Abschnitt"),
        (TYP_ENTRY, "Eintrag"),
        (TYP_ANNOTATION, "Anmerkung"),
    ]

    FELD_NAME = "name"
    FELD_LABEL = "label"
    FELD_TEXT = "text"
    FELD_CHOICES = [
        (FELD_NAME, "Name"),
        (FELD_LABEL, "Bezeichnung"),
        (FELD_TEXT, "Text"),
    ]

    object_type = models.CharField(max_length=16, choices=TYP_CHOICES)
    object_uuid = models.UUIDField()
    field = models.CharField(max_length=16, choices=FELD_CHOICES)
    epoch = models.PositiveIntegerField(default=0)
    revision = models.PositiveBigIntegerField(default=0)
    state = models.BinaryField(default=b"")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["object_type", "object_uuid", "field"],
                name="textzustand_feld_einmal",
            )
        ]

    def __str__(self) -> str:
        return f"{self.object_type}/{self.object_uuid}/{self.field}"


class RemovedId(models.Model):
    """Löschmarke. Eine entfernte UUID wird nie wieder vergeben."""

    object_type = models.CharField(max_length=16, choices=TextState.TYP_CHOICES)
    object_uuid = models.UUIDField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["object_type", "object_uuid"],
                name="loeschmarke_einmal",
            )
        ]

    def __str__(self) -> str:
        return f"{self.object_type}/{self.object_uuid}"
