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
  - Struktur-Regel mit Gate-Schritt `lint-file-size`: Code 300 Ziel/500 hart, Doku 500 Ziel/1000 hart, läuft lokal (schnell/voll) und in CI. Aktuell grün mit fünf Hinweisen (`scripts/verify-kern.mjs`, `scripts/lib/requirements.mjs`, `scripts/gate.mjs`, `frontend/src/App.gigs-fehler.test.tsx` und `backend/api/test_gigs.py` je über 300, unter 500).
  - Dokumentations-Regel mit Gate-Schritt `doku-sync`: Produktänderungen brauchen einen neuen Eintrag in `CHANGELOG.md` unter `## [Unreleased]`, und `CHANGELOG.md`, `PROGRESS.md` sowie `DECISIONS.md` bleiben vorhanden. Reine Doku- und Agentenänderungen sind ausgenommen. Der Schritt steht in `harness/projekt.yaml` für `--schnell` und `--voll` und läuft als eigener Schritt in der CI. Die verbindliche Schranke ist der CI-Schritt, weil ein frischer Clone die Harness-Konfiguration nicht mitbringt. Regeltext in `CONTRIBUTING.md`, Abschnitt Dokumentation.
- Das Gerüst (R2) ist passing, inklusive Smoke-Test über `scripts/geruest-smoke.mjs`. Produktfunktionen sind noch nicht gebaut und kommen als eigene R-Zeilen.
- Paket 1 umgesetzt und passing (R3 bis R5, 2026-11-14):
  - R3 Backend-Laufzeit: `APP_MODE=core` ist Pflicht, Secret-Key und PostgreSQL sind Pflicht, `/api/config/` liefert nur Modus, Instanzname und validierten Community-Link zur Laufzeit. Health prüft die Datenbank. DRF verlangt Anmeldung und antwortet anonym mit 401. Secure-Cookies, CSRF-Origin-Prüfung, Security-Header und Proxy-Vertrauen sind über Tests abgedeckt.
  - R4 Frontend und Proxy: nginx liefert SPA-Fallback, proxyt `/api`, `/admin` und `/static` unter derselben Origin. Die React-Hülle hat Navigation, Bandwechsel, API-Fehlerklassen für 401/403/500/Netz und schützt Ansichten ohne Session. Lade-, Fehler- und Speicherzustände sind über eine injizierbare Speicherkomponente vorbereitet; der Standard-Schreibpfad folgt mit Bands und Annotationen.
  - R5 CI: Gate mit Requirements und Sicherheits-Baseline, Frontend mit Typprüfung, Tests und Build, Backend gegen PostgreSQL 18.7 mit Python 3.13 und Node 26.13.1. `scripts/verify-ci.mjs` prüft den Workflow.
  - Basis-Images und Manifeste auf dem Stand aus `docs/planung/versionen.md`. Die falsche allauth-Zeile ist korrigiert: headless auch im Core.
  - Verify-Wrapper: `verify-foundation.mjs`, `verify-ui-foundation.mjs`, `verify-ci.mjs`. CI ruft die Tests direkt auf, nicht die Wrapper.
- Paket 2 umgesetzt und passing (R6 bis R8, 2026-11-14):
  - R6 Konten und Sitzung: eigene Kontoentität `accounts.User` (E-Mail eindeutig und nicht leer per Constraint, Anzeigename), Anmeldung und Abmeldung als Django-Views mit CSRF-Schutz, Anmeldeformular im Frontend, Anmeldeversuche über nginx begrenzt. Erster Betreiber per `createsuperuser --noinput`.
  - R7 Bands und Rechte: `bands.Band` und `bands.Membership`, Ersteller wird Owner, Liste und Detail nur für Mitglieder, fremde Band ist 404.
  - R8 Songs: `library.Song` mit Titel, Interpret, Tonart, BPM und Notiz; Anlegen, Ändern und Löschen, BPM zwischen 20 und 400.
  - Frontend verdrahtet: Anmeldung, Band anlegen, Songs anlegen und löschen, jeweils ohne Neuladen der Seite.
  - Neuer Kern-Smoke `scripts/verify-kern.mjs`: baut den Core, legt zwei Konten an und prüft den ganzen Weg über nginx (CSRF, Anmeldung, Bandschnitt, Songpflege, Abmeldung).
  - Vorabversion ist damit lokal testbar. Start in `README.md`, Abschnitt „Lokal starten".
