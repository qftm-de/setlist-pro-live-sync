# Anforderungen

R1 | Behavior: Repo-Grundausstattung und Agent-Harness stehen, der Brownfield-Bestand liegt unverändert unter alte_projektdatein/.
   | Verify:  node scripts/gate.mjs --list
   | Scope:   docs/templates, scripts, alte_projektdatein, README.md, LICENSE, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, CHANGELOG.md, .github, .editorconfig, .gitattributes
   | Risk:    niedrig
   | State:   passing

R2 | Behavior: Das Gerüst steht. `docker compose up` startet im Modus core die Dienste
   |  Frontend, API, PostgreSQL und Redis, die API antwortet auf einen Health-Abruf.
   |  Die CI baut bei jedem Push Frontend und Backend und läuft die Tests.
   | Verify:  node scripts/geruest-smoke.mjs && cd frontend && npm test && npm run build
   | Scope:   backend, frontend, docker-compose.yml, .github/workflows
   | Risk:    mittel
   | State:   passing
