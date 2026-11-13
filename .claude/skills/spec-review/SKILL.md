---
name: spec-review
description: Prüft R-Zeilen mit Risk hoch auf fehlende Cases, bevor Code geschrieben wird. Schreibt nur nach .tmp/review/spec.md.
---

# Spec-Review

Prüft die fachliche Spezifikation, nicht den Code. Wer spec-reviewed, ändert keinen Anwendungscode.

## Wann

Vor der Implementierung, wenn die R-Zeile `Risk: hoch` trägt.

## Schritte

1. Die R-Zeile in `REQUIREMENTS.md` lesen (Behavior, Cases, Verify, Scope).
2. Prüfen, ob Cases positiv, negativ und als Grenzwert vorkommen.
3. Fehlende Fälle als Befund schreiben. Keine Implementierung vorschlagen, die über den Testplan hinausgeht.

## Ausgabe

Schreibe `.tmp/review/spec.md`.

Kopf: Modell, R-ID, Zeitpunkt.

Je Befund: fehlender Fall, warum er zur Anforderung gehört.

Ohne Befund: „Cases decken positiv, negativ und Grenzwert.“

## Grenzen

Keine Code-Edits. Keine Git-Schreibaktionen. Nur `.tmp/review/spec.md`.