- Paket 3 umgesetzt (R9, 2026-11-14):
  - `setlists.Setlist`, `Section` (Set, Pause, Zugabe) und `Entry` (Song, Pause, Notiz) mit Positionen je Ebene und eindeutigen Namen je Band.
  - Inhalt wird als Ganzes per `PUT /api/bands/{id}/setlists/{id}/content/` in einer Transaktion ersetzt. Positionen folgen der Reihenfolge der Eingabe.
  - Fremde Bands 404, Songs aus fremder Band 400, ungültige Eingaben 400 und der alte Inhalt bleibt stehen.
  - Song, der in einer Setlist steht, lässt sich nicht löschen (400) bis er dort entfernt wurde.
  - Frontend: Setlist-Liste, Anlegen, Löschen und ein Editor mit Abschnitten, Songwahl, Pausen, Notizen, Hoch/Runter und einem Speicherzustand.
  - `verify-kern.mjs` fährt den ganzen Setlist-Weg über nginx, inklusive doppeltem Song und Löschsperre.
- Paket 4 umgesetzt (R10, 2026-11-15):
  - `gigs.Gig` mit Band, Pflicht-Titel, Pflicht-Datum, optionaler Uhrzeit, Ort, Notiz und Setlist-Verweis. Der Verweis ist ein Live-Link mit SET_NULL, kein historischer Snapshot. Setlist-Änderungen wirken deshalb auch bei vergangenen Auftritten.
  - Die additive Migration läuft im bestehenden Startpfad mit `migrate`. Eine Rückmigration entfernt die Auftrittstabelle samt Daten und ist nur vor der Nutzung oder nach einer Sicherung sinnvoll.
  - `GET /api/bands/{id}/gigs/` liefert Kommend und Vergangen serverseitig gruppiert. Maßgeblich ist das Berliner Datum über `timezone.localdate()`. Kommend sortiert aufsteigend, Vergangen absteigend. Innerhalb eines Tages gilt Uhrzeit aufsteigend, ohne Uhrzeit zuletzt, danach ID.
  - Anlegen, Lesen, Ändern und Löschen für alle Bandmitglieder. Fremde Bands und Auftritte sind 404. Unbekannte und bandfremde Setlists liefern dieselbe Feldfehlermeldung mit 400. Ein paralleler Setlist-Löschkonflikt endet kontrolliert als 400.
  - Frontend: Reiter Auftritte, beide Gruppen mit Leerzuständen, gemeinsames Formular für Anlegen und Bearbeiten, Setlist-Auswahl, bestätigtes Löschen, getrennter Speicher- und Listenabgleich sowie gesperrte Aktionen während Schreibvorgängen.
  - Setlist-Direktlink unter `/setlists/{bandId}/{setlistId}`. Die URL-Band wird nur aus sichtbaren Mitgliedsbands gewählt, eine fehlende Setlist meldet sich sichtbar. Ein manueller Bandwechsel verlässt den Direktpfad.
  - `verify-kern.mjs` führt jetzt zusätzlich die Backend-Tests im API-Container und Frontend-Tests samt Build aus. Der HTTP-Smoke für Auftritte liegt in `scripts/lib/verify-gigs.mjs`.
  - Review-Befunde F1 bis F3 behoben: Ein 401 im Listenabgleich führt jetzt zur Anmeldung, ein Reiterklick aus dem Direktlink erhält den Editor-Entwurf, und eine fehlerhaft kodierte Band-URL meldet eine nicht sichtbare Band statt einer leeren Seite. Für alle drei Fälle gibt es Tests.
  - Sichtprüfung auf schmalem Mobilformat und Desktop steht aus, weil in dieser Umgebung kein laufendes Browserwerkzeug verfügbar war. Die Prüfung bleibt offen.
