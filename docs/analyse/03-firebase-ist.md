# Firebase-Bestand: gelesen am 13.11.2026

Dieses Dokument beschreibt den tatsächlichen Stand der Alt-App. Die Daten wurden einmalig lesend abgerufen. Es gab keine Schreib-, Lösch- oder Regeländerung.

## 1. Status

- Firestore war ohne Anmeldung lesbar. Ein GET mit dem Web-API-Key genügte.
- Gelesen: 4 Bands, 9 Mitgliedseinträge, 7 Songs, 2 Setlists, 9 Annotationen, 1 PDF.
- Storage ließ sich nicht auflisten. Der Aufruf endete mit HTTP 403.
- Die Rohdaten liegen in einem lokalen, gitignorierten Ordner. Nichts davon ist im Repo.
- Die einzige PDF wurde lesend heruntergeladen und lokal geprüft.

## 2. Methode

- Firestore-REST-API, nur GET.
- Kein Auth-Token, nur der Web-API-Key aus dem lokalen Log.
- Keine Schreibmethode, kein Löschen, keine Regeländerung.
- Die PDF wurde über die im Dokument hinterlegte Data-URI geladen.
- Personenbezogene Werte werden hier nicht wiedergegeben. Die Rohdaten bleiben lokal.

## 3. Bestand

| Code | Name | Mitglieder | Songs | Setlists | Besonderheit |
|---|---|---|---|---|---|
| `BAND-A` | Garage | 1 | 0 | 0 | altes Schema, kein `createdAt` |
| `BAND-B` | Test | 5 | 6 | 1 | Live-Session, eine PDF |
| `BAND-C` | Test2 | 1 | 0 | 0 | Klartextfeld `pw` |
| `BAND-D` | Garagenband | 2 | 1 | 1 | neues Schema |

Summen: 4 Bands, 9 Mitgliedseinträge, 7 Songs, 2 Setlists, 9 Annotationen, 1 PDF.

Die Daten sind fast vollständig Testmaterial. Es gibt keine Band mit einer mehrsätzigen Setlist.

## 4. Zwei Schemata in einer Collection

Die Bands wurden zu unterschiedlichen Zeiten angelegt. Die Struktur ist nicht einheitlich.

**Altes Schema** (`BAND-A`, `BAND-C`):

- Bandfelder: `code`, `name`, `created`, `members`.
- Mitglieder: `name`, `inst`.
- Keine IDs, keine Rollen, keine `joinedAt`.
- `BAND-C` hat zusätzlich `pw`.

**Neues Schema** (`BAND-B`, `BAND-D`):

- Bandfelder: `code`, `name`, `createdAt`, `members`, `songs`, `setlists`, optional `liveSession`.
- Mitglieder: `id`, `name`, `instrument`, `role`, `joinedAt`.
- Songs: `id`, `title`, `key`, `bpm`, `duration`, `durationSec`, `notes`, `pdfUrl`, `pdfName`, `annotations`, `addedBy`, `createdAt`.
- Setlists: `id`, `name`, `songIds`, `createdAt`.
- Annotationen: `id`, `text`, `x`, `y`, `page`, `color`, `bgColor`, `textColor`, `fontSize`.

Die Banddokumente enthalten alles: Mitglieder, Songs, Setlists und Live-Zustand. Es gibt keine Subcollections.

## 5. PDFs

Es gibt genau eine echte PDF:

| Punkt | Wert |
|---|---|
| Band | `BAND-B` Test |
| Song | `1233` |
| Dateiname | `untitled.pdf` |
| Größe | 416.241 Bytes |
| Seiten | 8 |
| Inhalt | Produktdatenblatt für ein Sicherheitsrelais, kein Setlist-Dokument |
| Ablage | Base64-Data-URI im Feld `pdfUrl`, nicht in Storage |

Das Feld `pdfUrl` enthält keinen Link, sondern `data:application/pdf;base64,...` mit 555.016 Zeichen. Das Banddokument `BAND-B` ist dadurch 564.692 Bytes groß. Firestore erlaubt 1 MiB pro Dokument. Eine zweite PDF dieser Größe würde das Dokument über die Grenze treiben.

Alle anderen Songs haben `pdfUrl: ""` und `pdfName: ""`.

Der Storage-Bucket ließ sich nicht auflisten. Es kann dort verwaiste Dateien geben. Das ist offen.

## 6. Setlists

Es gibt zwei Setlists, beide mit genau einem Song:

| Band | Setlist | Songs |
|---|---|---|
| `BAND-B` | `123` | 1 |
| `BAND-D` | `Bauernmarkt` | 1 |

Die Setlist `123` verweist auf einen Song, der versehentlich einen Personennamen als Titel trägt. Der Name wird hier nicht wiedergegeben. `Bauernmarkt` verweist auf den Song `Test1`.

Für einen Umzug gibt es also kaum Setlist-Daten zu retten. Die Struktur ist trotzdem wichtig, weil sie zeigt, wie die Alpha Setlists denkt: eine Liste von Song-IDs, eingebettet im Banddokument.

