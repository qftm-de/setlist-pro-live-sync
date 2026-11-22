<!-- Generiert aus harness/ – dort ändern, dann: node scripts/harness.mjs render -->

# Konventionen

Diese Datei wiederholt die Agent-Regeln nicht. Sie nennt, was der Agent erbt und was zusätzlich gilt.

## Scope und Änderungen

- Eine Aufgabe, ein Subsystem. Änderungen klein schneiden und häufig integrieren (Trunk-Based Development als Standard, Feature Flags für unfertige Arbeit).
- Eine zweite Stelle nur mit eigener R-Zeile und eigenem `Scope:` in `REQUIREMENTS.md`.
- Schwer reversible Entscheidungen zuerst als Design Doc (`docs/design/`) und ADR (`docs/adr/`) festhalten.
- Diff-Dateien ohne Scope meldet `node scripts/requirements-gate.mjs --check`.
- Verify-Zeilen nur aus der Positivliste in `harness/projekt.yaml` unter `verify.allow`.
- Lokal `node scripts/gate.mjs --schnell`, vor Push `--voll`.

## Code-Urteil und Design-Iteration

- Der Prozess setzt die Untergrenze; Entwurfsqualität folgt Regel `code-quality`: Zweck einer Datei in unter zwei Minuten klar, eine fachliche Regel an einer Stelle, keine Durchreich-Schichten, einfaches integeres Datenmodell, entschiedene Fehlerfälle (Timeout, Retry, Teilausfall, leere Antwort, doppelter Submit) und angstfreie Löschbarkeit.
- Vor Änderungen bestehenden Code und Aufrufer lesen. Nach realer Nutzung oder Vorfällen falsche Schnittgrenzen aktiv vereinfachen (Design-Iteration), statt Workarounds aufzustapeln.

## Teststrategie (Testing Trophy nach Risiko)

- Reihenfolge nach Rendite: statische Prüfung (Lint, Typen) → Integrationstests als Rückgrat → Unit-Tests für verzweigte Domänenlogik → wenige E2E-Tests für kritische Geschäftswege.
- Tests prüfen beobachtbares Verhalten, keine Implementierungsdetails. Testabdeckung ist Diagnose, keine Zielquote.
- Jede R-Zeile nennt unter `Verify:` ein Kommando, das vom Repo-Root läuft.
- Framework-Tests kommen in dieselbe R-Zeile.

## Versionierung, Betrieb und Release

- Versionierung nach SemVer 2.0.0; `CHANGELOG.md` nach Keep a Changelog pflegen.
- Vor erstem Produktivgang `docs/operations.md` (aus `docs/templates/OPERATIONS.md`) mit SLI, SLO, Fehlerbudget, Alarmierung und Runbook anlegen.
- Vor Releases `docs/templates/RELEASE-CHECKLIST.md` prüfen (Migration, ASVS 5.0.0, SBOM, DSGVO, WCAG 2.2 AA / EAA-BFSG, CRA-Scope).

## Status

- `State: passing` schreibt nur das Verify-Skript, nicht der Agent von Hand.
- Ticket-Status in Plane oder einem anderen Tracker ändert der Agent nicht.
