from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class KontoAdmin(UserAdmin):
    """Konten im Admin sperren (is_active=False), nicht hart löschen.

    Kaskadierendes Löschen von Membership.user würde den Schutz des letzten
    Band-Owners umgehen.
    """

    list_display = ("id", "username", "email", "display_name", "is_active")
    search_fields = ("username", "email", "display_name")
    fieldsets = UserAdmin.fieldsets + (("Core", {"fields": ("display_name",)}),)
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("Core", {"fields": ("email", "display_name")}),
    )

    def has_delete_permission(self, request, obj=None):
        return False
