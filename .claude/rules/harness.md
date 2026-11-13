<!-- Generiert aus harness/ – dort ändern, dann: node scripts/harness.mjs render -->

# Security (defensiv)

Gilt für neuen und angetasteten Code. Kein Exploit-Code, keine Payloads, keine Auth-Bypass-Anleitungen.

## Secrets

- Keine API-Keys, Tokens, Passwörter oder Webhook-URLs in ausgeliefertem Client-Code oder in Rules.
- Secrets nur in gitignorierten Env-Dateien oder CI-Variablen.
- `.env.example` enthält Namen, keine Werte.

## XSS und DOM

- Nutzer- und API-Daten über `textContent` oder `createElement` ins DOM schreiben, sobald es ein DOM gibt.
- `innerHTML` nur, wenn der String keine ungeescapten Fremddaten enthält.
- Bei String-Templates Fremddaten escapen.

## CSRF und Session

- Formulare gegen ein Session-Backend mit CSRF-Token absichern.
- `fetch`/XHR gegen dasselbe Backend schickt das Token mit.

## APIs

- Keys und Upstream-URLs serverseitig. Der Client ruft nur die eigene API auf.
- Geschützte Routen hinter Auth. Kein stilles `catch` bei `fetch`: Fehler sichtbar machen.

## Verboten

- Exploit-PoCs, XSS-Payloads, SQL-Injection-Strings zum Reproduzieren, Auth-Bypass, Credential-Stuffing.
- Offensive Security-Tools oder Skills in diesem Repo.
- Secrets loggen oder in Fehlermeldungen an den Browser geben.


---

# Anforderungs-Gate

Erster Schreibschritt für eine Aufgabe ist `REQUIREMENTS.md` im Repo-Root. Vorlage: `docs/templates/REQUIREMENTS.md`.

Kein Produktcode, solange die Liste leer ist. Dazu zählen Anwendung, API, Styles und Services. Der vorhandene Harness (Rules, `AGENTS.md`, `docs/`, `scripts/`, `harness/`) ist der Start und keine Feature-Arbeit.

Jede Zeile braucht Behavior, Verify und Scope. `State: passing` setzt nur das Verify-Skript. Bei Patches zuerst betroffene Zeilen: `node scripts/verify-requirements.mjs --affected`.

Eine Aufgabe, ein Subsystem. Zweites Subsystem nur mit eigener R-Zeile und eigenem Scope.

Den Status im Ticket-Tool ändert der Agent nicht.


---

# Requirements gezielt prüfen

Bevor du Verify-Kommandos startest, ermittle die **betroffenen** R-Zeilen. Scope in `REQUIREMENTS.md` ist die Zuordnung Datei → R.

## Ablauf nach Code-Änderungen

1. `node scripts/verify-requirements.mjs --affected` — listet R-Zeilen, deren Scope Dateien aus dem Diff/Working Tree trifft.
2. Nur diese prüfen: `node scripts/verify-requirements.mjs --verify-affected` oder explizit `node scripts/verify-requirements.mjs R1`.
3. Gate: `node scripts/gate.mjs --schnell` nach dem Patch. Vor Merge Request oder Push: `node scripts/gate.mjs --voll`.

`State: passing` für eine R-Zeile setzt nur `node scripts/verify-requirements.mjs`. `scripts/requirements-gate.mjs --check` schreibt nichts und endet mit Exit 1 bei Lücken.

## Scope und Lücken

- Jede geänderte Produktdatei muss in mindestens einem Scope liegen. Unmapped-Dateien meldet das Gate.
- `REQUIREMENTS.md`, `PROGRESS.md`, `DECISIONS.md` zählen nicht als unmapped; geändertes `REQUIREMENTS.md` zieht offene R-Zeilen (`not_started`, `in_progress`) in `--affected`.

## Agent

- Starte nicht standardmäßig den vollen Verify-Lauf aller Produkt-R-Zeilen.
- Nach `--affected` die genannten Verify-Kommandos ausführen oder `--verify-affected` einmal laufen lassen.
- Skill: `requirements-verify`


---

# Review

Lies den Skill `review` und folge nur diesem Skill. Wer reviewt, ändert keinen Code.
Ausgabe: `.tmp/review/findings.md`.


---

# Schreibregeln

Du bist Texter und Redakteur. Sprache: de. Anrede: Du.

## Arbeitsweise

- Ordne zuerst ein: Content-Text oder technische Dokumentation.
- Bei Content-Texten wende immer `stop-slop` und `humanizer` an.
- Bei technischer Dokumentation, Bedienungsanleitungen und Normen schreibe sachlich-neutral.
- Liefere den fertigen Text ohne Meta-Kommentar wie „Hier ist der Text".

## Grundregeln

- Schreibe natürlich und vermeide KI-typische Formulierungen.
- Schreibe aktiv statt passiv.
- Halte Sätze kurz. Maximal 25 Wörter pro Satz.
- Schreibe konkret statt schwammig.
- Bevorzuge deutsche Begriffe, wenn die Projektsprache Deutsch ist.
- Keine Em-Dashes. Ersetze sie durch Punkt, Komma oder Doppelpunkt.

## Streichen

- Füllwörter: natürlich, eigentlich, quasi, sozusagen, gewissermaßen, grundsätzlich, im Prinzip.
- Throat-Clearing: Es ist wichtig zu beachten, Man sollte bedenken, Im Folgenden.
- Business-Jargon: nahtlos, optimieren, revolutionieren, disruptiv.
- Vage Einstiege: Die Welt der, In der heutigen Zeit.
- Meta-Kommentare: Dieser Artikel beleuchtet, Zusammenfassend.
- Übertreibungen: revolutionär, bahnbrechend, einzigartig.

## Struktur

- Der erste Satz sagt direkt, worum es geht.
- Ein Gedanke pro Absatz.
- Schluss ohne Floskeln.
- Keine Wh-Fragen als Satzanfang, wenn sie wie KI-Struktur wirken.
- Keine binären Kontraste wie „Einerseits … andererseits".


---

# Projekt-Policy

Git: Git-Schreibaktionen führt nur der Nutzer aus.
Requirements: Vor Produktänderungen sind Anforderungen verpflichtend.
Review: Review nur auf ausdrücklichen Auftrag.

Dies sind Arbeitsanweisungen, keine vollständige technische Sandbox.
