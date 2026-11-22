from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from bands.dienste import KontoInaktivFehler, betreiber_owner_setzen
from bands.models import Band


class Command(BaseCommand):
    help = "Setzt ein aktives Konto als Band-Owner (Betreiber-Wiederherstellung)."

    def add_arguments(self, parser):
        parser.add_argument("band_id", type=int, help="ID der Band")
        parser.add_argument("username", type=str, help="Benutzername des neuen Owners")

    def handle(self, *args, **options):
        band_id = options["band_id"]
        try:
            band = Band.objects.get(pk=band_id)
        except Band.DoesNotExist as fehler:
            raise CommandError(f"Band {band_id} nicht gefunden.") from fehler
        user_model = get_user_model()
        username = user_model.normalize_username(options["username"].strip())
        try:
            konto = user_model.objects.get(username=username)
        except user_model.DoesNotExist as fehler:
            raise CommandError(f"Konto {username!r} nicht gefunden.") from fehler
        try:
            betreiber_owner_setzen(band, konto)
        except KontoInaktivFehler as fehler:
            raise CommandError(
                f"Konto {username!r} ist gesperrt und kann kein aktiver Owner werden."
            ) from fehler
        self.stdout.write(
            self.style.SUCCESS(
                f"Konto {konto.username} ist jetzt Owner von Band {band.id} ({band.name})."
            )
        )
