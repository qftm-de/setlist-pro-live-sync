# Changelog

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

### Added

- Betreiber erzeugen mit `manage.py instanz_einladung` einen Einladungslink ohne Bandbezug. Wer ihn oeffnet, legt nur ein Konto an und gruendet seine Band danach selbst. Laufzeit 1 bis 90 Tage, optionales Nutzungslimit, Widerruf per Kommando, eigene Vorschau und Beitritt unter `/api/beitritt/<token>/` mit derselben Rate-Bremse und Token-Redaktion wie die Band-Einladung (R23).
- Die Seite `/beitritt/<token>` zeigt Hinweis und Ablaufzeit, nutzt das Formular der Band-Einladung mit neutralen Beschriftungen und fuehrt nach der Kontoanlage zur Band-Erstellung. Bereits angemeldete Besucher bekommen den Weg zur Band statt eines zweiten Kontos (R24).

### Changed

- Release 0.3.0: Version in `frontend/package.json` und in `docker-compose.release.yml` auf 0.3.0 gehoben, damit Tag, Images und Compose zusammenpassen (R17).
- Release 0.2.0: Version in `frontend/package.json` und in `docker-compose.release.yml` auf 0.2.0 gehoben, damit Tag, Images und Compose zusammenpassen (R17).

### Fixed

