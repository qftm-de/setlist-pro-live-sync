from datetime import datetime

from django.conf import settings
from django.db import models
from django.utils import timezone


class Band(models.Model):
    name = models.CharField("Name", max_length=120)
    genre = models.CharField("Genre", max_length=120, blank=True, default="")
    location = models.CharField("Ort / Proberaum", max_length=200, blank=True, default="")
    description = models.TextField("Beschreibung", blank=True, default="")
    internal_notes = models.TextField("Interne Band-Notiz", blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="gegruendete_bands",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name", "id"]

    def __str__(self) -> str:
        return self.name


class Membership(models.Model):
    ROLE_OWNER = "owner"
    ROLE_MEMBER = "member"
    ROLE_CHOICES = [(ROLE_OWNER, "Owner"), (ROLE_MEMBER, "Mitglied")]

    band = models.ForeignKey(Band, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    role = models.CharField(max_length=16, choices=ROLE_CHOICES, default=ROLE_MEMBER)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["band", "user"], name="mitgliedschaft_eindeutig")
        ]

    def __str__(self) -> str:
        return f"{self.user} in {self.band} ({self.role})"


class BandInvitation(models.Model):
    """Zeitlich begrenzter Beitrittslink. Gespeichert wird nur der Token-Hash."""

    STATUS_AKTIV = "active"
    STATUS_ABGELAUFEN = "expired"
    STATUS_WIDERRUFEN = "revoked"
    STATUS_AUSGESCHOEPFT = "exhausted"

    band = models.ForeignKey(Band, on_delete=models.CASCADE, related_name="invitations")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="erstellte_einladungen",
    )
    token_hash = models.CharField(max_length=64, unique=True)
    note = models.CharField("Hinweis", max_length=120, blank=True, default="")
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    uses_count = models.PositiveIntegerField(default=0)
    max_uses = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self) -> str:
        return f"Einladung {self.band_id} ({self.status()})"

    def status(self, jetzt: datetime | None = None) -> str:
        jetzt = jetzt or timezone.now()
        if self.revoked_at is not None:
            return self.STATUS_WIDERRUFEN
        if self.expires_at <= jetzt:
            return self.STATUS_ABGELAUFEN
        if self.max_uses is not None and self.uses_count >= self.max_uses:
            return self.STATUS_AUSGESCHOEPFT
        return self.STATUS_AKTIV

    def ist_aktiv(self, jetzt: datetime | None = None) -> bool:
        return self.status(jetzt) == self.STATUS_AKTIV
