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
- Qualitätssicherung nachgebaut: Harness, Gate-Skripte und
  Agentenkonfiguration sind versioniert. Ein frischer Clone führt das
  Gate nach `npm ci` im Root aus.
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
  Navigation, Bandwechsel, getrennten Zuständen und API-Fehlerklassen.
- Paketprüfungen: `scripts/verify-foundation.mjs`,
  `scripts/verify-ui-foundation.mjs` und `scripts/verify-ci.mjs`.

### Changed

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

### Security

- DRF verlangt standardmäßig Anmeldung, anonyme Aufrufe erhalten 401.
  Secure-Cookies, CSRF-Origin-Prüfung, Security-Header und
  Proxy-Vertrauen sind als Schalter und Tests abgesichert.
  Konfigurationsantworten enthalten keine Secrets oder interne
  Dienstadressen.

- Analyse der Alt-App: offene Firestore-Regeln, Passwort im Client,
  Klartextfeld in einem Banddokument. Keine Werte im Repository.
