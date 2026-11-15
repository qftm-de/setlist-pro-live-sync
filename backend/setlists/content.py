"""Inhalt einer Setlist als Ganzes ersetzen.

Ein Aufruf, eine Transaktion: Abschnitte und Einträge werden neu aufgebaut,
Positionen ergeben sich aus der Reihenfolge der Eingabe. So gibt es keinen
Zustand mit halb umsortierten Listen.
"""

from django.db import transaction

from .models import Entry, Section, Setlist


def ersetze_inhalt(setlist, abschnitte) -> None:
    with transaction.atomic():
        # Zeilensperre: zwei Mitglieder, die gleichzeitig speichern, laufen
        # nacheinander. Der zweite Schreiber sieht die Zeilen des ersten und
        # ersetzt sie, statt in den Unique-Constraint zu laufen.
        Setlist.objects.select_for_update().get(pk=setlist.pk)
        setlist.sections.all().delete()
        for abschnitts_index, abschnitt in enumerate(abschnitte, start=1):
            bereich = Section.objects.create(
                setlist=setlist,
                name=abschnitt.get("name", ""),
                kind=abschnitt["kind"],
                position=abschnitts_index,
            )
            Entry.objects.bulk_create(
                [
                    Entry(
                        section=bereich,
                        position=eintrags_index,
                        entry_type=eintrag["entry_type"],
                        song=eintrag.get("song"),
                        label=eintrag.get("label", ""),
                        duration_seconds=eintrag.get("duration_seconds"),
                    )
                    for eintrags_index, eintrag in enumerate(
                        abschnitt.get("entries", []), start=1
                    )
                ]
            )
        setlist.save(update_fields=["updated_at"])
