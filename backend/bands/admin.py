from django.contrib import admin
from django.db import transaction

from realtime.services import band_ereignis

from .models import Band, BandInvitation, Membership


@admin.register(Band)
class BandAdmin(admin.ModelAdmin):
    """Bands nur über die Anwendung anlegen, damit immer ein Owner existiert."""

    list_display = ("id", "name", "genre", "location", "created_at")
    search_fields = ("name", "genre", "location")
    readonly_fields = ("created_by", "created_at")

    def has_add_permission(self, request):
        return False

    def save_model(self, request, obj, form, change):
        with transaction.atomic():
            super().save_model(request, obj, form, change)
            if change and form.changed_data:
                band_ereignis(obj, "band.updated", name=obj.name)


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    """Mitgliedschaften nur lesen. Schreiben läuft über die Fachdienste.

    Der Standard-Admin würde am Modell vorbei schreiben und den Schutz des
    letzten Owners umgehen. Deshalb keine Anlage, Änderung oder Löschung.
    """

    list_display = ("id", "band", "user", "role")
    list_filter = ("role",)
    search_fields = ("band__name", "user__username")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(BandInvitation)
class BandInvitationAdmin(admin.ModelAdmin):
    """Einladungen im Admin nur lesen. Schreiben läuft über die Fachdienste.

    So bleiben 48-Stunden-Laufzeit, Token-Hash, endgültiger Widerruf und
    Echtzeit-Ereignisse geschützt.
    """

    list_display = (
        "id",
        "band",
        "created_by",
        "note",
        "expires_at",
        "uses_count",
        "max_uses",
        "revoked_at",
    )
    list_filter = ("revoked_at",)
    search_fields = ("band__name", "note")
    readonly_fields = ("token_hash", "created_at", "last_used_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