- Einladungen sind im Django-Admin vollständig schreibgeschützt. Laufzeit, Widerruf und Löschung laufen nur über die Fachdienste (R22).
- Ein verspäteter Listenabruf nach einem Einladungsbeitritt wechselt nach einer zwischenzeitlichen Navigation die aktive Band nicht mehr (R4, R22).
- Ein laufender Einladungsabruf überschreibt keine bereits bestätigte Erstellung oder keinen bestätigten Widerruf mehr; nach dem Entfernen eines Mitglieds schließt ein fehlgeschlagener Listenabgleich die Bestätigung und zeigt den Fehler getrennt (R21, R22).
- Eine ältere PATCH-Antwort der Band-Einstellungen überschreibt keine während des Speicherns eingetroffene Hintergrundänderung an unberührten Feldern mehr (R21).
- Verspätete 403/404-Sync-Fehler einer verlassenen Band sperren die neu gewählte Band nicht mehr (R4, R13, R21).
- Ein vorübergehender Verbindungsabbruch mit positivem Serverabgleich stellt den Zugriff auf die Band wieder her und bietet bei Fehlern einen erneuten Versuch (R13, R21).
- Nach einem bestätigten Einladungsbeitritt wiederholt ein Ladefehler nur das Öffnen der Band statt den Einladungs-POST erneut zu senden (R22).
- Der Django-Admin verhindert das Anlegen von Bands ohne Owner sowie das Löschen von Konten über kaskadierende Mitgliedschaften (R6, R7, R21).
- Der Bühnenmodus zeigt nur Anmerkungen der sichtbaren PDF-Seite und des tatsächlich angezeigten Songs. Lokales Blättern und Songwechsel mischen keine fremden Texte mehr ein (R15).
- Die Einladungsseite sendet `Referrer-Policy: strict-origin` statt `no-referrer`. Der Browser übermittelt beim Beitritts-POST den eigenen Origin, sodass der CSRF-Check greift, und der Klartext-Token bleibt weiter aus dem Referer (R22).
- Bandänderungen im Django-Admin lösen ein `band.updated`-Ereignis aus. Offene Tabs erhalten den neuen Stand wie nach einem API-PATCH (R21).
- Die Registrierung per Einladung prüft das Passwort vor den Kontoabfragen. Schwache Passwörter verraten keine vorhandenen Benutzernamen oder E-Mail-Adressen (R6, R22).
- Ein herabgestufter Owner sieht in der Leseansicht die bestätigten Banddaten statt eines ungespeicherten Entwurfs (R21).
- Der Widerruf einer Einladung sperrt die Einladungszeile und liefert den frischen Nutzungsstand (R22).
- Der R2-Smoke startet mit einem frischen Compose-Projekt. Alte Datenbank-Volumes mit abweichendem Passwort blockieren den Lauf nicht mehr (R2).
- Der Vollabgleich liest Mitgliedschaft und Band im selben Snapshot. Ein paralleler Austritt liefert 404 statt vollständige Banddaten (R13, R21).
- Eine auf der Einladungsseite abgelaufene Session lädt die Vorschau anonym neu und zeigt einen verständlichen Hinweis (R22).
- Text- und Setlist-Ereignisse lösen keine Abrufe von Auftritten oder Mitgliedern mehr aus. Band- und Auftrittsansichten laden nur bei den passenden Ereignissen nach (R13, R18, R21).
- Einladungs-Tokens stehen in keinem Zugriffs- oder Fehlerlog. nginx schreibt das Zugriffslog in einem eigenen Format und ersetzt jedes Token-Segment in `/api/invitations/` und `/einladung/` (auch mit angehängten Satzzeichen oder Leerzeichen) durch `[token]`; Statuscodes wie 429, 502 und 504 bleiben sichtbar. Django leitet auch die Logger `django` und `django.server` über den redigierten Handler, inklusive DEBUG-Betrieb. Daphne startet ohne Zugriffslog (R22).
- Band-Einstellungen behalten Feldkonflikte auch nach weiteren Hintergrundänderungen an anderen Feldern, bis der Entwurf gespeichert oder verworfen wird (R21).
- Ein verspäteter Fehler oder eine verspätete Antwort der Start-Sitzungs- oder Bandlistenabfrage überschreibt einen bereits erfolgreichen Einladungsbeitritt nicht mehr; gleichzeitige Hintergrundabrufe behalten die Zielband des Beitritts bei (R4, R13, R22).
- Nach einem bestätigten eigenen Band-Austritt verschwindet die verlassene Band sofort aus Ansicht und Auswahl, auch bei fehlgeschlagenem Listenabruf und späterem Bandwechsel; eine inzwischen gewählte andere Band bleibt bei verspäteter Austrittsantwort unberührt (R13, R21).
- Ein 401 beim Löschen einer Anmerkung in der Leseansicht führt zurück zur Anmeldung (R4, R12).
- Anmeldung und Einladungsanmeldung prüfen bekannte, gesperrte und unbekannte Konten über denselben zentralen Argon2-Verifikationspfad ohne doppelten Hash-Aufwand; Benutzernamen werden einheitlich per NFKC normalisiert (auch in `manage.py band_owner_setzen`) (R6, R21, R22).
- Schlägt das Nachladen der Bandliste nach einer erfolgreichen Bandanlage fehl, bleibt die Anlage bestätigt und wiederholt nur den Listenabruf statt eine zweite Band zu erzeugen (R7, R21).
- Ein verspäteter Einladungsbeitritt überschreibt eine zwischenzeitliche Navigation nicht mehr; der Einladungswiderruf sperrt während des Aufrufs und blendet einen widerrufenen Einmal-Link aus (R18, R22).
- Einladungs-POST meldet bei ungültiger Eingabe nur noch das tatsächlich betroffene Feld; nginx redigiert im Zugriffslog zusätzlich Einladungs-Tokens im `Referer`-Header (R22).
- Parallele Gate-Schritte und `review-kilo.mjs` schließen `stdin`, damit Hintergrund-Reviews nicht an einer offenen Pipe hängen bleiben (R1).
- Der Schutz des letzten Band-Owners zählt nur aktive Konten. Für eine Betreiber-Sperre des letzten aktiven Owners setzt `manage.py band_owner_setzen <band_id> <username>` einen neuen aktiven Owner; im Django-Admin lassen sich keine Einladungen ohne gültigen Token anlegen (R21, R22).
- Der Widerruf einer Einladung sperrt nur die Einladungszeile. Ein gleichzeitiger Beitritt über eine andere Einladung derselben Band kann dadurch keinen Deadlock mehr auslösen (R22).
- Erstellung und Ablauf einer Einladung nutzen denselben Zeitpunkt. `expires_at` liegt exakt 48 Stunden nach dem gespeicherten `created_at` (R22).
- Band-Einstellungen sperren ihre Felder während des Speicherns. Eingaben während eines laufenden PATCH gehen nicht mehr verloren (R21).
- Der Entwurfsdialog zeigt Speicher- und Validierungsfehler direkt an, sperrt seine Aktionen während des Speicherns und ignoriert Escape bis zum Ende (R12, R19).
- Bandlisten-Abrufe tragen eine Laufkennung. Eine verspätete ältere Antwort kann eine entfernte Band nicht wieder in die Auswahl bringen (R4, R13, R21).
- Ein gleichzeitig entfernter oder herabgestufter Owner kann keine Einladung mehr erstellen oder widerrufen. Nebenläufigkeitstests belegen die erneute Rollenprüfung unter Zeilensperre (R21, R22).
- Der Django-Admin zeigt Mitgliedschaften nur lesend. Rollenwechsel, Entfernen und Sammellöschung laufen ausschließlich über die Fachdienste und können den letzten Owner nicht umgehen (R21).
- Ein bestätigter Rechteentzug räumt die betroffene Bandansicht sofort und blendet die Band aus. Die Bandliste lädt unabhängig davon neu, Transportfehler bleiben getrennt (R4, R13, R21).
- Band-Einstellungen senden nur berührte Felder per PATCH. Parallele Änderungen an unberührten Feldern bleiben erhalten; Konflikte am selben Feld werden benannt (R21).
- Der API-Adapter reicht strukturierte 400-Antworten weiter. Eine auf der Einladungsseite abgelaufene Session wird auch im echten HTTP-Pfad erkannt und lädt die Vorschau anonym neu (R4, R22).
- Ein entferntes oder ausgetretenes Mitglied verliert die Band sofort aus Liste und offener Ansicht. Der Client lädt nach einer Serverschließung die Bandliste neu und wählt eine sichtbare Band (R21).
- Speichern der Band-Einstellungen meldet keinen Fehler mehr, wenn nur die Listenaktualisierung scheitert. Der Listenfehler erscheint getrennt (R21).
- Ungespeicherte Band-Einstellungen bleiben bei Echtzeit-Updates erhalten. Ein Hinweis bietet den bewussten Wechsel auf den Serverstand an (R13, R21).
- Rollenwechsel prüft die Owner-Rolle nach der Zeilensperre erneut. Entfernte oder herabgestufte Owner können niemanden mehr befördern (R21).
- Der Widerruf einer Einladung nutzt denselben Owner-Throttle wie Liste und Erstellung (R22).
- Die Registrierung per Einladung lehnt ungültige Anzeigenamen mit 400 ab. Ohne Anzeigename kürzt sie den Benutzernamen auf 120 Zeichen statt mit 500 zu scheitern (R22).
- Banddaten, Rolle und Mitgliederliste laufen nach Speichern und Vollabgleich wieder zusammen. Die Ansicht übernimmt den frischen Sync-Stand statt alter Werte (R21).
- Einladungserstellung und Widerruf prüfen die Owner-Rolle erneut unter Zeilensperre. Ein gleichzeitig entfernter Owner kann keine Links mehr ausstellen oder sperren (R21, R22).
- Ein 401 beim Nachladen der Bandliste führt zur Anmeldung. Nach dem eigenen Austritt wird auch bei einem Listenfehler navigiert (R4, R21).
- Umbenennen oder Löschen einer Setlist lädt verknüpfte Auftritte und die Startseite neu. Gelöschte Links und alte Namen bleiben nicht stehen (R10, R13).
- Ein beim Beitritt ungültig gewordener Link zeigt die richtige Meldung. Eine abgelaufene Session bleibt auf der Einladungsseite sichtbar (R22).
- Speichern mit Randleerzeichen löst keine falsche Warnung vor einer Hintergrundänderung mehr aus (R21).
- Mitgliederliste und Einladungen laden getrennt. Hintergrundabgleiche unmounten die Mitgliederliste nicht, und eine Aktion löst keine doppelte Listenabfrage aus (R21, R22).
- Die Einladungsliste liest mit einem eigenen DRF-Throttle. Schreibaktionen blockieren das Nachladen nicht mehr (R22).
- Der Entwurfsdialog setzt den Fokus in den Dialog, hält die Tabulatornavigation dort und sperrt den Seitenhintergrund (R19).
- Löschbestätigung in der lesenden Anmerkungsansicht setzt sich bei jedem Anmerkungswechsel zurück und bietet Abbrechen an (R12, R19).
- Songsuche ohne Treffer zeigt eine sichtbare Meldung statt einer leeren Liste (R8, R18).
- Der Entwurfsdialog liegt als modale Überlagerung über der PDF-Ansicht und sperrt Verschieben, Auswahl und Zeichnen bis zur Entscheidung (R12, R19).
- Die Startseite übernimmt den nächsten Auftritt direkt aus dem Echtzeit-Abgleich und lädt bei Bandereignissen nach (R13, R18).
- Einheitliche Abstände zwischen PDF-Menüs und Aktionen. Songbearbeitung und mobile Bühnensteuerung halten auch beim Zeilenumbruch Abstand (R18).
- Marker und Text lassen sich wieder über vorhandenen Anmerkungen setzen. Im Werkzeugmodus öffnet der Klick keine Bearbeitung (R12).
- Der Fuß mit Urheber, Betreiber und Quellcode erscheint jetzt auch auf der Bühne und in der PDF-Ansicht (R20).
- Redis-Leerlauf beendet den Echtzeitabgleich nicht mehr nach fünf Sekunden. Abgebrochene WebSockets geben ihre Verbindungsplätze und Überwachung zuverlässig frei (R13).

