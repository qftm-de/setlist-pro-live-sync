import uuid

from django.conf import settings
from django.db import models


class Document(models.Model):
    """Ein Dokument je Song mit einer aktiven, unveränderlichen Version."""

    song = models.OneToOneField(
        "library.Song",
        on_delete=models.PROTECT,
        related_name="document",
    )
    active_version = models.ForeignKey(
        "documents.DocumentVersion",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    revision = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return f"Dokument zu Song {self.song_id}"


class DocumentVersion(models.Model):
    """Unveränderliche Fassung einer privaten PDF-Datei."""

    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="versions",
    )
    number = models.PositiveIntegerField()
    upload_id = models.UUIDField(default=uuid.uuid4)
    file_key = models.CharField(max_length=80, unique=True)
    original_name = models.CharField(max_length=255)
    byte_size = models.PositiveBigIntegerField()
    page_count = models.PositiveIntegerField()
    sha256 = models.CharField(max_length=64)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["document_id", "number"]
        constraints = [
            models.UniqueConstraint(
                fields=["document", "number"],
                name="dokumentversion_nummer_eindeutig",
            ),
            models.UniqueConstraint(
                fields=["document", "upload_id"],
                name="dokumentversion_upload_eindeutig",
            ),
        ]

    def __str__(self) -> str:
        return f"Version {self.number} von Dokument {self.document_id}"
