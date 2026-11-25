# Stand

Aktueller Entwicklungsstand von **Setlist Pro Live Sync** im Betriebsmodus `core` (selbst gehostet und autark).

## Fertig

- **Grundlage, Betrieb und CI (R1 bis R5, R17):**
  Stack aus React/TypeScript/Vite, Django REST Framework, PostgreSQL und Redis/Channels im Docker-Compose-Betrieb (`web`, `api`, `relay`, `db`, `cache`). Alle Aufrufe laufen unter einer Origin über nginx. Die CI prüft Sicherheit, Dateigrößen, Tests, Build und Container-Smokes. Tags `v*` bauen und veröffentlichen `web` und `api` über GHCR samt fertigem Release-Compose.
- **Konten, Bands, Mitglieder und Einladungen (R6, R7, R21, R22):**
  Lokale Konten mit Argon2-Passwort-Hash, eindeutiger E-Mail und CSRF-geschützter Session ohne offene Registrierung. Band-Owner pflegen Name, Genre, Ort/Proberaum, Beschreibung und interne Band-Notiz. Rollenwechsel, Entfernen und eigener Austritt laufen unter Zeilensperre und schützen den letzten Owner. 48-Stunden-Einladungslinks mit optionalem Hinweis und Nutzungslimit speichern ausschließlich den SHA-256-Hash und schreiben keine Klartext-Tokens in Zugriffs- oder Fehlerlogs.
- **Instanz-Einladung (R23):**
  Der Betreiber erzeugt per `manage.py instanz_einladung` einen Link ohne Bandbezug. Er gilt 1 bis 90 Tage, optional mit Nutzungslimit, und laesst sich per `--widerrufen` schliessen. Wer ihn oeffnet, legt unter `/api/beitritt/<token>/` nur ein Konto an; die Band gruendet das Konto danach selbst. Tokens stehen nur als SHA-256-Hash in der Datenbank, die oeffentlichen Aufrufe laufen in derselben Rate-Zone wie die Band-Einladung, und der Token wird in Logs redigiert.
- **Songs, Setlists und Auftritte (R8 bis R10):**
  Bandgebundene Songs mit Titel, Interpret, Tonart, BPM, Notiz und Suche. Setlists führen Abschnitte (Set, Pause, Zugabe), Einträge, dauerhafte UUIDs und revisionsgeschütztes Speichern. Auftritte gruppieren Kommend und Vergangen serverseitig nach Berliner Datum, verknüpfen optionale Setlists und bieten Direktlinks.
- **Private Song-PDFs und Anmerkungen (R11, R12, R19):**
  Unveränderliche PDF-Versionen liegen privat unter `DOCUMENTS_ROOT` und werden in einem begrenzten Unterprozess geprüft. Die Auslieferung prüft die Bandmitgliedschaft und unterstützt Byte-Ranges sowie Originaldownloads. Text- und Marker-Anmerkungen arbeiten im kanonischen Seitenraum mit getrennter Sichtbarkeit (persönlich oder bandweit), direktem Verschieben und Skalieren, Entwurfsschutz und Konflikterkennung.
- **Echtzeit, Zusammenarbeit und Bühne (R13 bis R15):**
  Transaktionale Outbox mit eigenem Relay, getrennten Band- und persönlichen WebSocket-Strömen, Snapshot-Abgleich, Heartbeat und Wiederverbindung. Yjs-Textzusammenführung mit Epochen ergänzt den revisionsgeschützten Gesamt-PUT durch idempotente Einzelbefehle. Pro Band läuft höchstens eine feste Bühnensitzung als Snapshot mit Einzel-Leitung, Übergabe, Owner-Übernahme, freiwilligem Folgen, lokaler Navigation und Offline-Lesereserve bis 128 MiB.
- **Bandexport und Oberfläche (R16, R18, R20):**
  Der Bandexport liefert ein größenbegrenztes ZIP mit Manifest, Fachdaten, zulässigen Anmerkungen und allen PDF-Versionen. Die Oberfläche bietet mobile Navigation, geprüfte Abstände von 360 bis 1280 Pixeln sowie Urheber-, Betreiber- und Quellcode-Angaben im Fuß jeder Seite.

## Zuletzt behoben