### Changed

- `App.tsx` und die Einladungsansicht sind in Hooks und eigene Darstellungen aufgeteilt. Einladungs- und Verwaltungstests liegen in getrennten Dateien unter dem Strukturziel (R4, R13, R21, R22).
- Der automatisierte Diff-Prüflauf holt den Branch-Diff inklusive Working Tree in einem Durchgang statt doppelt.
- Band-Owner verwalten die Band-Einstellungen und das Umbenennen. Normale Mitglieder lesen die Daten und treten selbst aus. Bisher durfte jedes Mitglied umbenennen (R7, R21).
- Die Startseite nennt Genre und Ort/Proberaum und führt über "Band & Mitglieder" zur Verwaltung. Bandänderungen erscheinen ohne Neuladen (R21).
- Die Spezifikation zu Band-Verwaltung und Einladungen nennt jetzt Pflichtfelder, exakte Feldgrenzen, Teil-PATCH-Semantik, E-Mail-Schutz für alle Rollen, sofortigen Zugriffsverlust, Tokenform und exakte Laufzeit. Neue und erweiterte Tests belegen diese Fälle (R21, R22).
- Menüs und Setlist-Editor mit größeren Formularfeldern, klaren Aktionsgruppen und mehr Abstand. Lange Namen drängen Bühnen- und Löschaktionen nicht mehr zusammen (R18).
- Mobile Navigation und PDF-Werkzeuge kompakter dargestellt; vorhandenes Bandlogo integriert. Auf großen Bildschirmen stehen die PDF-Werkzeuge seitlich (R18).
- Startübersicht mit nächstem Auftritt, Song-Suche und einklappbare Formulare ergänzt (R18).
- Anmerkungen lassen sich durch Gedrückthalten verschieben. Griffe ändern Position und Größe, ohne Koordinatenfelder. Löschen verlangt eine Bestätigung (R19).
- Die mobilen Menü- und Abstandsprüfungen laufen im Voll-Gate und in der CI mit (R18).
- Changelog und Projektstatus nennen keine Review-Modelle, Anbieter oder
  internen Befunddateien mehr. Die Regel steht in `CONTRIBUTING.md`.

