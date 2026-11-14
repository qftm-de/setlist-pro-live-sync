# Stand

## Sofort

- Firestore in der Alt-App war am 13.11.2026 ohne Anmeldung lesbar.
- Gelesen: 4 Bands, 9 Mitgliedseinträge, 7 Songs, 2 Setlists, 9 Annotationen, 1 PDF.
- Eine Band enthält ein Klartextfeld `pw`. Das Passwort muss rotiert werden.
- Die Regeln müssen geschlossen werden. Das ist eine Aufgabe für den Kollegen mit Konsolenzugriff.
- Nichts wurde geändert, gelöscht oder geschrieben.

## Jetzt

- Analyse der Alt-App abgeschlossen. Ergebnisse unter `docs/analyse/` und `docs/brand/`.
- Hybrid-Plan beschlossen und abgelegt: `docs/planung/hybrid-modell.md`.
- Stack: React/TypeScript/Vite, Django REST Framework, PostgreSQL, Redis/Channels, Docker Compose.
- Zwei Betriebsmodi: `core` selbst gehostet und autark, `hub` zentral mit Community. Der Kern darf nicht vom Hub abhängen.
- Open Source über GitHub, Updates als Docker-Images über GHCR, optionaler Community-Hub als eigene Instanz.
- Lizenz steht fest: AGPL-3.0. `LICENSE`, README und CONTRIBUTING liegen bei.
- Harness auf den beschlossenen Stack umgestellt (`harness/projekt.yaml`), gerendert, keine Konflikte. Die Härtung von `scripts/review-constraints.mjs` liegt jetzt in der Harness-Quelle, sonst würde sie der nächste Render überschreiben.
- Prozess scharf geschaltet: Requirements-Gate vor jedem Produktcode, Review vor jedem Push oder Merge Request, Version-Bumps nach SemVer mit CHANGELOG-Eintrag.
- R2 umgesetzt: Gerüst steht. Frontend (Vite, React, TypeScript, Vitest), Backend (Django, DRF, Health-Endpoint unter `/api/health/`), `docker-compose.yml` mit web, api, db (PostgreSQL), cache (Redis) im Modus core, CI-Workflow baut und testet beide Seiten. Backend-Tests laufen lokal grün, Frontend-Tests und Build ebenso.
- Lokaler Export der Alpha: `.tmp/fb/export.zip`, Rohdaten unter `.tmp/fb/`. Der Ordner ist gitignored.
- Doku bereinigt: alte Projekt-ID, Bandcodes und Demo-Namen entfernt. Screens der Alt-App bleiben lokal, `docs/analyse/screens/` ist gitignored.
- Sicherheits-Baseline im Gate: `scripts/review-constraints.mjs` blockt Secrets, Zugangsdaten, private IPs, eingebettete Dateien und unsichere Code-Muster, auch in `docs/` und `.yaml`.
- Das Gerüst (R2) ist passing, inklusive Smoke-Test über `scripts/geruest-smoke.mjs`. Produktfunktionen sind noch nicht gebaut und kommen als eigene R-Zeilen.

## Offen

- Firestore-Regeln schließen: erst Anmeldung, dann Mitgliedschaft pro Band.
- Passwort rotieren und das Feld `pw` entfernen.
- V12-Datei und aktuelle Alpha-Verteilung beim Kollegen klären.
- Storage auf verwaiste PDFs prüfen. Dafür braucht es Leserechte.
- Hub-Domain, Name und Moderationsverantwortung festlegen.
- Support- und Release-Rhythmus festlegen, inklusive Reaktionszeit auf Sicherheitsmeldungen. Dazu SUPPORT.md.
- Governance festlegen: wer reviewt, wer merged, wer releast. CODEOWNERS, sobald ein Team steht.
- Öffentliche CI klären: das lokale Gate ist nicht im Repo. Vor dem Öffnen braucht die CI eigene Checks, die Contributor nachvollziehen können.
- Namen „Setlist Pro“ vor öffentlicher Veröffentlichung prüfen.

## Als Nächstes

1. Firestore-Regeln schließen und Passwort rotieren.
2. Hub-Domain entscheiden.
3. Core bauen: Auth, Bands, Songs, Setlists, PDFs, Annotationen, Realtime, Bühne. Jede Fläche als eigene R-Zeile.
4. Betrieb: Backup, Restore, Upgrade, Release.
5. Erst danach den Hub als eigene Instanz.

## Hinweis

`alte_projektdatein/` ist bewusst gitignored und nicht versioniert. Der frühere Plan
„Baseline committen“ ist damit nicht umsetzbar, ohne die Ignore-Regel zu ändern.
Der Ordner bleibt als lokale Referenz erhalten.
