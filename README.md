# Setlist Pro Live Sync

[![Lizenz: AGPL-3.0](https://img.shields.io/badge/Lizenz-AGPL--3.0-blue.svg)](LICENSE)
[![Status: Gerüst](https://img.shields.io/badge/Status-Ger%C3%BCst-yellow.svg)](#status)
[![Sprache: Deutsch](https://img.shields.io/badge/Sprache-Deutsch-informational.svg)](#)

Setlist Pro Live Sync ist eine Setlist-App für kleine Bands. Sie läuft auf dem
Handy oder Tablet am Notenständer. Der Betrieb ist online-first mit Lesereserve:
Geladene Ansichten bleiben lesbar, neue Änderungen brauchen den Server. Konten
liegen lokal in der Core-Instanz. Der Kern läuft selbst gehostet und autark, ein
Community-Hub ist optional und nie Voraussetzung.

## Warum

Papier ist starr, große Apps sind Abos und überladen, und auf der Bühne ist das
Netz schlecht. Wir bauen eine kleine, deutsche, bühnenfeste App für eine Band.
Ohne Abo, ohne Termin- und Finanzmodul. Änderungen werden erst nach
Serverbestätigung als gespeichert angezeigt.

## Status

**Vorabversion des Kerns.** Frontend, Backend, Compose und CI stehen. Umgesetzt
sind Laufzeitkonfiguration, gleiche Origin über nginx, lokale Anmeldung mit
Session, Bands, Songs und Setlists mit Abschnitten, Pausen und Zugaben. Konten
legt der Betreiber an, eine öffentliche Registrierung gibt es im Core nicht. Die nächsten Schritte stehen in
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
| `hub` | öffentlich mit E-Mail-Verifikation | an | zentrale Plattform, nicht Teil dieser Beta |

Der Kern hängt nie vom Hub ab. Keine Telemetrie, kein Sync ohne ausdrückliche
Aktion. Details stehen im [Hybrid-Modell](docs/planung/hybrid-modell.md).

Geplanter Stack: React, TypeScript, Vite, Django REST Framework, PostgreSQL,
Redis, Docker Compose.

## Lokal starten

1. `.env` im Repo-Root anlegen. Namen stehen in `backend/.env.example`.
   Pflicht sind ein stabiler `DJANGO_SECRET_KEY` und `POSTGRES_PASSWORD`.
2. `docker compose up --build` startet Web, API, Echtzeit-Relay, PostgreSQL und Redis.
3. Erstes Konto anlegen, solange die Instanz läuft:

   ```bash
   docker compose run --rm \
     -e DJANGO_SUPERUSER_USERNAME=admin \
     -e DJANGO_SUPERUSER_EMAIL=admin@example.test \
     -e DJANGO_SUPERUSER_PASSWORD='<Passwort>' \
     api python manage.py createsuperuser --noinput
   ```

4. Web: http://localhost:8080. Anmelden, Band anlegen, Songs eintragen.
   Health über den Proxy: http://localhost:8080/api/health/

Der Web-Port bindet nur an `127.0.0.1`. Davor gehört der TLS-Reverse-Proxy.
Dieser muss `X-Forwarded-Proto` selbst setzen und eingehende Werte
überschreiben. API, PostgreSQL und Redis bleiben im Compose-Netz.
`TRUST_PROXY_HEADERS` ist Pflicht: hinter dem TLS-Proxy `true`, bei lokalem
HTTP ohne TLS `false`. Für den Proxy zusätzlich `ALLOWED_HOSTS` auf den
Pilot-Host und `CSRF_TRUSTED_ORIGINS` auf die HTTPS-Origin setzen. Die
WebSocket-Verbindung nutzt dieselbe Origin-Prüfung; im Vite-Entwicklungsmodus
gehört `http://localhost:5173` in `CSRF_TRUSTED_ORIGINS`.
`APP_MODE=core` ist fest gesetzt; `hub` und fehlende Pflichtwerte verhindern
den Start. PDFs liegen privat im Volume `documents`; Grenzen und Bereinigung
stehen in [docs/betrieb.md](docs/betrieb.md).

## Review vor Push

Vor Push oder Merge Request: `node scripts/gate.mjs --voll`. Mit lokaler
Harness-Konfiguration startet das Gate den Review-Agenten, wenn
`.tmp/review/findings.md` nicht zum Stand passt. Ohne Harness legst du die
Befunddatei selbst an. Der Kopf braucht `HEAD` und `DIFF` aus
`node scripts/review-stand.mjs`. Offene Blocker oder Major stoppen den Push.

## Dokumentation

| Dokument | Inhalt |
|---|---|
| [docs/planung/hybrid-modell.md](docs/planung/hybrid-modell.md) | Architektur, Datenmodell, API, Phasen, Sicherheit |
| [docs/planung/versionen.md](docs/planung/versionen.md) | Fremdpakete, Basis-Images, Kompatibilität |
| [docs/betrieb.md](docs/betrieb.md) | PDF-Ablage, Uploadgrenzen, Sicherung und Bereinigung |
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

## Herkunft und Betrieb

Die Idee und die erste Fassung der App stammen von P. Beuster. Die Urapp liegt
nicht im Repo. Sie war die Vorlage für die Analyse unter [`docs/analyse/`](docs/analyse/00-ueberblick.md).
Der Neubau ist eine eigenständige Implementierung.

Powered by [QFTM.de](https://qftm.de).

## Lizenz

GNU Affero General Public License v3.0, siehe [LICENSE](LICENSE).
Copyright (C) 2026 QFTM.

Die AGPL verlangt, dass auch eine geänderte Fassung als Netzdienst ihren
Quelltext offenlegt. Wer die App selbst hostet, darf das tun, muss aber Lizenz
und Änderungen weitergeben.
