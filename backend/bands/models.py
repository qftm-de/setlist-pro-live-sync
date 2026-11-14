from django.conf import settings
from django.db import models


class Band(models.Model):
    name = models.CharField("Name", max_length=120)
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
