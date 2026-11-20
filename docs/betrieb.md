# Betrieb

Diese Seite beschreibt die Laufzeit des selbst gehosteten Core. Sie ergänzt
`README.md` um die private PDF-Ablage und die Grenzen für Uploads.

## PDF-Ablage

PDFs liegen in einem eigenen Docker-Volume. Der Container sieht es unter
`/app/documents`, im Compose-Betrieb als Volume `documents`.

- `DOCUMENTS_ROOT` legt den Pfad im API-Container fest. Standard ist
  `/app/documents`.
- Der Web-Container hat keinen Zugriff auf dieses Volume.
- `/media/` wird nicht ausgeliefert. Jede Datei geht durch die API. Die API
  prüft bei jedem Zugriff die aktuelle Bandmitgliedschaft.
- Dateischlüssel sind zufällig. Der Originalname steht nur in der Datenbank
  und im Download-Header, nie im Speicherpfad.
- Versionen sind unveränderlich. Ein Upload ersetzt keine aktive Version.

Für Sicherungen das Volume `documents` zusammen mit der PostgreSQL-Datenbank
sichern. Ohne Dateien bleiben die Metadaten gültig, die Ansicht meldet dann
einen fehlenden Inhalt.

## Grenzen

| Variable | Standard | Wirkung |
|---|---:|---|
| `PDF_MAX_UPLOAD_BYTES` | 20971520 | Maximale Dateigröße in Byte. `0` schaltet das Limit ab. |
| `PDF_MAX_PAGES` | 100 | Maximale Seitenzahl. `0` schaltet das Limit ab. |
| `PDF_CHECK_TIMEOUT_SECONDS` | 30 | Zeitlimit für die Prüfung. Muss größer als 0 sein. |
| `PDF_CHECK_MEMORY_MB` | 512 | Speicherlimit des Prüfprozesses. Muss größer als 0 sein. |

`PDF_MAX_UPLOAD_BYTES` und `PDF_MAX_PAGES` lehnen negative Werte und
nichtnumerische Eingaben beim Start ab. Die API prüft die Datei zusätzlich nach
dem Streamen. Der Proxy setzt seine Grenze auf `PDF_MAX_UPLOAD_BYTES` plus
65.536 Byte für Multipart-Metadaten. Bei `0` ist die Proxy-Grenze ebenfalls aus.

Der Web-Container und die API lesen beide `PDF_MAX_UPLOAD_BYTES` aus derselben
Compose-Variable. Wer die Grenze ändert, startet beide Dienste neu.

## Prüfung und Bereinigung

Die API prüft Struktur, Seitenzahl und Verschlüsselung mit pypdf in einem
Unterprozess. Der Unterprozess bekommt Zeit- und Speichergrenzen. Abgelehnte
Dateien hinterlassen weder Version noch Datei.

Alte Uploadreste entfernt:

```bash
docker compose exec api python manage.py bereinige_dokumente
```

Das Kommando löscht nur Dateien, die älter als 24 Stunden sind und zu keiner
`DocumentVersion` gehören. Referenzierte Versionen bleiben erhalten. Das
Kommando eignet sich für einen täglichen Cron- oder Timer-Lauf.

## Bandexport

Mitglieder laden unter `GET /api/bands/<id>/export/` ein ZIP ihrer Band. Es
enthält `manifest.json`, alle Songs, Setlists mit Abschnitten und Einträgen,
Auftritte, bandweite Anmerkungen und die eigenen persönlichen Anmerkungen.
Dazu kommen alle PDF-Versionen der Band unter `pdfs/<song_id>/`.

- Fremde Bands antworten mit 404, anonyme Aufrufe mit 401.
- Persönliche Anmerkungen anderer Mitglieder sind nicht enthalten.
- Der Dateiname im Download wird aus dem Bandnamen gebildet und bereinigt.
- `EXPORT_MAX_BYTES` begrenzt die Nutzbytes des Archivs. Standard sind
  536870912 Byte (512 MiB), `0` schaltet die Grenze ab. Bei Überschreitung
  antwortet die API mit 413.
- Das Archiv wird in einer temporären Datei gebaut und nach dem Download
  verworfen. Ein Import ist nicht Teil des Exports.

## Diagnose

- Ein 413 vom Proxy bedeutet, dass der Request die Proxy-Grenze überschreitet.
- Ein 413 von der API bedeutet, dass die Datei über `PDF_MAX_UPLOAD_BYTES`
  liegt, aber der Proxy sie durchgelassen hat.
- Ein 400 mit `file` nennt eine abgelehnte PDF, etwa verschlüsselt, beschädigt
  oder über dem Seitenlimit.
- Ein 409 bei der Aktivierung bedeutet, dass eine andere Sitzung die aktive
  Version zuerst geändert hat. Neu laden und erneut wählen.
