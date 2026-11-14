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
   |  Das Konto hat eine eindeutige E-Mail und einen Anzeigenamen. Anmeldung und Abmeldung verlangen ein CSRF-Token,
   |  falsche Zugangsdaten antworten ohne Hinweis auf vorhandene Konten, und ohne Session bleibt jeder geschützte Aufruf bei 401.
   |  Es gibt keine öffentliche Registrierung; der erste Betreiber wird per Kommando angelegt.
   | Verify:  node scripts/verify-kern.mjs
   | Scope:   backend/accounts, backend/api/session.py, backend/api/test_session.py, backend/api/urls.py, backend/core/settings.py, backend/core/urls.py, frontend/src/session, frontend/src/ui/AnmeldeFormular.tsx, frontend/src/App.tsx, frontend/src/api/client.ts, docker-compose.yml, frontend/nginx.conf, scripts/verify-kern.mjs
   | Risk:    hoch
   | Cases:   R6-P: Anmeldung mit gültigem Konto setzt Session, /api/session/ liefert Anzeigenamen, Abmeldung beendet sie; R6-N: falsches Passwort 400 ohne Konto-Hinweis, Anmeldung ohne CSRF-Token 403, geschützte Aufrufe ohne Session 401, Nutzernamen werden nicht durch zeitgleiche Anmeldung getauscht; R6-G: Session-Cookie HttpOnly und SameSite, Passwort wird als Argon2-Hash gespeichert, Anmeldung bei gesperrtem Konto scheitert.
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