## 7. Live-Session

`BAND-B` hat ein Feld `liveSession`:

- `active: false`
- `currentSongId`, `currentIndex`, `page`, `scrollY`, `isScrolling`
- `sessionId`, `setlistId`, `setlistName`
- `startedAt`, `startedBy`, `startedByName`
- `lastAction`

Die Alpha hat ein Live-Session-Dokument. Ob die App es wirklich live liest und schreibt, ist ohne V12-Code nicht bewiesen. Der Prototyp im Ordner hat nur einen Knopf ohne Netzwerk. Das ist ein Funktionsunterschied zwischen den beiden Ständen.

## 8. Sicherheit

**Firestore ist ohne Anmeldung lesbar.** Das ist der wichtigste Befund. Jeder mit der Projekt-ID kann Bands, Mitglieder, Songs, Setlists, Annotationen und die PDF lesen. Ein Web-API-Key ist öffentlich. Die Projekt-ID ist erratbar.

**Eine Band hat ein Klartextfeld `pw`.** Der Wert wird hier nicht gezeigt. Ein Passwort gehört nicht in ein lesbares Dokument.

**Die PDF ist Teil desselben öffentlichen Dokuments.** Sie ist damit ebenfalls abrufbar.

**Schreibzugriff wurde nicht getestet.** Ob die Regeln auch Schreiben erlauben, ist offen. Ich habe bewusst keine Schreibanfrage gestellt.

Empfehlung, in dieser Reihenfolge:

1. Firestore-Regeln sofort auf Anmeldung beschränken.
2. Danach auf Mitgliedschaft pro Band prüfen, nicht nur auf Anmeldung.
3. Das Feld `pw` entfernen und das Passwort rotieren.
4. PDFs aus dem Dokument nehmen und in Storage mit Regeln ablegen.
5. Den API-Key auf die erlaubten Domains und APIs einschränken.
6. App Check aktivieren.

Die Alpha darf dabei nicht kaputtgehen. Deshalb ist das eine Aufgabe für den Kollegen mit Zugriff auf die Konsole.

## 9. Bewertung für den Neubau

Die Datenlage ist dünn: vier Bands, zwei Setlists mit je einem Song, sieben Songs, davon mehrere Testtitel. Ein aufwendiger Datenumzug lohnt nicht. Ein Export als Referenz reicht.

Das Modell taugt nicht als Vorlage:

- Alles liegt in einem Dokument pro Band.
- PDFs liegen als Base64 im Dokument und sprengen bald das Limit.
- Zwei Schemata nebeneinander.
- Setlists sind eingebettete Arrays ohne Positionstabelle.
- Ein Passwort liegt im Klartext.

Vorschlag für das Zielmodell:

| Heute | Künftig |
|---|---|
| `bands/{code}` | `bands` mit `id`, `name`, `invite_code`, `created_at` |
| `members` im Banddokument | `memberships` mit `band_id`, `user_id`, `role`, `instrument`, `joined_at` |
| `songs` im Banddokument | `songs` mit `band_id`, `title`, `key`, `bpm`, `duration_sec`, `notes` |
| `setlists` im Banddokument | `setlists` und `setlist_songs` mit `position` |
| `annotations` im Song | `annotations` mit `song_id`, `page`, `x`, `y`, `text`, `style` |
| `liveSession` im Banddokument | `live_sessions` mit `band_id`, `setlist_id`, `song_id`, `page`, `started_by`, `updated_at` |
| `pdfUrl` als Data-URI | `files` mit `song_id`, `storage_key`, `mime`, `size`, `checksum` |

## 10. Was nicht gemacht wurde

- Keine Schreib-, Änderungs- oder Löschoperation.
- Keine Regeländerung.
- Keine Auflistung des Storage-Buckets. Der Aufruf war 403.
- Kein vollständiger Download des Buckets.
- Keine personenbezogenen Werte in diesem Dokument.

## 11. Offene Punkte

1. Regeln schließen, zuerst Anmeldung, dann Mitgliedschaft.
2. Passwort rotieren und `pw` entfernen.
3. API-Key einschränken.
4. Storage prüfen, falls dort verwaiste PDFs liegen. Dafür braucht es Leserechte.
5. V12-Datei besorgen, um den Schreibpfad zu verstehen.
6. Entscheiden, ob die Testdaten mitkommen. Meine Empfehlung: nein, nur als Referenz behalten.

## 12. Belege

- Lesezeitpunkt: 13.11.2026, Nachmittag.
- Rohdaten: lokaler, gitignorierter Ordner mit JSON- und CSV-Dateien.
- PDF: lokaler Ordner; der Dateiname enthält den alten Bandcode.
- Paket: lokale ZIP-Datei.
- Alle Angaben stammen aus dem Firestore-REST-Lesesaufruf. Es wurden keine Werte erfunden oder ergänzt.
