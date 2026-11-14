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
- Pre-Push-Review-Pipeline steht: Gate-Schritt `kilo-review` in `harness/projekt.yaml` ruft `scripts/review-kilo.mjs` auf, das den Review-Agenten non-interaktiv per `kilo run` startet. Läuft nur, wenn die Befunddatei nicht zum Stand passt. Dafür erlaubt das Schema der Harness-Quelle jetzt eigene `{name, run}`-Schritte im Gate.
- Qualitätssicherung nach Prozess-Bewertung nachgebaut (2026-11-14):
  - Gate-Skripte sind versioniert, Harness und Agentenkonfiguration bleiben lokal. Ein frischer Clone führt das Gate mit den eingebauten Schritten aus: `npm ci` im Root, dann `node scripts/gate.mjs --schnell`. Simulation ohne Harness-Quelle geprüft.
  - CI hat einen Job `gate` (Requirements-Gate, Security-Baseline, Gitleaks) vor den Test-Jobs.
  - Review-Basis fällt ohne Upstream auf `origin/main`/`main` zurück statt nur auf den Working Tree. Szenarien in einem Wegwerf-Repo geprüft.
  - R1-Verify ist eine echte Prüfung geworden (`scripts/check-repo.mjs`), R1 und R2 sind erneut passing (inklusive Smoke-Test).
  - Das Voll-Gate liest offene Blocker und Major strukturiert aus Befundabschnitten (`## F<n>`), der Review-Skill schreibt dieses Format vor.
  - Regeln entdoppelt: `kilo.jsonc` lädt nur `AGENTS.md`, Projekt-Policy nur einmal, `.kilo/rules` und `.claude/rules` entfallen. Review-Skill verlangt belastbare Evidenz (Kommando bevorzugt, Kontrollfluss sonst, Unsicherheit kennzeichnen). Schreibregeln sind Sprachkonventionen ohne Texter-Rolle.
  - Struktur-Regel mit Gate-Schritt `lint-file-size`: Code 300 Ziel/500 hart, Doku 500 Ziel/1000 hart, läuft lokal (schnell/voll) und in CI. Aktuell grün mit zwei Hinweisen (`scripts/lib/requirements.mjs`, `scripts/gate.mjs` je über 300, unter 500).
- Das Gerüst (R2) ist passing, inklusive Smoke-Test über `scripts/geruest-smoke.mjs`. Produktfunktionen sind noch nicht gebaut und kommen als eigene R-Zeilen.
- Paket 1 umgesetzt und passing (R3 bis R5, 2026-11-14):
  - R3 Backend-Laufzeit: `APP_MODE=core` ist Pflicht, Secret-Key und PostgreSQL sind Pflicht, `/api/config/` liefert nur Modus, Instanzname und validierten Community-Link zur Laufzeit. Health prüft die Datenbank. DRF verlangt Anmeldung und antwortet anonym mit 401. Secure-Cookies, CSRF-Origin-Prüfung, Security-Header und Proxy-Vertrauen sind über Tests abgedeckt.
  - R4 Frontend und Proxy: nginx liefert SPA-Fallback, proxyt `/api`, `/admin` und `/static` unter derselben Origin. Die React-Hülle hat Navigation, Bandwechsel, API-Fehlerklassen für 401/403/500/Netz und schützt Ansichten ohne Session. Lade-, Fehler- und Speicherzustände sind über eine injizierbare Speicherkomponente vorbereitet; der Standard-Schreibpfad folgt mit Bands und Annotationen.
  - R5 CI: Gate mit Requirements und Sicherheits-Baseline, Frontend mit Typprüfung, Tests und Build, Backend gegen PostgreSQL 18.7 mit Python 3.13 und Node 26.13.1. `scripts/verify-ci.mjs` prüft den Workflow.
  - Basis-Images und Manifeste auf dem Stand aus `docs/planung/versionen.md`. Die falsche allauth-Zeile ist korrigiert: headless auch im Core.
  - Verify-Wrapper: `verify-foundation.mjs`, `verify-ui-foundation.mjs`, `verify-ci.mjs`. CI ruft die Tests direkt auf, nicht die Wrapper.
- Paket 2 umgesetzt und passing (R6 bis R8, 2026-11-14):
  - R6 Konten und Sitzung: eigene Kontoentität `accounts.User` (E-Mail eindeutig, Anzeigename), Anmeldung und Abmeldung als Django-Views mit CSRF-Schutz, Anmeldeformular im Frontend, Anmeldeversuche über nginx begrenzt. Erster Betreiber per `createsuperuser --noinput`.
  - R7 Bands und Rechte: `bands.Band` und `bands.Membership`, Ersteller wird Owner, Liste und Detail nur für Mitglieder, fremde Band ist 404.
  - R8 Songs: `library.Song` mit Titel, Interpret, Tonart, BPM und Notiz; Anlegen, Ändern und Löschen, BPM zwischen 20 und 400.
  - Frontend verdrahtet: Anmeldung, Band anlegen, Songs anlegen und löschen, jeweils ohne Neuladen der Seite.
  - Neuer Kern-Smoke `scripts/verify-kern.mjs`: baut den Core, legt zwei Konten an und prüft den ganzen Weg über nginx (CSRF, Anmeldung, Bandschnitt, Songpflege, Abmeldung).
  - Vorabversion ist damit lokal testbar. Start in `README.md`, Abschnitt „Lokal starten".

## Offen

- Firebase und Firestore sind abgekündigt. Der alte Bestand bleibt als lokaler Export in `.tmp/fb/` und ist keine Projektaufgabe mehr. Offen bleibt nur die persönliche Hygiene: ein in der Alt-App sichtbares Passwort bei anderer Gelegenheit rotieren.
- Hub-Domain, Name und Moderationsverantwortung festlegen.
- Support- und Release-Rhythmus festlegen, inklusive Reaktionszeit auf Sicherheitsmeldungen. Dazu SUPPORT.md.
- Governance festlegen: wer reviewt, wer merged, wer releast. CODEOWNERS, sobald ein Team steht.
- Gitleaks lokal installieren, damit das Voll-Gate den Schritt prüft statt ihn als optional zu überspringen (in CI läuft er bereits).
- Namen „Setlist Pro“ vor öffentlicher Veröffentlichung prüfen.

## Als Nächstes

1. Paket 3: Setlists und Auftritte mit Abschnitten, Pausen, Zugaben und stabiler Reihenfolge.
2. Danach PDFs und Annotationen, Echtzeit-Abgleich, Bühnenmodus und Export als eigene R-Zeilen.
3. Paket 10 und 11: Betrieb, private Auslieferung, Pilot-Abnahme.
4. Erst danach der Hub als eigene Instanz.

## Hinweis

`alte_projektdatein/` ist bewusst gitignored und nicht versioniert. Der frühere Plan
„Baseline committen“ ist damit nicht umsetzbar, ohne die Ignore-Regel zu ändern.
Der Ordner bleibt als lokale Referenz erhalten.
