# Anforderungen

R1 | Behavior: Repo-Grundausstattung und Gate-Skripte stehen und sind versioniert. Ein frischer Clone führt das Gate mit den eingebauten Schritten aus. Agenten-, Harness- und Kilo-Dateien bleiben lokal und unversioniert; versioniert sind nur die Gate-Skripte einschließlich `scripts/harness.mjs`. Der Brownfield-Bestand liegt unverändert und unversioniert unter alte_projektdatein/.
   | Verify:  node scripts/check-repo.mjs
   | Scope:   docs/templates, docs/conventions.md, scripts, .githooks, alte_projektdatein, README.md, LICENSE, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, CHANGELOG.md, .github, .editorconfig, .gitattributes, package.json, package-lock.json
   | Risk:    niedrig
   | State:   passing

R2 | Behavior: Das Gerüst steht. `docker compose up` startet im Modus core die Dienste
   |  Frontend, API, PostgreSQL und Redis, die API antwortet auf einen Health-Abruf.
   |  Die CI baut bei jedem Push Frontend und Backend und läuft die Tests.
   | Verify:  node scripts/geruest-smoke.mjs && cd frontend && npm test && npm run build
   | Scope:   backend/manage.py, backend/core/__init__.py, backend/core/asgi.py, backend/core/wsgi.py, backend/.dockerignore, frontend/src/vite-env.d.ts, frontend/.dockerignore, frontend/tsconfig.json, docker-compose.yml, .github/workflows, docs/planung/versionen.md
   | Risk:    mittel
   | State:   passing

R3 | Behavior: Der Core startet nur mit explizitem Modus core, festem Secret-Key und PostgreSQL.
   |  `/api/config/` liefert zur Laufzeit nur Modus, Instanzname und validierten optionalen Community-Link.
   |  Health prüft die Datenbank, DRF verlangt standardmäßig Anmeldung, Cookies, CSRF und Proxy-Vertrauen sind abgesichert.
   | Verify:  node scripts/verify-foundation.mjs
   | Scope:   backend/core/config.py, backend/core/settings.py, backend/core/urls.py, backend/api/authentication.py, backend/api/views.py, backend/api/urls.py, backend/api/tests.py, backend/api/test_config.py, backend/requirements.txt, backend/Dockerfile, backend/.env.example, docker-compose.yml, scripts/verify-foundation.mjs
   | Risk:    hoch
   | Cases:   R3-P: Core-Modus mit festem Key und PostgreSQL startet, /api/config/ und Health antworten; R3-N: fehlender Modus, hub, fehlender Key, fehlende DB und anonyme geschützte Zugriffe scheitern; R3-G: Key bleibt bei Neustart, Secure-Cookies nur bei vertrauenswürdigem Proxy, CSRF blockt fremde Origin, Antworten enthalten keine Secrets
   | State:   passing

R4 | Behavior: Browser, API und spätere WebSockets laufen unter einer Origin. Der nginx-Proxy liefert API und SPA-Fallback,
   |  die React-Hülle zeigt Laden und Fehler getrennt, führt bei abgelaufener Session aus jedem Formular zurück zur Anmeldung,
   |  zeigt am Songformular den Speicherzustand von Entwurf bis bestätigter Speicherung und wechselt Bands ohne Datenreste.
   |  Ohne Session erscheint die Anmeldung, API-Fehler bleiben ohne interne Details sichtbar.
   | Verify:  node scripts/verify-ui-foundation.mjs
   | Scope:   frontend/src, frontend/index.html, frontend/vite.config.ts, frontend/Dockerfile, frontend/nginx.conf, frontend/package.json, frontend/package-lock.json, frontend/tsconfig.json, scripts/verify-ui-foundation.mjs
   | Risk:    hoch
   | Cases:   R4-P: gleiche Origin, Deep-Link liefert App, Zustände unterscheidbar, Bandwechsel zeigt nur gewählte Band; R4-N: ohne Session keine geschützten Inhalte, vorige Banddaten verschwinden sofort, späte Antworten erscheinen nicht, API-Ausfall zeigt Fehler; R4-G: 401 führt zur Anmeldung, 403 zeigt fehlende Berechtigung, 500 wiederholbar ohne interne Details, langsame Antwort/fehlgeschlagenes Speichern/Verbindungsverlust getrennt, keine externen Schriften oder Hub-Anfragen
   | State:   passing

R5 | Behavior: Die versionierte CI prüft vor Integration Requirements und Sicherheit,
   |  baut das Frontend mit Typprüfung und Tests und testet das Backend gegen PostgreSQL im Dienstcontainer.
   |  CI-Ausfälle sind echte Fehler und werden nicht als erfolgreich markiert.
   | Verify:  node scripts/verify-ci.mjs
   | Scope:   .github/workflows, scripts/verify-ci.mjs
   | Risk:    mittel
   | State:   passing

