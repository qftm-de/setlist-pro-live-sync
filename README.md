# Setlist Pro Live Sync

Band-App für Setlisten, Songs, Mitglieder und Auftritte. Deutsch, für kleine
Bands, ohne Abo und ohne Konto-Zwang. Der Kern läuft selbst gehostet und
autark, ein Community-Hub ist optional.

Stand: Planung. Es gibt noch keinen Produktcode und nichts zu installieren.

## Planung

| Dokument | Inhalt |
|---|---|
| `docs/planung/hybrid-modell.md` | Architektur, Betriebsmodi, Datenmodell, API, Phasen, Sicherheit |
| `docs/analyse/00-ueberblick.md` | Analyse der Alt-App, Einstieg |
| `docs/brand/01-brand.md` | Marke, Sprache, Farben, Namen |
| `PROGRESS.md` | aktueller Stand und nächster Schritt |
| `DECISIONS.md` | geltende Entscheidungen und warum |

Geplanter Stack: React, TypeScript, Vite, Django REST Framework, PostgreSQL,
Redis, Docker Compose. Zwei Modi: `core` selbst gehostet, `hub` zentral.

## Keine echten Daten

In Dateien, Docs und Tests gehören keine echten Bandcodes, Projekt-IDs,
API-Keys, Nutzernamen oder Server-Adressen. Das gilt für Beiträge genauso wie
für Commits.

## Lizenz

Noch offen. Zur Wahl stehen AGPL-3.0 und Apache-2.0. Die Entscheidung fällt vor
der ersten Veröffentlichung.