- Paket 5 umgesetzt (R11 und R12, 2026-11-15):
  - PDF-Ablage liegt privat unter `DOCUMENTS_ROOT` in einem eigenen Volume. nginx liefert sie nie direkt aus; jede Datei geht durch die API und die aktuelle Bandmitgliedschaft.
  - `documents.Document` und `DocumentVersion` speichern unveränderliche Fassungen mit Nummer, UUID des Uploads, SHA-256, Originalname und Seitenzahl. `active_version` wird nur per PATCH mit Revision geändert. Uploads prüfen pypdf in einem Unterprozess mit Zeit- und Speichergrenze.
  - Byte- und Seitenlimits kommen aus `PDF_MAX_UPLOAD_BYTES` und `PDF_MAX_PAGES`, 0 deaktiviert das jeweilige Limit. Der Web-Container leitet seine `client_max_body_size` aus demselben Wert plus 65.536 Byte Multipart-Spielraum ab. `manage.py bereinige_dokumente` entfernt nur alte, nicht referenzierte Dateireste.
  - Dateiauslieferung mit 200 und 206, geschlossenen, offenen und Suffix-Ranges, 416 mit `bytes */Größe`, `application/pdf`, nosniff, `private, no-store` und bereinigtem Downloadnamen. Songs mit PDF-Versionen liefern beim Löschen 400 und bleiben vollständig.
  - Frontend: PDF.js-Worker, CMaps, Standardfonts und WASM lokal über Vite. Seite als Canvas ohne Formular- oder Anhangsebene, Zoom 50 bis 300 Prozent, Drehen, Breite anpassen, Originaldownload. Direktlink `/songs/{band}/{song}/pdf[/versions/{id}]`; aus der Setlist öffnet der Link einen neuen Tab. Upload, Abgleich über UUID, Aktivierung und Versionswechsel sind getrennt.
  - `annotations.Annotation` speichert Text oder Marker mit normalisierter Geometrie, Farbe, Schriftgröße, Autor, Revision und Sichtbarkeit `private` oder `band`. Persönliche Inhalte sieht nur der Autor; bandweite sieht die Band. `can_edit` und `can_delete` kommen vom Server, der aktuelle Owner löscht bandweite Anmerkungen.
  - Anmerkungsoberfläche mit Lesen, Textsetzen, Markerzeichnen per Maus, Touch und synthetischen Pointer-Events, Tastaturformular, Farben, drei Schriftgrößen und getrennten Ebenen. Ein Dialog schützt ungespeicherte Entwürfe vor Versions-, Seiten-, Song- und Bandwechsel und bietet Speichern, Verwerfen oder Abbrechen. Konflikte liefern 409, behalten den Entwurf und bieten den Serverstand an.
  - `verify-kern.mjs` prüft zusätzlich PDF- und Anmerkungs-HTTP-Wege und startet echte Chromium-Smokes. Die Browser-Tests decken echtes PDF.js-Rendering, Zoom, Rotation, CropBox, Direktlink, Setlist-Entwurf, Touch, Pointer-Abbruch und die Anmerkungsgeometrie über vier Drehungen ab. CI hat dafür einen eigenen Job mit `playwright install --with-deps chromium`.
  - Review-Befunde F1 bis F3 behoben: Nebenläufige Anmerkungs-UUIDs liefern kontrolliert 200 oder 409, die Proxy-Grenze ist mit 413 und dem Limit-0-Fall im Smoke belegt, und ein PDF mit AcroForm und Anhang wird im Browser ohne Formular-DOM, Anhangsaktion oder Navigation gerendert.
  - Zweitreview F1 bis F4 behoben: UUID-Fallback ohne feste Kennung, aktive Proxy-Grenze mit 256-KiB-Stack exakt geprüft, Song-Löschung während des Uploads als 404 und IntegrityError-Pfad der Anmerkungsanlage mit 200 und 409 getestet.
  - Drittreview F1 bis F3 behoben: skalare JSON-Körper liefern 400, verschwundene Anmerkungen bei PATCH und DELETE 404, und der Browser-Zurück-Weg nutzt denselben Entwurfswächter wie die übrigen Wechsel.