R6 | Behavior: Im Core melden sich lokale Konten mit Benutzername und Passwort an einer Session an und wieder ab.
   |  Das Konto hat eine eindeutige, nicht leere E-Mail und einen Anzeigenamen. Anmeldung und Abmeldung verlangen ein CSRF-Token,
   |  falsche Zugangsdaten antworten ohne Hinweis auf vorhandene Konten, und ohne Session bleibt jeder geschützte Aufruf bei 401.
   |  Es gibt keine öffentliche Registrierung; der erste Betreiber wird per Kommando angelegt.
   | Verify:  node scripts/verify-kern.mjs
   | Scope:   backend/accounts, backend/api/session.py, backend/api/test_session.py, backend/api/urls.py, backend/core/settings.py, backend/core/urls.py, frontend/src/session, frontend/src/ui/AnmeldeFormular.tsx, frontend/src/App.tsx, frontend/src/api/client.ts, docker-compose.yml, frontend/nginx.conf, scripts/verify-kern.mjs
   | Risk:    hoch
   | Cases:   R6-P: Anmeldung mit gültigem Konto setzt Session, /api/session/ liefert Anzeigenamen, Abmeldung beendet sie; R6-N: falsches Passwort 400 ohne Konto-Hinweis, Anmeldung ohne CSRF-Token 403, geschützte Aufrufe ohne Session 401, Nutzernamen werden nicht durch zeitgleiche Anmeldung getauscht; R6-G: Session-Cookie HttpOnly und SameSite, Passwort wird als Argon2-Hash gespeichert, Anmeldung bei gesperrtem Konto scheitert, ein Konto ohne E-Mail wird von der Datenbank abgelehnt.
   | State:   passing

R7 | Behavior: Angemeldete Nutzer legen Bands an und sehen ausschließlich Bands, in denen sie Mitglied sind.
   |  Der Ersteller wird Owner. Mitglieder benennen die Band um. Ein Band-Detail liefert Name und Songliste in einer Antwort.
   |  Fremde Bands antworten mit 404, nicht mit 403, damit die Existenz nicht durchsickert.
   | Verify:  node scripts/verify-kern.mjs
   | Scope:   backend/bands, backend/api/bands.py, backend/api/test_bands.py, backend/api/serializers.py, backend/api/urls.py, frontend/src/bands, frontend/src/App.tsx, frontend/src/ui/BandFormular.tsx, scripts/verify-kern.mjs
   | Risk:    hoch
   | Cases:   R7-P: Band anlegen macht den Ersteller zum Owner, Liste zeigt nur eigene Bands, Detail enthält Name und Songs; R7-N: Fremdband liefert 404, anonyme Aufrufe 401, leerer oder überlanger Name wird abgelehnt; R7-G: zwei Nutzer sehen getrennte Listen, Owner bleibt nach Neustart erhalten.
   | State:   passing

R8 | Behavior: Songs hängen an einer Band. Mitglieder legen Songs mit Titel, Interpret, Tonart, BPM und Notiz an,
   |  ändern und löschen sie. Titel ist Pflicht, BPM liegt zwischen 20 und 400, die Notiz steht im Anlege- und im
   |  Änderungsformular. Nach dem Anlegen erscheint der Song in der Bandliste der Antwort ohne Neuladen der Seite.
   | Verify:  node scripts/verify-kern.mjs
   | Scope:   backend/library, backend/api/songs.py, backend/api/test_songs.py, backend/api/serializers.py, backend/api/urls.py, frontend/src/bands, frontend/src/ui/Songs.tsx, frontend/src/ui/SongZeile.tsx, scripts/verify-kern.mjs
   | Risk:    mittel
   | Cases:   R8-P: Anlegen, Ändern und Löschen eines Songs als Mitglied wirkt auf die Bandliste; R8-N: leerer Titel und BPM außerhalb der Grenzen werden abgelehnt, Song einer Fremdband liefert 404; R8-G: Reihenfolge bleibt nach Änderung stabil, Songs einer gelöschten Band sind nicht erreichbar.
   | State:   passing

R9 | Behavior: Bands führen Setlists mit Abschnitten (Set, Pause, Zugabe) und Einträgen (Song, Pause, Notiz).
   |  Ein Eintrag ist ein Song derselben Band, eine Pause oder eine freie Notiz; doppelte Songs sind erlaubt.
   |  Der Inhalt wird als Ganzes in einer Transaktion gespeichert, Positionen folgen der Reihenfolge der Eingabe.
   |  Ein Song, der in einer Setlist steht, lässt sich nicht löschen, bevor er dort entfernt wurde.
   | Verify:  node scripts/verify-kern.mjs
   | Scope:   backend/setlists, backend/api/setlists.py, backend/api/test_setlists.py, backend/api/serializers.py, backend/api/songs.py, backend/api/urls.py, frontend/src/setlists, frontend/src/ui/Setlists.tsx, frontend/src/ui/SetlistEditor.tsx, frontend/src/App.tsx, scripts/verify-kern.mjs
   | Risk:    hoch
   | Cases:   R9-P: Setlist anlegen, Abschnitte und Einträge speichern und wieder lesen, Positionen 1..n je Ebene, doppelter Song erlaubt; R9-N: fremde Band 404, Song aus fremder Band 400, unbekannte Abschnittsart 400, leerer Inhalt 400, Song löschen mit Setlist-Eintrag 400, fehlerhafter Inhalt lässt alten Inhalt unverändert; R9-G: Reihenfolge bleibt nach dem Umsortieren stabil, Ersetzen läuft atomar, Pausen ohne Song werden mit Bezeichnung gespeichert.
   | State:   passing

