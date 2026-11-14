# Beiträge

Danke, dass du mitmachst. Dieses Dokument beschreibt den Weg vom Fund zur
Änderung.

## Sprache

Das Projekt ist deutsch. Issues, Diskussionen, Commits und Dokumentation sind
deutsch. Code-Bezeichner bleiben englisch, wie in der jeweiligen Sprache üblich.

## Fehler melden

Nutze die Issue-Vorlage `Fehler`. Sie fragt nach dem, was zur Reproduktion
nötig ist:

- was du getan hast,
- was du erwartet hast,
- was passiert ist,
- Version oder Commit,
- Betriebsmodus (`core` oder `hub`).

Ohne diese Angaben lässt sich ein Fehler meist nicht nachvollziehen.

## Funktionen vorschlagen

Nutze die Issue-Vorlage `Funktionswunsch`. Beschreibe das Problem, nicht nur die
Lösung. Ein Vorschlag ohne Problembezug wird selten angenommen.

Der Umfang ist bewusst klein gehalten. Kein MIDI, kein Audio, kein Booking,
keine Finanzen, keine KI. Diese Liste steht im
[Hybrid-Modell](docs/planung/hybrid-modell.md).

## Änderungen einreichen

1. Fork anlegen und einen Branch vom aktuellen `main` ziehen.
2. Kleine, thematisch geschlossene Commits.
3. Commit-Nachricht auf Deutsch, erste Zeile im Imperativ, maximal 72 Zeichen.
4. Pull Request gegen `main` öffnen und die Vorlage ausfüllen.
5. Der Maintainer merged. Beitragende mergen nicht selbst.

Ein Pull Request ändert eine Sache. Zwei Themen gehören in zwei Pull Requests.

## Qualität

Dieses Repository wird mit einem lokalen Qualitätssicherungsharness entwickelt.
Die Gate-Skripte unter `scripts/` sind bewusst nicht Teil des veröffentlichten
Repos. `REQUIREMENTS.md` und `PROGRESS.md` beschreiben diesen internen Ablauf.
Für deinen Beitrag zählt, was im Repo ankommt:

- Tests für neue Logik, mindestens ein Fall, der bei Fehlern scheitert.
- Lint und Format laufen, sobald das Gerüst steht.
- Keine neuen Abhängigkeiten ohne Begründung im Pull Request.
- Keine stillen Fehler: Fehlerfälle sichtbar machen, nicht wegschlucken.
- Rechte werden serverseitig geprüft. Ausgeblendete Knöpfe sind kein Schutz.

## Keine echten Daten

Keine echten Bandcodes, Firebase-Projekt-IDs, API-Keys, Nutzernamen,
E-Mail-Adressen oder Server-Adressen in Issues, Commits, Tests oder
Beispieldaten. Erfundene Beispieldaten sind Pflicht.

## Lizenz deines Beitrags

Mit dem Pull Request bestätigst du, dass du den Code selbst geschrieben hast
oder die Rechte daran hast, und dass du ihn unter der AGPL-3.0 beiträgst.
