from django.core.management.base import BaseCommand

from documents.models import DocumentVersion
from documents.storage import bereinige_reste


class Command(BaseCommand):
    help = "Entfernt alte, nicht referenzierte Uploadreste. Versionen bleiben erhalten."

    def handle(self, *args, **options):
        schluessel = set(DocumentVersion.objects.values_list("file_key", flat=True))
        entfernt = bereinige_reste(schluessel)
        self.stdout.write(self.style.SUCCESS(f"{entfernt} Dateirest(e) entfernt."))
