<!-- Generiert aus harness/ – dort ändern, dann: node scripts/harness.mjs render -->

# Konventionen

Diese Datei wiederholt die Agent-Regeln nicht. Sie nennt, was der Agent erbt und was zusätzlich gilt.

## Scope

- Eine Aufgabe, ein Subsystem.
- Eine zweite Stelle nur mit eigener R-Zeile und eigenem `Scope:` in `REQUIREMENTS.md`.
- Diff-Dateien ohne Scope meldet `node scripts/requirements-gate.mjs --check`.
- Verify-Zeilen nur aus der Positivliste in `harness/projekt.yaml` unter `verify.allow`.
- Lokal `node scripts/gate.mjs --schnell`, vor Push `--voll`.

## Tests

- Jede R-Zeile nennt unter `Verify:` ein Kommando, das vom Repo-Root läuft.
- Framework-Tests kommen in dieselbe R-Zeile.

## Status

- `State: passing` schreibt nur das Verify-Skript, nicht der Agent von Hand.
- Ticket-Status in Plane oder einem anderen Tracker ändert der Agent nicht.
