# Setlist Pro Live Sync

[![Lizenz: AGPL-3.0](https://img.shields.io/badge/Lizenz-AGPL--3.0-blue.svg)](LICENSE)
[![Status: Planung](https://img.shields.io/badge/Status-Planung-orange.svg)](#status)
[![Sprache: Deutsch](https://img.shields.io/badge/Sprache-Deutsch-informational.svg)](#)

Setlist Pro Live Sync ist eine Setlist-App für kleine Bands. Sie läuft auf dem
Handy oder Tablet auf dem Notenständer, funktioniert ohne Netz und ohne
Konto-Zwang. Der Kern läuft selbst gehostet und autark, ein Community-Hub ist
optional und nie Voraussetzung.

## Warum

Papier ist starr, große Apps sind Abos und überladen, und auf der Bühne ist das
Netz schlecht. Wir bauen eine kleine, deutsche, bühnenfeste App für eine Band.
Ohne Abo, ohne Konto-Zwang, ohne Termin- und Finanzmodul.

## Status

**Planung.** Es gibt noch keinen Produktcode. Die nächsten Schritte stehen in
[`PROGRESS.md`](PROGRESS.md), die geltenden Entscheidungen in
[`DECISIONS.md`](DECISIONS.md).

| Phase | Inhalt | Stand |
|---|---|---|
| 1 | Autarker Kern: Konten, Bands, Songs, Setlists, PDFs, Annotationen, Echtzeit, Bühne | geplant |
| 2 | Hub: Registrierung, Profile, Pinnwand, Kontaktanfragen, Moderation | geplant |
| 3 | Optionale Integration zwischen Kern und Hub | geplant |
| 4 | Öffentliche Veröffentlichung, Releases, Dokumentation für Betreiber | geplant |

## Architektur

Ein Repository, eine Codebasis, zwei Betriebsmodi:

| Modus | Registrierung | Community | Einsatz |
|---|---|---|---|
| `core` | geschlossen, Admin und Einladungen | aus | Band auf eigenem Server |
| `core` mit `COMMUNITY_URL` | geschlossen | nur Link | Band, die die Pinnwand sehen will |
| `hub` | öffentlich mit E-Mail-Verifikation | an | zentrale Plattform |

Der Kern hängt nie vom Hub ab. Keine Telemetrie, kein Sync ohne ausdrückliche
Aktion. Details stehen im [Hybrid-Modell](docs/planung/hybrid-modell.md).

Geplanter Stack: React, TypeScript, Vite, Django REST Framework, PostgreSQL,
Redis, Docker Compose.

## Dokumentation

| Dokument | Inhalt |
|---|---|
| [docs/planung/hybrid-modell.md](docs/planung/hybrid-modell.md) | Architektur, Datenmodell, API, Phasen, Sicherheit |
| [docs/analyse/00-ueberblick.md](docs/analyse/00-ueberblick.md) | Analyse der Alt-App |
| [docs/brand/01-brand.md](docs/brand/01-brand.md) | Marke, Sprache, Farben, Namen |
| [PROGRESS.md](PROGRESS.md) | aktueller Stand und nächster Schritt |
| [DECISIONS.md](DECISIONS.md) | Entscheidungen und Begründung |
| [CHANGELOG.md](CHANGELOG.md) | Änderungen |

## Mitmachen

Beiträge sind willkommen. Lies vorher [CONTRIBUTING.md](CONTRIBUTING.md) und
den [Verhaltenskodex](CODE_OF_CONDUCT.md). Fehler und Wünsche gehören in die
Issue-Vorlagen, nicht in eine private Nachricht.

Wichtig: In Issues, Pull Requests, Tests und Beispieldaten gehören keine echten
Bandcodes, Projekt-IDs, API-Keys, Nutzernamen oder Server-Adressen.

## Sicherheit

Sicherheitslücken bitte nicht als öffentliches Issue melden. Der Weg steht in
[SECURITY.md](SECURITY.md).

## Lizenz

GNU Affero General Public License v3.0, siehe [LICENSE](LICENSE).
Copyright (C) 2026 QFTM.

Die AGPL verlangt, dass auch eine geänderte Fassung als Netzdienst ihren
Quelltext offenlegt. Wer die App selbst hostet, darf das tun, muss aber Lizenz
und Änderungen weitergeben.
