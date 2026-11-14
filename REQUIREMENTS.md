# Anforderungen

R1 | Behavior: Repo-Grundausstattung und Agent-Harness stehen und sind versioniert. Ein frischer Clone führt das Gate aus. Der Brownfield-Bestand liegt unverändert und unversioniert unter alte_projektdatein/.
   | Verify:  node scripts/check-repo.mjs
   | Scope:   docs/templates, docs/conventions.md, scripts, harness, .githooks, .kilo, .agents, alte_projektdatein, README.md, LICENSE, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, CHANGELOG.md, .github, .editorconfig, .gitattributes, package.json, package-lock.json
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
   |  die React-Hülle zeigt Laden, Fehler, Entwurf, Speichern und bestätigte Speicherung getrennt und wechselt Bands ohne Datenreste.
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
