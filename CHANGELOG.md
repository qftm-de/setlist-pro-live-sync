# Changelog

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

### Added

- Projektstruktur, Planung und Dokumentation für den Neubau.
- Analyse der Alt-App als Referenz.
- Markenentwurf mit Sprache, Farben und Namen.
- Gerüst: Frontend (Vite, React, TypeScript, Vitest), Backend
  (Django, Django REST Framework, Health-Endpoint), Docker Compose
  im Modus core (web, api, PostgreSQL, Redis) und CI-Workflow.
- Versionsübersicht der Fremdpakete und Basis-Images mit
  Kompatibilitätshinweisen in `docs/planung/versionen.md`.
- Qualitätssicherung nachgebaut: Gate-Skripte sind versioniert. Ein
  frischer Clone führt das Gate nach `npm ci` im Root aus. Harness und
  Agentenkonfiguration bleiben lokal.
- CI: neuer Job `gate` mit Requirements-Gate, Security-Baseline
  (`review-constraints`) und Gitleaks vor den Test-Jobs.
- R1-Verify prüft die Repo-Grundausstattung real
  (`scripts/check-repo.mjs`: Pflichtdateien, Gate-Fähigkeit,
  Brownfield-Schutz) statt nur die Gate-Schrittliste.
- Gitleaks als etablierter Secret-Scanner im Voll-Gate aktiviert.
- Struktur-Regel mit Datei-Größen-Grenzen: Code 300 Ziel/500 hart,
  Doku 500 Ziel/1000 hart. `scripts/lint-file-size.mjs` läuft im
  Gate (schnell und voll) und in der CI. Generierte Dateien sind
  exempt.
- Core-Laufzeit (R3): `APP_MODE=core` ist Pflicht, Secret-Key und
  PostgreSQL sind Pflicht. `/api/config/` liefert nur Modus,
  Instanzname und validierten Community-Link zur Laufzeit. Health
  prüft die Datenbank.
- Frontend und Proxy (R4): nginx liefert SPA-Fallback und proxyt API,
  Admin und statische Dateien unter einer Origin. React-Hülle mit
  Navigation, Bandwechsel, API-Fehlerklassen, sichtbarem Speicherzustand
  am Songformular und Rückführung zur Anmeldung bei abgelaufener Session.
- Paketprüfungen: `scripts/verify-foundation.mjs`,
  `scripts/verify-ui-foundation.mjs` und `scripts/verify-ci.mjs`.
- Konten und Sitzung (R6): eigene Kontoentität mit eindeutiger, nicht
  leerer E-Mail (Datenbank-Constraint) und Anzeigename, Anmeldung und
  Abmeldung als Django-Views mit CSRF-Schutz,
  Anmeldeformular im Frontend. Gleiche Fehlerantwort für unbekanntes Konto
  und falsches Passwort. Erster Betreiber per `createsuperuser`.
- Bands und Rechte (R7): Band mit Owner-Mitgliedschaft, Liste und Detail
  nur für Mitglieder, fremde Band ist 404. Banddetail liefert die
  Songliste mit, Bandformular im Frontend.
- Songs (R8): Titel, Interpret, Tonart, BPM und Notiz, Anlegen, Ändern
  und Löschen mit Prüfung der BPM-Grenzen. Songliste ohne Neuladen.
- Bands umbenennen (R7) ist serverseitig auf Mitglieder beschränkt und
  geprüft; fremde Band bleibt 404.
- Setlists (R9): Abschnitte (Set, Pause, Zugabe) und Einträge (Song,
  Pause, Notiz) mit Positionen je Ebene. Der Inhalt wird als Ganzes in
  einer Transaktion ersetzt, ungültige Eingaben lassen den alten Stand
  stehen. Ein Song, der in einer Setlist steht, ist gegen Löschen
  geschützt. Frontend mit Setlist-Liste und Editor (Songwahl, Pausen,
  Notizen, Hoch/Runter, Speicherzustand).
- Auftritte (R10): bandgebundene Termine mit Pflicht-Titel und
  Pflicht-Datum, optionaler Uhrzeit, Ort, Notiz und Setlist-Verweis.
  Die API liefert Kommend und Vergangen nach Berliner Datum gruppiert.
  Der Setlist-Verweis ist ein Live-Link mit `SET_NULL`, kein historischer
  Snapshot. Frontend mit Reiter Auftritte, gemeinsamem Formular,
  bestätigtem Löschen und Direktlink auf die verknüpfte Setlist.
