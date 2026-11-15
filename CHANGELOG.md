# Changelog

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

### Changed

- Gate führt gleiche Verify-Befehle nur einmal aus und nennt bei einem Fehler
  alle betroffenen R-Zeilen. R6 bis R12 teilen sich `verify-kern`, das läuft
  jetzt einmal statt siebenmal.
- Gate-Schritte mit `parallel: true` starten mit dem Gate und zählen an ihrer
  Stelle im Ablauf. Beide Reviews laufen dadurch parallel zum Verify.
- Zweiter Review-Durchgang über eine direkte API-Anbindung. Getrennte Befunddatei über `REVIEW_OUT`, ein
  offener Blocker oder Major eines der beiden Gutachter stoppt den Push.

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
- Fuß in der App-Hülle mit dem Betreiber-Link „Powered by QFTM.de" (R4).
  Der Ressourcen-Test erlaubt genau diesen Anker und verbietet weiter alle
  externen Schriften und Hub-Aufrufe.
- Song-PDFs (R11): private Ablage außerhalb des Webroots, serverseitige
  Prüfung mit pypdf in einem begrenzten Unterprozess, unveränderliche
  Versionen mit zufälligen Dateischlüsseln, aktive Version über einen
  separaten Schritt mit Revision. Byte- und Seitenlimits sind
  konfigurierbar; 0 schaltet das jeweilige Limit ab. nginx leitet seine
  Grenze aus demselben Betreiberwert ab.
- PDF-Auslieferung (R11): Download und Ansicht nur über die API nach
  Bandmitgliedschaft, mit Byte-Ranges, exakten Range-Headern, nosniff und
  `private, no-store`. Dateischlüssel und Speicherpfad erscheinen nie in
  Antworten. Ein Song mit PDF-Versionen bleibt gegen Löschen geschützt.
- PDF-Ansicht (R11): lokaler PDF.js-Worker samt CMaps, Standardfonts und
  WASM über Vite, Seitenrendering ohne Formular- oder Anhangsebene,
  Tastatursteuerung, Zoom 50 bis 300 Prozent, Drehen, Originaldownload.
  Direktlink auf Song und Version, neuer Tab aus der Setlist.
- Anmerkungen (R12): Text und Marker an einer PDF-Version mit kanonischer
  Rechteckgeometrie, Autor, Revision, persönlicher oder bandweiter
  Sichtbarkeit. Der Server berechnet `can_edit` und `can_delete`; fremde
  persönliche Inhalte bleiben auch für Owner unsichtbar. Bandweite
  Anmerkungen darf der aktuelle Owner löschen, ändern nur der Autor.
- Anmerkungsoberfläche (R12): Lesen, Textsetzen und Markerzeichnen mit
  Maus, Touch und Tastatur, Farben und drei Schriftgrößen, getrennte
  Ebenen, Liste und Formular für Position und Größe. Konflikte erhalten den
  Entwurf und bieten den Serverstand an. Vor Versions-, Seiten-, Song- und
  Bandwechsel schützt ein Dialog mit Speichern, Verwerfen oder Abbrechen.
- Kern-Smoke erweitert (R11/R12): HTTP-Prüfungen für Upload, Limits,
  Rechte, Ranges, Konflikte und Löschschutz, dazu echte Browser-Smokes mit
  Chromium für PDF.js, Zoom, Rotation, CropBox, Touch, Entwürfe und
  Anmerkungsgeometrie. CI baut den Kern und installiert Chromium.
- Echtzeit-Abgleich (R13): authentifizierter WebSocket je Tab und Band
  unter `/ws/bands/<id>/` mit exaktem Origin, Session- und
  Mitgliedschaftsprüfung. Band- und persönliche Ereignisse laufen in
  getrennten Strömen mit eigenen Zählern. Jede Mutation schreibt ihr
  Ausgangsereignis in derselben PostgreSQL-Transaktion; ein eigener
  Relay-Dienst veröffentlicht wiederholt über Redis. Abgleich,
  Heartbeat, Wiederverbindung und Lückenerkennung halten Geräte aktuell.
  Daphne/ASGI ersetzt Gunicorn, nginx und Vite proxien `/ws`.