- Ein 416 bei der Datei ist eine ungültige oder nicht erfüllbare Byte-Range.
  Die Antwort enthält `Content-Range: bytes */<Größe>`.

Anmerkungstexte erscheinen nicht in Anwendungsprotokollen oder im Banddetail.
Für Fehlersuche den HTTP-Status und die Anmerkungs-ID verwenden, nicht den
Inhalt.

## Gemeinsame Bearbeitung

Setlisten tragen eine Revision und dauerhafte UUIDs je Abschnitt und Eintrag.
Der Gesamt-PUT `PUT /api/bands/<band_id>/setlists/<id>/content/` verlangt die
Entwurfsrevision im Rumpf:

```json
{"revision": 7, "sections": [{"uuid": "...", "name": "Set", "kind": "set", "entries": []}]}
```

Fehlt `revision`, antwortet die API mit 400. Ist der gespeicherte Stand neuer,
mit 409 ohne Änderung. Unbekannte, doppelte und gelöschte UUIDs werden
abgewiesen. Unveränderte Objekte behalten ihre UUIDs.

Einzelbefehle unter `POST .../commands/` ändern eine Struktur idempotent:

```json
{"command_id": "<uuid>", "kind": "section.move", "payload": {"uuid": "...", "after_section_uuid": null}}
```

Gleiche Kennung und gleiche Nutzdaten liefern das gespeicherte Ergebnis.
Andere Nutzdaten mit derselben Kennung ergeben 409. Die Arten heißen
`section.create`, `section.update`, `section.delete`, `section.move`,
`entry.create`, `entry.update`, `entry.delete` und `entry.move`.
`after_*_uuid: null` setzt an den Anfang, ein fehlender Schlüssel hängt an.
Ein unbekannter Nachbar ergibt 409.

Textfelder führen Yjs-Zustände mit Epoche. Lesen erzeugt keine Zeile; der
erste bestätigte Update legt sie an. Der Ausgangszustand hat eine feste,
aus dem Feld abgeleitete Client-ID, damit ein Delta aus dem gelesenen Stand
nahtlos auf die neue Zeile passt. Der Browser lädt sie über
`GET .../texts/` und schickt gebündelte Updates an `POST .../text/`.
Ein REST-Ersatz des Textes erhöht die Epoche; Updates mit alter Epoche
ergeben 409. Updates über 64 KiB und beschädigte Updates ergeben 400.

Bandweite Anmerkungen dürfen alle aktuellen Mitglieder bearbeiten. Nur der
Autor ändert die Sichtbarkeit. Der aktuelle Owner löscht zusätzlich bandweite
Anmerkungen. Beim Wechsel auf persönlich erhöht sich die
Berechtigungsgeneration; alte Textupdates anderer Mitglieder scheitern.
Anmerkungstexte laufen über `.../annotations/<id>/text/`. Der WebSocket lehnt
Textupdates über 90.000 Base64-Zeichen und mehr als 30 Updates in zehn
Sekunden je Verbindung ab, bevor er dekodiert.

## Bühne

`GET /api/bands/<band_id>/stage-sessions/` liefert `{"session": null}` oder die
aktive Sitzung. `POST` startet mit `{"setlist_id": ..., "connection_id": ...}`.
Die Verbindungskennung stammt aus der `ready`-Nachricht des Band-WebSockets.
Jeder Lifecycle-Aufruf braucht eine aktive Verbindung derselben Django-Sitzung.

- `POST .../<session_id>/join/` tritt bei.
- `POST .../handover/` übergibt an ein verbundenes Mitglied (`target_user_id`).
- `POST .../takeover/` lässt nur den aktuellen Band-Owner übernehmen.
- `POST .../resume/` holt die Leitung nur für die bisherige Leitung zurück,
  solange niemand übergeben oder übernommen hat.
- `POST .../end/` beendet für Leitung oder Owner.

Steuerbefehle gehen über den Band-WebSocket:

```json
{"type": "stage.command", "session_id": 4, "generation": 2, "number": 7,
 "command_id": "<uuid>", "command": {"kind": "goto", "entry_uuid": "<uuid>", "page": 3}}
```

Die Antwort heißt `stage.result` mit `status: confirmed`, `rejected` oder
`unknown`. Abgelehnte Befehle verbrauchen keine Nummer. Der Sitzungsstand
nennt `last_number` je Generation; nach einer verlorenen Antwort oder einer
Wiederverbindung setzt der Client seinen Zähler auf `last_number + 1`. Eine alte Generation,
eine fremde Verbindung, eine übersprungene Nummer, Pausen und Seiten außerhalb
des Dokuments werden abgelehnt. Genau eine Verbindung leitet; weitere Tabs
desselben Kontos steuern erst nach Übergabe, Übernahme oder Rückkehr.