### Added

- Band-Einstellungen (R7, R21): Owner pflegen Name, Genre, Ort/Proberaum, Beschreibung und interne Band-Notiz. Mitglieder lesen alle Felder und die Mitgliederliste ohne E-Mail-Adressen.
- Mitgliederverwaltung (R21): Rollenwechsel, Entfernen und eigener Austritt. Der letzte Owner bleibt transaktional geschützt. Änderungen laufen über Echtzeit, Sync-Snapshot und Bandexport mit.
- Einladungslinks (R22): Owner erzeugen 48-Stunden-Links mit optionalem Hinweis und Nutzungslimit. Der Klartext-Token erscheint einmalig, gespeichert wird nur der SHA-256-Hash. Die öffentliche Beitrittsseite unterstützt neue und bestehende Konten, verlangt CSRF und läuft unter einem nginx-Rate-Limit.
- Fuß jeder Seite nennt Urheber und Betreiber und führt zum Quellcode im
  Repository, damit Fremde Fehler melden, mitarbeiten oder selbst hosten
  können. R20.
- Bandexport (R16): `GET /api/bands/<id>/export/` liefert ein ZIP mit
  `manifest.json`, Songs, Setlists, Auftritten, bandweiten und eigenen
  persönlichen Anmerkungen sowie allen PDF-Versionen. `EXPORT_MAX_BYTES`
  begrenzt das Archiv, bei Überschreitung folgt 413. Der Knopf im Bandkopf
  lädt die Datei über die eigene Origin.