- `scripts/verify-realtime.mjs`: baut den Core, prüft Ausgangspuffer,
  Relay, Abgleich, Rechte und den Redis-Ausfall im echten Container.

### Fixed

- Drittreview R13: Entfernte Auftritte und Setlists bleiben im offenen
  Formular als gelöscht markiert, der Entwurf bleibt erhalten und das
  Speichern ist gesperrt; vergangene Auftritte behalten dabei ihre Gruppe.
  Der WebSocket begrenzt Verbindungen je Konto und Band sowie die
  Ping-Frequenz. Das Relay liest den Ausgangspuffer alle 50 Millisekunden,
  damit der Lastlauf die 1.000-Millisekunden-Grenze stabil hält. Lokale
  PDFs unter `docs/` sind ignoriert. Die Frontend-Tests laufen mit
  begrenzter Worker-Zahl stabiler.
- Zweitreview R13: Der CI-Job `kern` installiert die Root-Abhängigkeiten
  (auch `ws`). Anmerkungen behalten die Revision aus dem geöffneten Formular,
  gelöschte Anmerkungen bleiben als gelöscht markiert samt Entwurf, der
  Setlist-Hinweis erscheint nur bei Setlist-Ereignissen, und ein manipulierter
  Origin wird ohne Ausnahme abgelehnt.
- Review R13: Origin-Vergleich berücksichtigt den Port des Standard-Webs,
  der Vollabgleich stößt das Nachladen der Oberfläche an, persönliche
  Ereignisse erreichen die Anmerkungs- und Dokumentansicht, das Relay räumt
  den Ausgangspuffer im Dauerbetrieb auf, und `verify-realtime.mjs` öffnet
  echte WebSockets über nginx. Der Lastlauf mit 50 Verbindungen über fünf
  Bands prüft die 1.000-Millisekunden-Grenze.
- Nebenläufige Anlage derselben Anmerkungs-UUID endet kontrolliert: gleiche
  Daten liefern die vorhandene Anmerkung, abweichende Daten 409. Vorher
  konnte der Unique-Constraint als 500 durchschlagen (Review F1).
- Proxy- und API-Grenze für PDFs sind im Smoke belegt: knapp über dem
  Dateilimit antwortet die API 413, über Dateilimit plus 65.536 Byte der
  Proxy 413, und bei Limit 0 passiert ein 24-MB-Upload beide Schichten
  (Review F2).
- Der Browser-Smoke lädt eine PDF mit AcroForm und eingebettetem Anhang und
  prüft, dass die Ansicht nur Seiten rendert: kein Formular-DOM, keine
  Anhangsaktion und keine Navigation (Review F3).
- Zweitreview F1: UUID-Fallback nutzt `crypto.getRandomValues` statt einer
  festen Kennung. Uploads und Anmerkungen bleiben auch ohne
  `crypto.randomUUID` eindeutig.
- Zweitreview F2: ein eigener Stack mit 256 KiB Limit belegt die exakte
  Grenze: Datei am Limit erreicht die API, ein Byte mehr liefert 413, ein
  Byte über Limit plus 65.536 liefert 413 vom Proxy.
- Zweitreview F3: Wird der Song während des Uploads gelöscht, antwortet die
  API mit 404 statt 500; Datei und Datenbank bleiben konsistent.
- Zweitreview F4: der IntegrityError-Pfad der Anmerkungsanlage ist mit
  simuliertem Constraint-Fehler und beiden Ausgängen 200 und 409 getestet.
- Drittreview F1: skalare JSON-Körper auf Anmerkungs-POST und PATCH liefern
  400 statt 500. Tests decken Liste, Zahl, null und String ab.
- Drittreview F2: verschwindet eine Anmerkung zwischen Lesen und Sperren,
  antworten PATCH und DELETE mit 404 statt 500.
- Drittreview F3: der Browser-Zurück-Weg läuft durch denselben
  Entwurfswächter wie Links und Bandwechsel. Der Dialog bietet Speichern,
  Verwerfen oder Abbrechen, die URL bleibt bis zur Entscheidung stehen.

### Changed

- Browser-Zurück mit ungespeichertem Entwurf hält die aktuelle URL stabil und
  fragt nach Speichern, Verwerfen oder Abbrechen. Der zusätzliche
  History-Eintrag ist als Kompromiss dokumentiert (Review F2).

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
