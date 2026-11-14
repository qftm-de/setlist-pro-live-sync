<!-- Generiert aus harness/ – dort ändern, dann: node scripts/harness.mjs render -->

# Entscheidungen

Kurze, geltende Beschlüsse. Eine Zeile, plus warum. Veraltetes streichen.

## Stack

- Single-File React PWA (Tailwind, kein Build) / HTML/JavaScript

## Prozess

- Anforderungen vor Code. Verify schreibt `State`, nicht der Agent.
- Reviewer ändert keinen Anwendungscode.
- Git-Schreibaktionen nur der Mensch.
- Sicherheits-Baseline: `scripts/review-constraints.mjs` läuft im Gate und blockt Secrets, Zugangsdaten, private IPs, eingebettete Dateien und unsichere Code-Muster (innerHTML, eval, csrf_exempt, DEBUG, verify=False, shell=True, Token im localStorage). Ein Treffer ist ein Stopp, kein Hinweis.
- Keine echten Daten im Repo: keine Bandcodes, Projekt-IDs, API-Keys, Nutzernamen oder Server-Adressen in Dateien, Docs und Tests. Das Projekt ist privat und soll offen werden.
