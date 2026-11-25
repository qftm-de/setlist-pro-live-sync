from datetime import datetime

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    """Lokales Konto des Core. Anmeldung per Benutzername, E-Mail eindeutig."""

    email = models.EmailField("E-Mail", unique=True)
    display_name = models.CharField("Anzeigename", max_length=120, blank=True)

    REQUIRED_FIELDS = ["email"]

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(email=""), name="konto_email_pflicht"
            )
        ]

    def __str__(self) -> str:
        return self.display_name or self.get_username()


class InstanzEinladung(models.Model):
    """Einladung, die nur ein Konto anlegt. Ohne Bandbezug.

    Gepflegt vom Betreiber per `manage.py instanz_einladung`. Gespeichert wird
    nur der Token-Hash; das Konto legt danach seine eigene Band an.
    """

    STATUS_AKTIV = "active"
    STATUS_ABGELAUFEN = "expired"
    STATUS_WIDERRUFEN = "revoked"
    STATUS_AUSGESCHOEPFT = "exhausted"

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="erstellte_instanz_einladungen",
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
        return f"Instanz-Einladung {self.pk} ({self.status()})"

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

