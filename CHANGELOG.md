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

### Changed

- Lizenz festgelegt: AGPL-3.0 (war als offen notiert, liegt bereits bei).
- Harness auf den beschlossenen Stack umgestellt:
  React/TypeScript/Vite, Django REST Framework, PostgreSQL,
  Redis/Channels, Docker statt Single-File-PWA und Netlify.
- Review-Policy verschärft: Review vor Push oder Merge Request ist
  verpflichtend statt nur auf Auftrag.

### Security

- Analyse der Alt-App: offene Firestore-Regeln, Passwort im Client,
  Klartextfeld in einem Banddokument. Keine Werte im Repository.