- Release-Images (R17): Ein Tag `v*` baut `web` und `api` über GHCR und
  veröffentlicht volle Version, `major.minor` und Commit-Tag.
  `docker-compose.release.yml` zieht genau diese Images ohne lokalen Build.
- Mobil-Smoke für Auftritte, PDF und Bühne im Playwright-Profil `mobil`.
- Das erste Review-Gutachten liefert eine lokale CLI. Das Skript startet den
  Agenten als Terminal, wartet auf die Befunddatei und schreibt die Kopfzeilen
  HEAD, BASE und DIFF selbst. R1.
- `SUPPORT.md` nennt Meldeweg für Schwachstellen, Antwortzeiten, Art der
  Veröffentlichungen und die Grenze des Supports. `README.md` verweist darauf.
- Das Gate kennt `doku-sync` als eingebauten Schritt. Er läuft auch ohne lokale
  `harness/`-Konfiguration, also in einem frischen Clone. R2.


- Projektstruktur, Planung und Dokumentation für den Neubau.
- Bühnensitzung (R15): Pro Band läuft höchstens eine feste Sitzung mit
  Snapshot aus Setlist, Songmetadaten und aktiven PDF-Versionen. Eine
  Verbindung leitet, Teilnehmer folgen freiwillig, Übergabe, Owner-Übernahme,
  ausdrückliche Rückkehr und Ende sind serverseitig geprüft. Steuerbefehle
  laufen nummeriert und generationsgebunden über den Band-WebSocket. Die
  Bühnenansicht navigiert lokal, hält Zoom und Drehung je Gerät, zeigt
  bandweite Anmerkungen live und bereitet bis zu 128 MiB PDFs samt Seite 1
  vor. R15.
- Gemeinsame Setlist-Bearbeitung (R14): Setlists tragen eine Revision,
  Abschnitte und Einträge dauerhafte UUIDs. Einzelbefehle gleichen Strukturen
  idempotent ab, Textfelder führen Yjs-Zustände mit Epoche, und bandweite
  Anmerkungen darf jedes Mitglied bearbeiten. R14.
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

### Changed

- Erstgutachten und Zweitgutachten laufen getrennt und schreiben je eine
  eigene Befunddatei. R1.
- CI prüft zusätzlich R14 und R15 gegen echte Container (`verify-realtime.mjs`
  im Job `kern`). `scripts/verify-ci.mjs` verlangt beide Läufe und die
  Root-Abhängigkeiten. R5.
