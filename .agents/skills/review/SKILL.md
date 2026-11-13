---
name: review
description: >-
  Working-Tree-Review mit Scope-Matching, Reproduktionspflicht und Befunddatei.
  Auslöser: Review, Code Review, Selbst-Review, Diff prüfen, vor Commit, vor MR, /review.
---

# Review

Prüft den Working Tree, bevor der Diff in Git oder einen Merge Request geht. Ergänzt das Requirements-Gate, ersetzt es nicht. Wer reviewt, ändert keinen Code.

## Wann

Nach Produktcode, wenn der Autor fertig ist. Nicht parallel zum Autor im selben Working Tree. Nur auf ausdrücklichen Befehl.

## Schritte

1. Diff holen. Basis ist der Working Tree. Branch-Diff nur, wenn `REQUIREMENTS_DIFF_BASE` gesetzt ist.

```bash
git status
git diff --stat
git diff
```

2. Scope-Matching. Betroffene R-Zeilen anzeigen.

```bash
node scripts/verify-requirements.mjs --affected
```

Die Verify-Kommandos der betroffenen R-Zeilen in `review-run` übersetzen, soweit das Ziel in `harness/projekt.yaml` unter `verify` steht.

```bash
node scripts/review-run.mjs
```

`node scripts/verify-requirements.mjs` ohne `--affected` und `--verify-affected` bleiben beim Autor. Sie schreiben `REQUIREMENTS.md`.

3. Native Gates über dieselbe Positivliste:

```bash
node scripts/review-constraints.mjs
```

`lint-colors` nur, wenn das Modul ui-tokens an ist.

4. Kontext-Tiefe. Vor jedem Befund die Call-Sites lesen, nicht nur den Diff. Aufrufer mit Suche im Repo finden. R-Zeilen desselben Modulordners mitprüfen.

## Reproduktionspflicht

Ein Befund gilt nur, wenn du das Kommando selbst ausgeführt hast und der Output den Fehler zeigt. Ohne reproduzierendes Kommando keinen Befund schreiben. Security-Befunde nur über die Code-Stelle oder einen fehlschlagenden Check belegen, nie über einen Payload.

## Stand

Vor dem Bericht `node scripts/review-stand.mjs` ausführen. Kopf der Findings enthält die beiden Zeilen `HEAD …` und `DIFF …` unverändert. Ein Review gilt nur für diesen Diff. Nach weiteren Edits ist ein neuer Lauf nötig.

## Befundfelder

Je Befund:

- `finding_id`: F1, F2, …
- Schwere: blocker, major, minor
- Kategorie: funktional, Sicherheit, Architektur, Betrieb
- Status: offen
- `Pfad:Zeile`
- Beleg: Kommando plus Output-Auszug
- R-Zeile
- Vorschlag
- Nachgeprüft: nein

## Noise-Regeln

Die Kurzfassung nennt höchstens fünf Befunde, sortiert nach Schwere. Blocker und Major stehen immer vollständig, auch über fünf hinaus. Keine Stil-Nits. Kein Architektur-Befund ohne Call-Site. Keine Befunde zu unverändertem Code, außer der Diff bricht ihn.

## Grenzen

Keine Code-Edits. Keine Git-Schreibaktionen. Keine Secrets im Bericht. Kein voller Verify, kein `--verify-affected`. Nur:

- `git status`, `git diff`, `git log`, `git show`
- `node scripts/review-constraints.mjs`
- `node scripts/lint-colors.mjs` (falls vorhanden)
- `node scripts/verify-requirements.mjs --affected`
- `node scripts/review-run.mjs`
- `node scripts/review-stand.mjs`

## Ausgabe

Schreibe `.tmp/review/findings.md`.

Kopf: Modell, Branch, Zeitpunkt, ausgeführte Gates, Stand (HEAD und DIFF aus `review-stand.mjs`).

Kurzfassung: höchstens fünf priorisierte Befunde. Danach die vollständige Liste aller Blocker und Major.

Ohne Befund: „Keine belegten Befunde“.

## Freigabe

Der Autor prüft jeden Befund selbst nach (`Nachgeprüft`). Danach behebt er ihn (`Status: behoben`) oder lehnt ihn ab (`Status: abgelehnt` plus Begründung). Einen Blocker oder Major darf der Autor nur mit der zusätzlichen Zeile `Freigabe: Nutzer` ablehnen.