- Kern-Smoke `scripts/verify-kern.mjs`: baut den Core, legt zwei Konten
  an und prüft Anmeldung, CSRF, Bandschnitt, Songpflege, Setlist-Inhalt,
  Auftritte und Abmeldung über nginx.
- Gate-Schritt `docs-sync` (`scripts/docs-sync.mjs`): Produktänderungen
  brauchen eine neue Zeile in `CHANGELOG.md` unter `## [Unreleased]`, und
  `CHANGELOG.md`, `PROGRESS.md` sowie `DECISIONS.md` müssen vorhanden sein.
  Reine Doku- und Agentenänderungen sind ausgenommen. Ohne Git-Kontext ist
  der Schritt rot. Die Prüfung läuft als eigener Schritt in der CI; im
  lokalen Gate nur mit der nicht versionierten Harness-Konfiguration.

### Changed

- `CONTRIBUTING.md` nennt die Gate-Skripte jetzt korrekt als versioniert und
  beschreibt im Abschnitt Dokumentation, wann `CHANGELOG.md`, `PROGRESS.md` und
  `DECISIONS.md` gepflegt werden.

- Lizenz festgelegt: AGPL-3.0 (war als offen notiert, liegt bereits bei).
- Harness auf den beschlossenen Stack umgestellt:
  React/TypeScript/Vite, Django REST Framework, PostgreSQL,
  Redis/Channels, Docker statt Single-File-PWA und Netlify.
- Review-Policy verschärft: Review vor Push oder Merge Request ist
  verpflichtend statt nur auf Auftrag.
- Review-Basis an den Commit-Bereich gebunden: Ohne Upstream fällt
  `scripts/review-kilo.mjs` auf `origin/main` beziehungsweise `main`
  zurück, statt committete Änderungen ohne Review zu lassen.
- Offene Blocker und Major werden im Gate strukturiert aus
  Befundabschnitten (`## F<n>`) gelesen statt per Textfenster-Regex.
- Regeln entdoppelt: `kilo.jsonc` lädt nur `AGENTS.md`, die
  Projekt-Policy steht dort nur noch einmal. Review-Skill verlangt
  belastbare Evidenz statt zwingend fehlerzeigender Kommandos.
- Basis-Images und Manifeste auf den Stand vom 14.11.2026 gehoben:
  Python 3.13.18, Node 26.13.1, PostgreSQL 18.7, Redis 8.10.3,
  nginx 1.30.6, Django 5.2.19, gunicorn 27.0.1, argon2-cffi.
- Compose: nur der Web-Container ist erreichbar. API, PostgreSQL und
  Redis bleiben im internen Netz. Secret-Key und Datenbankpasswort
  sind Pflichtwerte.
- CI: Node 26.13.1, Python 3.13, Backend-Tests gegen PostgreSQL 18.7,
  Frontend mit Typprüfung, Tests und Build.
- Gate-Skripte bleiben versioniert. Harness, `AGENTS.md`, `kilo.jsonc`
  und die Agentenordner bleiben lokal. Ein frischer Clone nutzt die
  eingebauten Gate-Schritte.

### Security

- DRF verlangt standardmäßig Anmeldung, anonyme Aufrufe erhalten 401.
  Secure-Cookies, CSRF-Origin-Prüfung, Security-Header und
  Proxy-Vertrauen sind als Schalter und Tests abgesichert.
  Konfigurationsantworten enthalten keine Secrets oder interne
  Dienstadressen.
- Anmeldung ohne CSRF-Token wird abgelehnt. DRF-APIViews sind
  `csrf_exempt`, deshalb laufen Anmeldung und Abmeldung als
  Django-Views unter der CSRF-Middleware.
- nginx begrenzt Anmeldeversuche auf 20 pro Minute je IP (burst 10) und
  nimmt die Client-IP hinter dem TLS-Proxy aus X-Forwarded-For, aber nur
  von lokalen und privaten Adressen. Der Admin-Login hat eine eigene Zone
  (30 pro Minute, burst 20). X-Forwarded-Proto zählt nur von
  vertrauenswürdigen Clients. Tote Notiz-Komponente samt Adapter entfernt;
  die Speicherzustände hängen jetzt am Songformular.
- Passwörter liegen als Argon2-Hash mit Argon2 als erstem Hasher.

- Analyse der Alt-App: offene Firestore-Regeln, Passwort im Client,
  Klartextfeld in einem Banddokument. Keine Werte im Repository.
