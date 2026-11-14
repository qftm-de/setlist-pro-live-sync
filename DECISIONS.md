<!-- Generiert aus harness/ – dort ändern, dann: node scripts/harness.mjs render -->

# Entscheidungen

Kurze, geltende Beschlüsse. Eine Zeile, plus warum. Veraltetes streichen.

## Stack

- React/TypeScript/Vite, Django REST Framework, PostgreSQL, Redis/Channels / TypeScript/Python / kein Firebase mehr. Firebase braucht externe Kontrolle, der Core soll autark laufen.
- Zwei Betriebsmodi: core selbst gehostet und autark, hub zentral mit Community. Der Core darf nicht vom Hub abhängen, sonst koppelt jede Band an einen fremden Dienst.
- Auslieferung als Docker-Images über GHCR, kein Netlify, kein externes Hosting. Selbst hosten soll einfacher bleiben als ein Anbieter-Login.

## Lizenz

- AGPL-3.0. Liegt bei als `LICENSE`, README und CONTRIBUTING nennen sie. Copyleft schützt, dass Hub-Betreiber den Quelltext offenlegen müssen.

## Prozess

- Anforderungen vor Code. Verify schreibt `State`, nicht der Agent.
- Review-Schiene immer: vor Push oder Merge Request läuft ein Review zum aktuellen Stand. Reviewer ändert keinen Code.
- Versionierung nach SemVer, CHANGELOG nach Keep a Changelog. Jeder Release bekommt einen Version-Bump und einen CHANGELOG-Eintrag.
- Git-Schreibaktionen nur der Mensch.
- Sicherheits-Baseline: `scripts/review-constraints.mjs` läuft im Gate und blockt Secrets, Zugangsdaten, private IPs, eingebettete Dateien und unsichere Code-Muster (innerHTML, eval, csrf_exempt, DEBUG, verify=False, shell=True, Token im localStorage). Ein Treffer ist ein Stopp, kein Hinweis.
- Keine echten Daten im Repo: keine Bandcodes, Projekt-IDs, API-Keys, Nutzernamen oder Server-Adressen in Dateien, Docs und Tests. Das Projekt ist privat und soll offen werden.
