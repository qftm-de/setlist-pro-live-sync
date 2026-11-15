import time

from django.core.management.base import BaseCommand

from realtime.services import raeume_auf, verarbeite_offene

AUFRAEUM_INTERVALL = 3600


class Command(BaseCommand):
    help = "Veröffentlicht offene Echtzeit-Ereignisse wiederholt aus dem Ausgangspuffer."

    def add_arguments(self, parser):
        parser.add_argument("--einmal", action="store_true", help="Ein Lauf, dann Ende.")
        parser.add_argument("--intervall", type=float, default=0.05)
        parser.add_argument("--grenze", type=int, default=100)

    def handle(self, *args, **optionen):
        letzte_aufraeumung = 0.0
        while True:
            veroeffentlicht, offen = verarbeite_offene(optionen["grenze"])
            if veroeffentlicht or offen:
                self.stdout.write(f"relay: {veroeffentlicht}/{offen} veröffentlicht")
            jetzt = time.monotonic()
            if jetzt - letzte_aufraeumung >= AUFRAEUM_INTERVALL:
                raeume_auf()
                letzte_aufraeumung = jetzt
            if optionen["einmal"]:
                raeume_auf()
                return
            if veroeffentlicht == 0:
                time.sleep(optionen["intervall"])
