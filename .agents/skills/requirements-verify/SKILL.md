---
name: requirements-verify
description: >-
  Prüft betroffene R-Zeilen gezielt. Auslöser: Verify, Requirements prüfen,
  Gate, betroffene Zeilen, --affected.
---

# Requirements Verify

1. `node scripts/verify-requirements.mjs --affected` ausführen und die IDs lesen.
2. Diese Zeilen prüfen: `node scripts/verify-requirements.mjs --verify-affected`.
3. Danach `node scripts/gate.mjs --schnell`. Vor Push oder Merge Request `--voll`.

`State: passing` schreibt nur das Verify-Skript. Den Status nicht von Hand setzen.
Keine Verify-Zeile außerhalb der Positivliste in `harness/projekt.yaml` (`verify.allow`).
