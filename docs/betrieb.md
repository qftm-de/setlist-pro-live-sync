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
