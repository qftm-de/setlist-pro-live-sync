<!-- Generiert aus harness/ – dort ändern, dann: node scripts/harness.mjs render -->

# Entscheidungen

Kurze, geltende Beschlüsse. Eine Zeile, plus warum. Veraltetes streichen.

## Stack

- React/TypeScript/Vite, Django REST Framework, PostgreSQL, Redis/Channels / TypeScript/Python / kein Firebase mehr. Firebase braucht externe Kontrolle, der Core soll autark laufen.
- Zwei Betriebsmodi: core selbst gehostet und autark, hub zentral mit Community. Der Core darf nicht vom Hub abhängen, sonst koppelt jede Band an einen fremden Dienst.
- Auslieferung als Docker-Images über GHCR, kein Netlify, kein externes Hosting. Selbst hosten soll einfacher bleiben als ein Anbieter-Login.

## Konten

- Core-Anmeldung ohne allauth: eigene Kontoentität `accounts.User` (E-Mail eindeutig, Anzeigename), Django-Session, Anmeldung und Abmeldung als Django-Views mit CSRF. Grund: Der Core braucht nur lokale Anmeldung. Registrierung und E-Mail-Verifikation gehören zum Hub und kommen mit ihm.

- Setlist-Inhalt wird als Ganzes per `PUT .../content/` ersetzt, nicht über sechs Einzel-Endpunkte. Grund: atomar, keine halb umsortierten Listen, und der Client hat den vollständigen Stand.

## Lizenz

- AGPL-3.0. Liegt bei als `LICENSE`, README und CONTRIBUTING nennen sie. Copyleft schützt, dass Hub-Betreiber den Quelltext offenlegen müssen.

## Prozess

- Anforderungen vor Code. Verify schreibt `State`, nicht der Agent.
- Review-Schiene immer: vor Push oder Merge Request läuft ein Review zum aktuellen Stand. Reviewer ändert keinen Code. Mit lokaler Harness-Konfiguration ruft das Voll-Gate den Kilo-Review-Agenten automatisch auf (`scripts/review-kilo.mjs`), sobald die Befunddatei nicht zum Stand passt. Ohne Harness verlangt `review-stand` eine aktuelle Befunddatei. Offene Blocker oder Major stoppen den Push.
- Versionierung nach SemVer, CHANGELOG nach Keep a Changelog. Jeder Release bekommt einen Version-Bump und einen CHANGELOG-Eintrag.
- Git-Schreibaktionen nur der Mensch.
- Gate-Skripte sind versioniert, einschließlich des Renderers `scripts/harness.mjs`. Harness, `AGENTS.md`, `kilo.jsonc` und die Agentenordner bleiben lokal und unversioniert. Grund: Das Gate muss in jedem Clone laufen; die Agentenkonfiguration ist maschinenbezogen. Ein frischer Clone nutzt die eingebauten Gate-Schritte.
- Review-Basis ist der Commit-Bereich (Upstream, sonst origin/main, sonst main) plus Working Tree. Grund: Committete Arbeit darf nicht unbemerkt am Review vorbei laufen.
- CI führt Requirements-Gate, Security-Baseline, Datei-Größen und Gitleaks als technische Schranke vor der Integration. Grund: Lokale Regeln gelten für alle, nur wenn sie in CI verlangt werden.
- Datei-Größen begrenzt: Code 300 Ziel/500 hart, Doku 500 Ziel/1000 hart, geprüft mit `lint-file-size` im Gate und in CI. Grund: Ausufernde Dateien brechen Review, Navigation und Merge-Konflikte. Generierte und normative Dateien sind exempt.
- Sicherheits-Baseline: `scripts/review-constraints.mjs` läuft im Gate und blockt Secrets, Zugangsdaten, private IPs, eingebettete Dateien und unsichere Code-Muster (innerHTML, eval, csrf_exempt, DEBUG, verify=False, shell=True, Token im localStorage). Ein Treffer ist ein Stopp, kein Hinweis. Gitleaks ergänzt als etablierter Secret-Scanner.
- Keine echten Daten im Repo: keine Bandcodes, Projekt-IDs, API-Keys, Nutzernamen oder Server-Adressen in Dateien, Docs und Tests. Das Projekt ist privat und soll offen werden.