- Lastlauf-Verify `scripts/lib/verify-realtime/echtzeit.mjs` prüft den Median
  der Zustelllatenz je Band statt einer Einzelspitze. Ein Zweikern-CI-Runner
  hatte 1072 ms gegen die Grenze von 1000 ms gemessen, bei freier Maschine
  waren es 300 ms. Der Lastlauf legt 100 bestätigte Änderungen in rund
  10 Sekunden an; ein einzelner Wert über 4 Sekunden scheitert am Timeout.
  R13-G5 nennt Median je Band und Hängergrenze. R13.
- Gate führt gleiche Verify-Befehle nur einmal aus und nennt bei einem Fehler
  alle betroffenen R-Zeilen. R6 bis R12 teilen sich `verify-kern`, das läuft
  jetzt einmal statt siebenmal.
- Gate-Schritte mit `parallel: true` starten mit dem Gate und zählen an ihrer
  Stelle im Ablauf. Beide Reviews laufen dadurch parallel zum Verify.
- Zweiter Review-Durchgang mit eigener Befunddatei über `REVIEW_OUT`. Ein
  offener Blocker oder Major eines der beiden Gutachter stoppt den Push.


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
- Review-Basis an den Commit-Bereich gebunden: Ohne Upstream fällt der
  Stand-Vergleich auf `origin/main` beziehungsweise `main`
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

### Fixed

- PDF und Anmerkungen auf Mobilgeräten (R4, R11, R12): Die Werkzeugleiste
  hebt aktive Werkzeuge und Farben im dunklen Design klar hervor. Das Formular
  für neue oder gewählte Anmerkungen steht direkt über der PDF-Ansicht, zeigt
  eine Vorschau auf der Seite und rundet Koordinaten auf vier Stellen.
  Waagerechtes Fingerwischen und kurzes Antippen im Marker-Modus erzeugen
  gültige Markierungen, und das PDF-Canvas zeichnet bei Anmerkungsänderungen
  nicht mehr neu.
- Bandexport (R16): Fehlerpfade antworten auch bei `Accept: application/zip`
  mit JSON und den Status 401, 404 und 413 statt mit 500. Eine Bremse von
  6 Exporten je Minute und eine Größenprüfung vor dem Archivbau begrenzen
  Plattenplatz und Rechenzeit.
- Gemeinsame Bearbeitung (R14): Verwirft die gepufferte Textmap einen Eintrag
  wegen der 128er-Grenze, lädt der Editor den Serverstand nach. Ein offenes
  Feld bleibt damit nicht auf einem überholten Text stehen.
- CI (R5): Der Kern-Job ruft die Frontend-Tests nicht erneut auf, weil der
  Frontend-Job sie schon ausführt. `VERIFY_SKIP_FRONTEND=1` steuert das.
- Bandexport (R16): `EXPORT_MAX_BYTES=0` schaltet die Grenze wie dokumentiert
  ab, statt jeden Export mit 413 zu beenden. Der Download-Dateiname behält
  Umlaute im `filename*`-Teil. Ein Abbruch beim Lesen des ZIP-Körpers gilt als
  Netzwerkfehler. Der Exportknopf wird beim Bandwechsel neu aufgebaut und
  verwirft späte Antworten.
- Review (R1): Die Standard-Befunddateien passen zur Doku. Jeder Gutachter
  schreibt ohne `REVIEW_OUT` in seine eigene Datei.
- Release (R17): Die Docker-Actions im Release-Workflow sind auf Commits
  gepinnt; `scripts/verify-release.mjs` verlangt die Pin-Form.
- Gemeinsame Bearbeitung (R14): Die Map der eingehenden Textupdates ist auf
  128 Einträge begrenzt und wird bei Bandwechsel und vollständigem Abgleich
  geleert. Vorher hielt die App-Wurzel jeden base64-Vollzustand bis zum
  Neustart.
- Bühnensitzung (R15): `steuere` bindet die Sitzung an die Band der
  Verbindung. Ein Mitglied zweier Bands kann mit einer Verbindung von Band A
  keine Sitzung von Band B ansprechen; der Aufruf endet wie im REST-Weg mit
  404.
