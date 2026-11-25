"""Betreiber-Werkzeug für Instanz-Einladungen.

Ein Link, der nur ein Konto anlegt. Die Band entsteht danach im normalen
Ablauf. Ausgabe ist der einzige Ort, an dem der Token im Klartext erscheint.
"""

from __future__ import annotations

import os
from urllib.parse import urljoin

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from accounts.einladungen import (
    STANDARD_TAGE,
    EinladungUngueltigeEingabe,
    erstelle_instanz_einladung,
    widerrufe_instanz_einladung,
)
from accounts.models import InstanzEinladung


class Command(BaseCommand):
    help = "Erzeugt oder widerruft einen Einladungslink, der nur ein Konto anlegt."

    def add_arguments(self, parser):
        parser.add_argument("--ersteller", help="Benutzername des Betreibers.")
        parser.add_argument("--notiz", default="", help="Hinweis, höchstens 120 Zeichen.")
        parser.add_argument(
            "--max-nutzungen",
            type=int,
            default=None,
            help="1 bis 100, ohne Angabe unbegrenzt.",
        )
        parser.add_argument(
            "--tage", type=int, default=STANDARD_TAGE, help="Laufzeit, 1 bis 90."
        )
        parser.add_argument(
            "--basis",
            default=os.environ.get("INSTANZ_BASIS", ""),
            help="Öffentliche Adresse, z.B. https://setlistpro.qftm.de",
        )
        parser.add_argument(
            "--widerrufen", type=int, default=None, help="ID einer Einladung widerrufen."
        )

    def handle(self, *args, **optionen):
        if optionen["widerrufen"] is not None:
            return self._widerrufen(optionen["widerrufen"])
        return self._erstellen(optionen)

    def _widerrufen(self, einladung_id: int) -> None:
        try:
            einladung = InstanzEinladung.objects.get(pk=einladung_id)
        except InstanzEinladung.DoesNotExist as fehler:
            raise CommandError(f"Instanz-Einladung {einladung_id} fehlt.") from fehler
        widerrufe_instanz_einladung(einladung)
        self.stdout.write(f"Einladung {einladung_id} widerrufen.")

    def _erstellen(self, optionen) -> None:
        name = optionen["ersteller"]
        if not name:
            raise CommandError("--ersteller fehlt.")
        try:
            ersteller = get_user_model().objects.get(username=name)
        except get_user_model().DoesNotExist as fehler:
            raise CommandError(f"Konto {name} fehlt.") from fehler
        try:
            einladung, rohtoken = erstelle_instanz_einladung(
                ersteller,
                note=optionen["notiz"],
                max_uses=optionen["max_nutzungen"],
                tage=optionen["tage"],
            )
        except EinladungUngueltigeEingabe as fehler:
            raise CommandError(" ".join(fehler.felder.values())) from fehler

        pfad = f"/beitritt/{rohtoken}"
        basis = (optionen["basis"] or "").strip()
        link = urljoin(basis.rstrip("/") + "/", pfad.lstrip("/")) if basis else pfad
        self.stdout.write(link)
        self.stdout.write(
            f"ID {einladung.pk}, gültig bis {einladung.expires_at.isoformat()}"
        )