- Zweitreview F1 und F2: Der Browser sendet beim Einladungsbeitritt mit `strict-origin` wieder den eigenen Origin, sodass der CSRF-Check nicht mehr mit 403 scheitert; Bandänderungen im Django-Admin erzeugen `band.updated` (R21, R22).
- Review-Runde 8: Einladungen sind im Django-Admin vollständig schreibgeschützt, verspätete Beitritts-Listenabrufe wechseln nach neuer Navigation die aktive Band nicht mehr, alte Listenabrufe überschreiben keine bestätigten Einladungsaktionen, Mitglieder-Entfernen trennt bestätigtes DELETE vom Listenabruf, und ältere PATCH-Antworten überschreiben keine neueren Hintergrundänderungen an unberührten Bandfeldern (R4, R21, R22).
- Review-Runde 7: Zentraler Argon2-Prüfpfad ohne doppelten Hash-Aufwand bei unbekannten Konten, kein doppelter Band-POST nach fehlgeschlagenem Listenabruf, kein Überschreiben einer neuen Navigation bei spätem Einladungsbeitritt, Referer-Redaktion in nginx, präzise Einladungs-Feldfehler, Widerrufs-Sperre sowie geschlossenes `stdin` in `gate.mjs` und `review-kilo.mjs` (R1, R6, R7, R18, R21, R22).
- Review-Runde 6: Verspätete Start-Sitzungsabfragen und Hintergrundabrufe erhalten den Einladungsbeitritt samt Zielband, verspätete Austrittsantworten lassen eine neu gewählte Band unberührt, lokale Austrittssperren überstehen Bandwechsel, 401 in der lesenden Anmerkungsansicht führt zur Anmeldung, und Benutzernamen werden bei Registrierung und Anmeldung einheitlich per NFKC normalisiert (R4, R6, R12, R13, R21, R22).
- Review-Runde 5: nginx-Logredaktion deckt auch Tokens mit Sonderzeichen ab, Feldkonflikte bleiben über mehrere Hintergrund-Updates erhalten, eigener Band-Austritt räumt die Ansicht sofort, späte Startfehler verdrängen keinen Einladungsbeitritt, der Owner-Schutz zählt nur aktive Konten samt `manage.py band_owner_setzen`, und `BandInvitationAdmin` sperrt die Anlage ohne Token (R13, R21, R22).
- Review-Runde 4: Einladungs-Tokens werden in nginx- und Django-Logs durch `[token]` ersetzt, der Widerruf sperrt nur die Einladungszeile, `created_at` und `expires_at` stammen aus einem Zeitpunkt, Band-Einstellungen sperren während des Speicherns, der Entwurfsdialog zeigt Fehler, Bandlisten-Abrufe tragen eine Laufkennung, und App sowie große Ansichten sind aufgeteilt (R4, R12, R13, R19, R21, R22).
- Review-Runde 3: Einladungs-Tokens bleiben auch bei Upstream-Fehlern aus dem nginx-Fehlerlog, der Django-Admin schreibt Mitgliedschaften nicht mehr am Fachdienst vorbei, ein bestätigter Rechteentzug räumt die Bandansicht sofort, Band-Einstellungen senden nur berührte Felder, und strukturierte 400-Antworten erreichen die Einladungsseite (R4, R13, R21, R22).
- Bühnenansicht: Anmerkungen werden nach PDF-Version des angezeigten Eintrags und nach Seite gefiltert. Regressionstests decken mehrseitige PDFs und lokalen Songwechsel ab (R15).
- Review-Runde 2: Einladungsseite ohne Referer-Token, Passwortprüfung vor Kontoabfragen, Leseansicht aus bestätigten Banddaten, gesperrter Einladungswiderruf und frisches Compose-Projekt im R2-Smoke (R2, R6, R15, R21, R22).
- Vollabgleich prüft die Mitgliedschaft im REPEATABLE-READ-Snapshot. Abgelaufene Sessions auf der Einladungsseite laden die Vorschau anonym neu (R13, R21, R22).
- Zweitreview F1 bis F6: Owner-Sperre beim Einladungsschreiben, 401-Pfade der Bandliste, Setlist-Ereignisse für Auftritte, Einladungstexte bei 404 und 401, falsche Warnung nach dem Speichern sowie getrennte Listenabrufe mit eigenem Lese-Throttle (R4, R10, R13, R21, R22).

## Offen

- Praxisprüfung auf echten Smartphones und Tablets (Touch, Bildschirmtastatur, PDF und Bühne) anhand von `docs/pilot.md`.
- Konzept und Betrieb des optionalen Community-Hubs als getrennte Instanz (Domain, Moderation, Verantwortung).
- Pflege- und Beitragsprozesse für das öffentliche Repository festlegen (Release-Rhythmus, Bearbeitung von Meldungen aus `SUPPORT.md`, `CODEOWNERS`).
- Namen vor einer breiten öffentlichen Ankündigung rechtlich prüfen.

## Als Nächstes

1. Commit per `--amend` aktualisieren und das Voll-Gate grün durchlaufen lassen.
2. Geprüften Stand committen, pushen und den GHCR-Release-Ablauf prüfen.
3. Pilot-Checkliste in `docs/pilot.md` auf echten Endgeräten abschließen.
4. Erst danach den optionalen Community-Hub als eigenes Paket planen.

## Hinweis

Ein lokaler Altbestand unter `alte_projektdatein/` bleibt bewusst unversioniert und dient ausschließlich als lokale Referenz.