- Gemeinsame Bearbeitung (R14): Der Befehlspfad hält dieselben Mengengrenzen
  wie der Gesamt-PUT, 50 Abschnitte und 200 Einträge je Abschnitt. Beide Wege
  lesen die Grenzen aus `setlists/content.py`. Vorher nahm ein Befehl mehr an,
  als der PUT danach wieder speichern konnte.
- Gemeinsame Bearbeitung (R14): Auch das Verschieben eines Eintrags prüft die
  Menge des Zielabschnitts. Vorher konnte ein Abschnitt über 200 Einträge
  sammeln, und danach scheiterte jeder Gesamt-PUT des Editors.
- Gate: Scheitert `git ls-files`, enden `lint-file-size` und
  `review-constraints` mit Fehler statt mit grün.
- Gemeinsame Bearbeitung (R14): Kennungen im Befehlspfad werden normalisiert.
  Eine ungeformte UUID ergab bisher 500, jetzt 400. Das gilt auch für den
  Nachbarvergleich beim Einfügen.
- Gate: `lint-file-size` und `review-constraints` lesen ihre Dateiliste über
  `git ls-files --cached --others --exclude-standard`. Werkzeugausgaben
  lokaler Agenten wie `graphify-out/` halten das Gate nicht mehr rot.
- Aufbewahrung räumt neben veröffentlichten Ereignissen auch das
  Befehlsprotokoll und geschlossene Bühnenverbindungen ab. Textstände,
  Löschmarken und Setlisten bleiben unberührt. R14, R15.
- Nach einer Leitungsübergabe darf die neue Leitung nach einem
  Verbindungsverlust zurückkehren. Das Sperrmerkmal `leadership_locked` ist
  entfallen, die Prüfung auf die Leitung genügt. R15.
- Ein PATCH auf eine Setlist mit einem Nicht-Objekt als JSON antwortet mit 400
  statt mit 500. Die Textnutzlast ist schon im Serialisierer auf 90 000 Zeichen
  begrenzt. R14.
- Der Bühnenhinweis erkennt die Serverbegründungen unabhängig von der
  Groß- und Kleinschreibung. Vorher blieb „Die Leitungsgeneration ist veraltet"
  ohne Nachladen. R15.


- Gemeinsame Bearbeitung (R14): Beide Schreibwege legen denselben Text in die
  Spalte. Der Textweg trimmt jetzt wie der REST-Weg; ein Randleerzeichen löst
  keinen Epochenwechsel mehr aus, der die Zusammenführung aller Teilnehmer
  verwirft.
- Gemeinsame Bearbeitung (R14): Textpfad und Gesamt-PUT sperren in derselben
  Reihenfolge, Strukturzeile vor TextState. Die umgekehrte Reihenfolge konnte
  auf Abschnitts- und Eintragsnamen einen Deadlock auslösen. R14.
- Echtzeit (R14, R15): Befehle über den Band-WebSocket unterliegen einer
  Mengenbremse wie Textupdates. Abgelehnte Befehle erzeugen weder
  Protokollzeile noch Ereignis und erreichen die Sitzungssperre nicht.
- Echtzeit (R13, R14): Der gespeicherte CRDT-Zustand je Feld ist auf 512 KiB
  begrenzt; ein Update, das darüber hinausgeht, wird abgewiesen. Die
  Ereignisse `text.updated` und `annotation.text` tragen weiter den
  Vollzustand, weil das Frontend den bestätigten Stand damit vergleicht.
- Gemeinsame Bearbeitung (R14): `text_ersetzen` baut den Zustand neu auf,
  statt den alten mit Grabsteinen zu leeren. Damit wächst der Zustand bei
  wiederholtem REST-Ersatz nicht mehr und die Größe bleibt geprüft. R14.