Verbindungszeilen älter als 24 Stunden werden beim nächsten WebSocket-Aufbau
der Band entfernt. Nur Zeilen der letzten 60 Sekunden gelten als verbunden.

Die Bühnenansicht bereitet alle Sitzungs-PDFs samt Seite 1 bis zu 128 MiB vor.
Ein unvollständiger Vorrat bleibt sichtbar; offline bleiben nur vorbereitete
Dokumente lesbar. Beim Verlassen werden Dokumente und Anmerkungen freigegeben.

## Echtzeit

Jeder geöffnete Tab hält eine authentifizierte Verbindung zu
`/ws/bands/<band_id>/`. Der Server prüft beim Aufbau und bei jeder
Auslieferung erneut Session, aktives Konto und Bandmitgliedschaft. Ein
fehlender oder fremder `Origin` wird abgelehnt.

- Der Client sendet alle 20 Sekunden einen Heartbeat. Antwortet der Server
  60 Sekunden nicht, gilt die Verbindung als unterbrochen.
- Wiederverbindung wartet zufällig zwischen 1 und 30 Sekunden, mit
  wachsender Obergrenze je Versuch.
- Band- und persönliche Ereignisse haben getrennte Gruppen und Zähler.
  Eine Lücke oder ein verlorenes letztes Ereignis löst einen Vollabgleich
  über `GET /api/bands/<band_id>/sync/` aus.
- Abgleich und Ereigniszähler stammen aus demselben PostgreSQL-Snapshot.

Mutationen schreiben Fachdaten und Ereignis in einer Transaktion. Ein
Rollback hinterlässt weder Ereignis noch Bestätigung. Der Dienst `relay`
liest den Ausgangspuffer und veröffentlicht über Redis. Er arbeitet
mindestens einmal, Duplikate sind erlaubt. Ein Redis-Ausfall verzögert den
Abgleich, verliert aber keinen bestätigten Fachstand. Nach einem
Redis-Neustart genügt Warten; keine Fachdaten zurücksetzen.

Ereignisse bleiben sieben Tage erhalten. Veröffentlichte ältere Ereignisse
entfernt das Relay, unveröffentlichte bleiben liegen. Dieselbe Frist gilt für
das Befehlsprotokoll (Idempotenz wiederholter Befehle) und für geschlossene
Bühnenverbindungen. Fachzustand bleibt unberührt: Textstände, Löschmarken und
Setlisten werden nie weggeräumt.

### Diagnose

- `docker compose logs relay` zeigt veröffentlichte und offene Ereignisse.
- `docker compose exec api python manage.py shell -c "from realtime.models import OutboxEvent; print(OutboxEvent.objects.filter(published_at__isnull=True).count())"`
  nennt den Rückstand. Ein dauerhaft steigender Wert deutet auf Redis.
- `docker compose restart api relay` hilft nach Konfigurationsänderungen.
- Der WebSocket braucht die Proxy-Route `/ws/` mit Upgrade-Headern. Ohne sie
  antwortet der Browser mit einem fehlgeschlagenen Handshake.
- `stage.result` mit `status: rejected` nennt den Grund. Häufig ist die
  Verbindung nicht mehr die Leitung oder die Generation veraltet.
- Ein leerer Snapshot beim Start bedeutet: Die Setlist hat keinen Song. Pausen
  und Notizen allein starten keine Bühnensitzung.

## Release und Update

Veröffentlichte Images liegen in der GitHub Container Registry:

- `ghcr.io/qftm-de/setlist-pro-live-sync/web`
- `ghcr.io/qftm-de/setlist-pro-live-sync/api`

Ein Tag `v0.1.0` erzeugt die Tags `0.1.0`, `0.1` und `sha-<kurz>`. Das
Release-Compose pinnt die volle Version, damit ein Pull reproduzierbar bleibt.

```bash
# einmalig anmelden, persönlichen Token mit read:packages verwenden
echo "$GHCR_TOKEN" | docker login ghcr.io -u <github-name> --password-stdin

# Images ziehen und ohne lokalen Build starten
docker compose -f docker-compose.release.yml pull
docker compose -f docker-compose.release.yml up -d --no-build

# Update: neue Version in docker-compose.release.yml eintragen, dann
docker compose -f docker-compose.release.yml pull
docker compose -f docker-compose.release.yml up -d --no-build
```

Für einen Rollback die vorherige Version in `docker-compose.release.yml`
eintragen, erneut `pull` und `up -d --no-build` ausführen. Vor einem Rollback
über eine Migration hinweg die Datenbank sichern. Fehlt ein Image, scheitert
`pull` sichtbar und der laufende Stand bleibt unverändert.
