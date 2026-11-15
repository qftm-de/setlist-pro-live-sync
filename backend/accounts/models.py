from django.contrib.auth.models import AbstractUser
from django.db import models


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