- Gemeinsame Bearbeitung (R14): Eine bestätigte Textänderung erhöht die
  Revision der Setlist. Ein veralteter Gesamt-PUT läuft dadurch in 409 und
  kann den bestätigten Text nicht über einen Epochenwechsel ersetzen. Die
  REST-Revision einer Anmerkung bleibt für Geometrie und Sichtbarkeit stabil.
  Alle Textwege sperren in der Reihenfolge des Gesamt-PUTs: Setlist,
  Strukturzeile, TextState. R14.
- Bühne (R15): Die Verbindungsfrische wird zusätzlich serverseitig im Takt
  der Rechteprüfung erneuert. Ein gedrosselter Browser-Tab verliert die
  Leitung damit nicht mehr nach 60 Sekunden ohne Ping. R15.
- Gemeinsame Bearbeitung (R14): Auch der REST-Befehlsendpunkt hat eine
  Mengenbremse (120 je Minute und Benutzer) und dieselbe 16-KiB-Grenze für
  Nutzdaten wie der WebSocket-Weg. R14.
- Gemeinsame Bearbeitung (R14): Ein PATCH auf den Setlist-Namen verlangt die
  Revision, auf der er beruht: ohne Revision 400, bei Abweichung 409. Ein
  veralteter Name überschreibt damit keinen bestätigten Text mehr. R14.
- Gemeinsame Bearbeitung (R14): Die Textenden für Setlist und Anmerkung haben
  eine Schreibbremse von 300 Anfragen je Minute und Benutzer, analog zur
  WebSocket-Bremse. R14.
- Gemeinsame Bearbeitung (R14): Beim Löschen einer Setlist werden ihre
  UUIDs als gelöscht vermerkt. Ein späterer Abschnitt oder Eintrag mit
  derselben UUID erbt damit keinen alten Textstand mehr. R14-N2.
- Gemeinsame Bearbeitung (R14): Auch ein geänderter Setlist-Name erhöht die
  Revision, ein veralteter Gesamt-PUT läuft dadurch in 409 statt den Namen
  still zu überschreiben. R14.
- Gemeinsame Bearbeitung (R14): Wird die Setlist, ein Abschnitt oder ein
  Eintrag im selben Moment gelöscht, antworten Text- und Befehlspfad
  kontrolliert mit 409 beziehungsweise 400, statt mit 500 abzubrechen. Die
  WebSocket-Verbindung bleibt erhalten. Befehlsnutzdaten sind auf 16 KiB
  begrenzt. R14.
- Gemeinsame Bearbeitung (R14): Der Editor prüft den bestätigten Stand über
  den Textinhalt statt über kodierte Bytes. yjs im Browser und Yrs auf dem
  Server kodieren dasselbe Dokument nicht zwingend gleich; gleicher Inhalt
  löste vorher weitere Sendevorgänge aus. R14.


- Song-PDF: Die Vorwahl der Version läuft im selben Durchlauf wie das
  Dokument, und eine bereits getroffene Auswahl bleibt stehen. Vorher
  ersetzte ein später Effekt die Versionsknöpfe, ein Klick in diesem Moment
  ging verloren. R11.
- Browser-Smoke: Das Anmelden im E2E-Test wartet, bis Anmeldeformular oder
  Band-Auswahl sichtbar ist, statt einmalig zu prüfen. Auf langsamen Runnern
  wurde die Anmeldung sonst übersprungen. R11, R12.
- Setlist-Editor: Ein spät eintreffendes Detail überschreibt keinen neu
  angelegten Abschnitt mehr. Nach dem Anlegen kommt das Detail aus der
  Antwort, statt es erneut zu laden. R9.
- Drittreview R13: Entfernte Auftritte und Setlists bleiben im offenen
  Formular als gelöscht markiert, der Entwurf bleibt erhalten und das
  Speichern ist gesperrt; vergangene Auftritte behalten dabei ihre Gruppe.
  Der WebSocket begrenzt Verbindungen je Konto und Band sowie die
  Ping-Frequenz. Das Relay liest den Ausgangspuffer alle 200 Millisekunden,
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
