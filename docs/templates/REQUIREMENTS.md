# Anforderungen

Eine Datei pro Task. Status ändert nur `node scripts/verify-requirements.mjs`.

```
R1 | Behavior: <beobachtbares Verhalten>
   | Verify:  <erlaubtes Kommando aus harness/projekt.yaml verify.allow, Repo-Root>
   | Scope:   <Ordner oder Datei, kommagetrennt>
   | Risk:    niedrig
   | Cases:   AC-01 positiv …; AC-02 negativ …; AC-03 Grenzwert …
   | State:   not_started
```

Zustände: `not_started`, `in_progress`, `passing`. Risk: `niedrig`, `mittel`, `hoch`. Fehlt Risk, gilt niedrig. `Risk: hoch` braucht Cases und vor dem Code ein `spec-review`.

Regeln:

- Die Liste darf vor dem ersten Produktcode nicht leer sein.
- Jede Zeile braucht Behavior, Verify und Scope.
- Bei `Risk: mittel` oder `hoch` Cases als testbare Szenarien (`Given/When/Then`: positiv, negativ, Grenzwert) formulieren und relevante nicht-funktionale Anforderungen nach ISO/IEC 25010:2023 (z. B. Performance, Security/ASVS, Reliability, Barrierefreiheit WCAG 2.2 AA, Safety) explizit nennen.
- Bei schwer reversiblen Änderungen oder mehreren Subsystemen zuerst Design Doc (`docs/design/`) und ADR (`docs/adr/`) anlegen und im Behavior verweisen.
- Fertig erst, wenn jede Zeile `passing` ist und jede Diff-Datei in einem Scope liegt.
- `State: passing` schreibt nur `node scripts/verify-requirements.mjs`.
- Ticket-Status setzt der Mensch.
