# Pilot-Abnahme

Diese Liste füllt der Betreiber auf echter Hardware aus. Der Agent prüft
Desktop und Mobil-Emulation, nicht das echte Tablet.

## Automatisch geprüft

- `node scripts/verify-kern.mjs` prüft Anmeldung, Songs, Setlists, PDFs,
  Anmerkungen, Export und Bühne über nginx.
- `frontend/e2e/mobil.spec.ts` läuft im Playwright-Profil `mobil`
  (Pixel-7-Emulation) und prüft Auftritte, PDF-Ansicht und Bühne auf Überlauf
  und Bedienbarkeit.

## Tablet

Datum, Gerät, Browser und Ergebnis je Zeile eintragen.

| Prüfung | Erwartung | Datum | Gerät | Browser | Ergebnis |
|---|---|---|---|---|---|
| Wake Lock an | Bildschirm bleibt während der Bühnenansicht an | | | | |
| Wake Lock aus | Bildschirm darf dunkel werden, Bedienung bleibt möglich | | | | |
| Vollbild an | Bühne füllt den Bildschirm, Zurückgehen funktioniert | | | | |
| Vollbild aus | Ansicht bleibt bedienbar, kein hängender Zustand | | | | |
| Lesereserve über 128 MiB | Mehrere PDFs werden vorbereitet oder die Grenze wird sichtbar gemeldet | | | | |
| Sehr kleines Display | Kopf, Setlist-Übersicht und Fuß bleiben erreichbar | | | | |
| Wiederverbindung | Stand kommt zurück, lokales Blättern bleibt erhalten | | | | |
| Anmerkungen | Bandweite Anmerkungen erscheinen, persönliche nur beim Autor | | | | |

## Desktop und Mobilgerät

| Prüfung | Erwartung | Datum | Gerät | Browser | Ergebnis |
|---|---|---|---|---|---|
| Auftritt anlegen und ändern | Speichern ohne Reload, Fehler sichtbar | | | | |
| PDF öffnen und blättern | Rendern, Zoom, Drehen, Seite wechseln | | | | |
| Bühne starten | Sitzung öffnet aus Setlist oder Auftritt | | | | |
| Bühne folgen | Song und Seite wechseln mit | | | | |
| Bühne beenden | Teilnehmer sehen das Ende | | | | |
| Bandexport | ZIP lädt, Manifest und PDFs enthalten | | | | |

## Offene Reste

- Echte Tablet-Prüfung ausstehend.
- Sichtprüfung der Gestaltung auf Desktop und Mobil ausstehend.