R10 | Behavior: Mitglieder verwalten bandgebundene Auftritte mit Pflicht-Titel und Pflicht-Datum sowie optionaler Uhrzeit, Ort, Notiz und Setlist derselben Band.
   |  Die API liefert Kommend und Vergangen serverseitig gruppiert; die UI zeigt beide Gruppen und erlaubt vollständige Pflege.
   |  Fremde Bands und fremde Auftrittsobjekte liefern 404; unbekannte und bandfremde Setlist-Referenzen liefern dieselbe Feldfehlermeldung mit 400.
   |  Setlist-Löschung erhält den Auftritt und setzt dessen Verknüpfung auf null. Ein Direktlink öffnet genau die verknüpfte Setlist.
   | Verify:  node scripts/verify-kern.mjs
   | Scope:   backend/gigs, backend/api/gigs.py, backend/api/gig_serializers.py, backend/api/test_gigs.py, backend/api/test_gigs_basis.py, backend/api/test_gigs_gruppierung.py, backend/api/test_gigs_race.py, backend/api/urls.py, backend/core/settings.py, frontend/src/gigs, frontend/src/routing.ts, frontend/src/bands/useAktiveBand.ts, frontend/src/ui/Auftritte.tsx, frontend/src/ui/AuftrittFormular.tsx, frontend/src/ui/AuftrittZeile.tsx, frontend/src/ui/AppShell.tsx, frontend/src/ui/Setlists.tsx, frontend/src/App.tsx, frontend/src/App.gigs.test.tsx, frontend/src/App.gigs-fehler.test.tsx, frontend/src/App.setlists.test.tsx, frontend/src/App.setlists-direktlink.test.tsx, scripts/verify-kern.mjs, scripts/lib/verify-gigs.mjs
   | Risk:    hoch
   | Cases:   R10-P: Mitglied legt Auftritt mit allen Feldern und eigener Setlist an, liest, ändert, entfernt die Verknüpfung und löscht; einfaches Mitglied ohne Owner-Rolle darf dasselbe; doppelte Titel und Auftritte ohne optionale Felder sind erlaubt; gültiger PATCH nur mit Titel erhält Uhrzeit und Setlist-Verknüpfung, explizites null entfernt jeweils das Feld; R10-N: anonyme Zugriffe 401, fremde Band und fremder Auftritt unter falscher Band für alle Methoden 404, Schreiben ohne CSRF 403; leere, überlange oder nur aus Leerzeichen bestehende Titel, ungültige Daten und Uhrzeiten, zu lange Orte und Notizen sowie unbekannte und bandfremde Setlists liefern 400; unbekannte und bandfremde setlist_id liefern bei POST und PATCH denselben Feldfehler samt Text; ungültiger PATCH erhält den alten Datensatz vollständig, Bandzuordnung lässt sich nicht per Request verschieben; R10-G: Titel und Ort mit genau 200 Zeichen sowie Notiz mit genau 10.000 Zeichen werden akzeptiert, je ein Zeichen mehr abgelehnt; eingefrorenes Berliner Heute mit gestern, heute und morgen ordnet heute unabhängig von der Uhrzeit als kommend ein; mehrere Tage je Gruppe sortieren kommend aufsteigend und vergangen absteigend nach Datum; gleiche Tage sortieren nach Uhrzeit aufsteigend mit unbekannter Uhrzeit zuletzt und danach nach ID, leere Gruppen bleiben Arrays, Jahreswechsel und Sommerzeitumstellungen in Europe/Berlin nutzen den echten timezone.localdate()-Pfad und nicht das Browserdatum; referenzierte Setlist zeigt nach Änderung den aktuellen Namen, Löschung erhält alle anderen Auftrittsfelder mit null-Verknüpfung, parallele Löschung endet als 400; Frontend zeigt Gruppen, Leerzustand, Anlegen, Bearbeiten, bestätigtes und abgebrochenes Löschen sowie optionale Setlist-Auswahl; Band ohne Setlists zeigt nur Ohne Setlist und legt mit setlist_id null an; scheitert beim Bearbeiten das Laden der Setlist-Auswahl, bleibt der Fehler sichtbar, die Auswahl gesperrt und die Verknüpfung unverändert, ein Ladefehler erzeugt niemals null; scheitert nach erfolgreichem POST das GET, bleiben bestätigte Speicherung und fehlender Listenabgleich getrennt sichtbar, Wiederholen lädt nur die Liste und erzeugt keinen zweiten Auftritt; Direktlink lädt genau die angegebene Setlist inklusive Neuladen, meldet fehlende Band oder gelöschte Setlist, funktioniert mit Zurück und wechselt bei manuellem Bandwechsel auf /setlists; Lade- und Schreibfehler, Entwurfserhalt, 401 und verspätete Antworten nach Bandwechsel werden geprüft, Darstellung auf Mobil und Desktop wird geprüft oder offen dokumentiert.
   | State:   passing