- Paket 6 umgesetzt (R13, 2026-11-15):
  - `realtime` speichert je Band und je Band/Konto einen Strom mit eigenem Zähler. Zähler und Ereignis entstehen unter Zeilensperre in derselben Transaktion wie die Fachdaten. Ein Rollback hinterlässt weder Ereignis noch Bestätigung.
  - Der Dienst `relay` veröffentlicht den Ausgangspuffer wiederholt über Redis. Fehlgeschlagene Veröffentlichungen bleiben offen, Duplikate sind erlaubt. Ereignisse bleiben sieben Tage, unveröffentlichte länger.
  - Daphne/ASGI ersetzt Gunicorn. nginx und Vite proxien `/ws`, der Consumer prüft exakten Origin, Session, aktives Konto und Mitgliedschaft beim Aufbau, alle 15 Sekunden und vor jeder Auslieferung.
  - Band- und persönliche Ströme sind getrennt. Persönliche Anmerkungen erzeugen nur Ereignisse im persönlichen Strom. Beim Privatisieren erhält der Bandstrom ausschließlich eine Entfernen-Meldung ohne Inhalt.
  - `GET /api/bands/{id}/sync/` liefert Bestandsdaten und Zähler aus einem PostgreSQL-Snapshot. Ein neuer Abgleich läuft nach Wiederverbindung, Lücke oder verlorenem letzten Ereignis.
  - Frontend: stiller Sync-Client mit Heartbeat, Wiederverbindung zwischen 1 und 30 Sekunden, Lückenerkennung, sichtbarem Verbindungszustand und erneutem Versuch. Banddaten, Setlist-Liste und Auftritte laden bei Bandereignissen nach, ohne offene Entwürfe zu ersetzen.
  - `scripts/verify-realtime.mjs R13` prüft Backend, Frontend, Abgleich, Rechte, API-Neustart und Redis-Ausfall im Container. Ein echter WebSocket-Client prüft Handshake über nginx, Origin-Ablehnung, zwei Autor-Tabs, Mitgliedsempfang, Entzug, Privatsphäre und die Zustelllatenz: Der Median je Band liegt unter 1.000 Millisekunden, ein Einzelwert über 4.000 Millisekunden gilt als Hänger und lässt den Lauf scheitern. Der Lastlauf nutzt 50 Verbindungen über fünf Bands und 100 bestätigte Änderungen in rund 10 Sekunden.
  - Review R13 behoben: Port im Origin-Vergleich, Abgleichdaten lösen das Nachladen aus, persönliche Ereignisse aktualisieren Dokument und Anmerkungen, entfernte Songs bleiben im offenen Formular markiert, das Relay räumt stündlich auf.
  - Drittreview R13 behoben: Löschmarken für entfernte Auftritte und Setlists (vergangene Auftritte bleiben in ihrer Gruppe), Verbindungs- und Ping-Grenzen am WebSocket, schnellere Relay-Abfrage für die Latenzgrenze, lokale PDFs unter `docs/` ignoriert, begrenzte Test-Worker gegen Lastflackern.
  - Zweitreview R13 behoben: Root-`npm ci` im CI-Job `kern`, eingefrorene Bearbeitungsrevision für Anmerkungen, Löschmarke für entfernte Anmerkungen mit erhaltenem Entwurf, Setlist-Hinweis nur bei `setlist.`-Ereignissen, robuste Origin-Prüfung bei manipulierten Ports. R14 und R15 folgen als eigene Pakete mit eigenen R-Zeilen.

- Paket 7 umgesetzt (R14, 16.11.2026):
  - `collaboration` speichert Yjs-Textzustände mit Epoche und Revision, dazu
    Löschmarken. `pycrdt` läuft auf Python 3.13; der Interop-Nachweis mit Yjs
    deckt Merge, Unicode-Grenzen, parallele Änderungen und Kompaktierung ab.
  - Setlists tragen Revision und UUIDs. Der Gesamt-PUT verlangt die
    Entwurfsrevision (400/409) und gleicht Zeilen über UUIDs ab. Gelöschte
    UUIDs bleiben gesperrt. Einzelbefehle sind über `command_id` und
    Nutzdaten-Signatur idempotent.
  - Textupdates laufen über REST und den Band-WebSocket durch denselben
    Schreibdienst. Das Backend wendet sie isoliert an, begrenzt sie auf
    64 KiB und speichert Zustand, Revision und Ereignis gemeinsam.
  - Bandweite Anmerkungen darf jedes Mitglied bearbeiten; nur der Autor
    ändert die Sichtbarkeit. Privatisierung erhöht die
    Berechtigungsgeneration und sperrt alte Textupdates. `can_change_visibility`
    kommt vom Server.
  - Frontend: CRDT-Textfelder für Setlist-, Abschnitts- und Eintragsnamen,
    250-ms-Bündelung, sichtbare Zustände offen/bestätigt/abgelehnt,
    Konfliktzusammenführung beim PUT und pausierte Bearbeitung ohne Verbindung.
  - `scripts/verify-realtime.mjs R14` prüft Backend-Tests, Revision und UUIDs,
    Befehle, Textepochen, Anmerkungsrechte und beide WebSocket-Schreibwege.
