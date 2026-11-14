# Stand

## Sofort

- Firestore in der Alt-App war am 13.11.2026 ohne Anmeldung lesbar.
- Gelesen: 4 Bands, 9 Mitgliedseinträge, 7 Songs, 2 Setlists, 9 Annotationen, 1 PDF.
- Eine Band enthält ein Klartextfeld `pw`. Das Passwort muss rotiert werden.
- Die Regeln müssen geschlossen werden. Das ist eine Aufgabe für den Kollegen mit Konsolenzugriff.
- Nichts wurde geändert, gelöscht oder geschrieben.

## Jetzt

- Analyse der Alt-App abgeschlossen. Ergebnisse unter `docs/analyse/` und `docs/brand/`.
- Hybrid-Plan beschlossen und abgelegt: `docs/planung/hybrid-modell.md`.
- Stack: React/TypeScript/Vite, Django REST Framework, PostgreSQL, Redis/Channels, Docker Compose.
- Zwei Betriebsmodi: `core` selbst gehostet und autark, `hub` zentral mit Community. Der Kern darf nicht vom Hub abhängen.
- Open Source über GitHub, Updates als Docker-Images über GHCR, optionaler Community-Hub als eigene Instanz.
- Lokaler Export der Alpha: `.tmp/fb/export.zip`, Rohdaten unter `.tmp/fb/`. Der Ordner ist gitignored.
- Doku bereinigt: alte Projekt-ID, Bandcodes und Demo-Namen entfernt. Screens der Alt-App bleiben lokal, `docs/analyse/screens/` ist gitignored.
- Sicherheits-Baseline im Gate: `scripts/review-constraints.mjs` blockt Secrets, Zugangsdaten, private IPs, eingebettete Dateien und unsichere Code-Muster, auch in `docs/` und `.yaml`.
- Kein Produktcode, keine neuen R-Zeilen. Das Requirements-Gate bleibt grün.

## Offen

- Firestore-Regeln schließen: erst Anmeldung, dann Mitgliedschaft pro Band.
- Passwort rotieren und das Feld `pw` entfernen.
- V12-Datei und aktuelle Alpha-Verteilung beim Kollegen klären.
- Storage auf verwaiste PDFs prüfen. Dafür braucht es Leserechte.
- Lizenz entscheiden: AGPL-3.0 oder Apache-2.0.
- Hub-Domain, Name und Moderationsverantwortung festlegen.
- Support- und Release-Rhythmus festlegen.
- Namen „Setlist Pro“ vor öffentlicher Veröffentlichung prüfen.

## Als Nächstes

1. Firestore-Regeln schließen und Passwort rotieren.
2. Lizenz und Hub-Domain entscheiden.
3. `harness/projekt.yaml` auf den neuen Stack und die zwei Modi umstellen, Dry-Run, Render, Konflikte prüfen.
4. R2 anlegen, Gerüst bauen, Docker Compose und CI aufsetzen.
5. Core bauen: Auth, Bands, Songs, Setlists, PDFs, Annotationen, Realtime, Bühne.
6. Betrieb: Backup, Restore, Upgrade, Release.
7. Erst danach den Hub als eigene Instanz.

## Hinweis

`alte_projektdatein/` ist bewusst gitignored und nicht versioniert. Der frühere Plan
„Baseline committen“ ist damit nicht umsetzbar, ohne die Ignore-Regel zu ändern.
Der Ordner bleibt als lokale Referenz erhalten.