- Paket 8 umgesetzt (R15, 16.11.2026):
  - `stage` hält eine aktive Sitzung je Band mit Snapshot aus Abschnitten,
    Eintrags-UUIDs, Songmetadaten und konkreten PDF-Versionen. Spätere
    Setlist-Änderungen, Löschungen und PDF-Aktivierungen verändern ihn nicht.
  - Das Verbindungsregister liegt in PostgreSQL, wird beim WebSocket-Aufbau
    erzeugt, per Heartbeat berührt und beim Schließen beendet. `ready` liefert
    die Kennung; HTTP-Lebenszyklus und Steuerbefehle prüfen sie je Aufruf.
  - Start, Beitritt, Übergabe, Owner-Übernahme, Rückkehr und Ende sind
    serverseitig geprüft. Steuerbefehle tragen Generation und Nummer, sind
    idempotent, lehnen Pausen, Seiten außerhalb und fremde Verbindungen ab.
  - Die Bühnenansicht folgt freiwillig, navigiert lokal ohne Umlauf, hält Zoom
    und Drehung je Gerät, zeigt bandweite Anmerkungen und bereitet PDFs samt
    Seite 1 in einer Lesereserve bis 128 MiB vor. Wake Lock und Vollbild sind
    optional und aufräumbar.
  - Einstiege aus Setlist und Auftritt starten oder öffnen die laufende
    Sitzung; der Direktlink zeigt denselben Snapshot. `stage.*`-Ereignisse
    lösen keinen Bandabgleich aus.
  - `scripts/verify-realtime.mjs R15` prüft Snapshot, Startrennen, Rechte,
    CSRF, Nummern, Generationen, Übergabe, Übernahme, Rückkehr, Ende,
    Mitgliedschaftsentzug, PDF-Zugriff und beide Leitungsverluste.
- Gate und Review beschleunigt (15.11.2026): gleiche Verify-Befehle laufen
  einmal statt pro R-Zeile, Schritte mit `parallel: true` starten zusammen mit
  dem Gate, und ein zweiter Gutachter (ein externes Modell, direkte API) prüft
  denselben Diff in einer eigenen Befunddatei. Der Push dauert damit rund
  sieben statt dreizehn Minuten.
- `verify-kern` und `verify-realtime` nutzen eigene Compose-Projektnamen und
  Ports je Lauf, zwei gleichzeitige Gates stören sich nicht mehr.

## Offen

- Firebase und Firestore sind abgekündigt. Der alte Bestand bleibt als lokaler Export in `.tmp/fb/` und ist keine Projektaufgabe mehr. Offen bleibt nur die persönliche Hygiene: ein in der Alt-App sichtbares Passwort bei anderer Gelegenheit rotieren.
- Hub-Domain, Name und Moderationsverantwortung festlegen.
- Release-Rhythmus und die Antwortzeit in `SUPPORT.md` stehen. Offen ist nur noch, wer die Meldungen tatsächlich bearbeitet.
- Governance festlegen: wer reviewt, wer merged, wer releast. CODEOWNERS, sobald ein Team steht.
- Gitleaks lokal installieren, damit das Voll-Gate den Schritt prüft statt ihn als optional zu überspringen (in CI läuft er bereits).
- Namen „Setlist Pro“ vor öffentlicher Veröffentlichung prüfen.

## Als Nächstes

1. Sichtprüfung der Auftritte und PDFs auf Mobilformat und Desktop nachholen; die Chromium-Smokes prüfen die Funktion, nicht die Gestaltung.
2. Push offen: das Voll-Gate stoppt an einer Designfrage, nicht an einem Defekt. Die Gutachter fordern abwechselnd die Revisionerhöhung im Textpfad und die Rücknahme der Übernahme im Client. Die geltende Entscheidung steht in `DECISIONS.md` unter Zusammenarbeit.
3. Bühnenansicht auf einem echten Tablet prüfen: Lesereserve mit mehr als 128 MiB, Wake Lock, Vollbild und sehr kleine Displays.
4. Export als eigene R-Zeile.
5. Paket 10 und 11: Betrieb, private Auslieferung, Pilot-Abnahme.
6. Erst danach der Hub als eigene Instanz.

## Hinweis

`alte_projektdatein/` ist bewusst gitignored und nicht versioniert. Der frühere Plan
„Baseline committen“ ist damit nicht umsetzbar, ohne die Ignore-Regel zu ändern.
Der Ordner bleibt als lokale Referenz erhalten.
