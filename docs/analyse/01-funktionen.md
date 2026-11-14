# Funktionsanalyse: Setlist Pro V4.5l

Stand: 13.11.2026. Grundlage ist `alte_projektdatein/index.html`, gelesen am 13.11.2026. Die App nennt sich selbst „SETLIST PRO LIVE SYNC“, im Footer steht „V4.5l Footswitch PDF“.

## 1. Worum es geht

Die Alt-App ist eine installierbare Web-App für Bands. Sie verwaltet Mitglieder, Songs und Setlists und zeigt auf der Bühne eine helle „PDF“-Seite mit Songtext und Akkorden. Alles läuft im Browser. Es gibt keinen Server, keine Anmeldung und keine Synchronisierung zwischen Geräten.

Zielgruppe im Ist: eine einzelne Band auf einem Gerät. Die App ist ein Prototyp, kein Mehrbenutzerprodukt.

Die Alpha-Daten im Firebase-Projekt haben ein anderes Modell: Mitglieder mit IDs und Rollen, Setlists im Banddokument, Annotationen, eine Live-Session und eine PDF als Base64. Diese Analyse beschreibt den Prototyp. Der Alpha-Bestand steht in `03-firebase-ist.md`.

## 2. Technischer Aufbau

| Punkt | Befund |
|---|---|
| Datei | `index.html`, 216.694 Zeichen, 143 Zeilen |
| Framework | React 18, minifiziert, inline, rund 143 KB |
| App-Code | rund 49 KB in einer Komponente `Bi`, 41 `useState`-Hooks |
| Styles | rund 19 KB Tailwind inline, dazu zwei nachträgliche CSS-Blöcke |
| Zusatzskripte | Link-Interceptor, Service-Worker-Registrierung, zwei Mobile-Fixer |
| DOM-Fixer | `setInterval(fixMembers, 1000)` ändert das Layout im Sekundentakt |
| Abhängigkeiten | keine zur Laufzeit außer Google Fonts per `@import` |
| Speicher | `localStorage`, kein IndexedDB, kein Cache für Daten |
| Build | keiner, alles in einer Datei |

Die Datei ist nicht wegen ihrer Größe unwartbar. Sie ist unwartbar, weil zwei CSS-Patches und zwei DOM-Fixer über den React-Code gelegt wurden, statt die Ursache im Layout zu beheben.

## 3. Einstieg und Bands

### 3.1 Startansicht

Drei Karten:

- **Band erstellen**: neue Band mit Code.
- **Band beitreten**: mit vorhandenem Code.
- **Bands verwalten**: lokale Bands löschen.

Dazu ein Hero „Deine Band. Deine Setlist.“ und der Satz „Verwalte Songs, Setlists und Mitglieder, offline, live-sync fähig, performance ready.“ Im Header steht immer ein grüner LIVE-Punkt. Er hängt an keinem Zustand.

Beleg: Ansicht `start` ab Offset 178290, Header bei Offset 176823, Footer bei Offset 213549.

### 3.2 Band erstellen

Felder: Bandname, eigener Name, Instrument, Band-Passwort. Der Code wird zufällig als sechsstelliger String erzeugt. Der Ersteller wird Mitglied mit Rolle „Admin“.

Wichtig: Das Feld „Band Passwort“ setzt kein eigenes Passwort. Der eingegebene Wert muss exakt dem fest eingebauten Wert entsprechen. Der Wert steht im Client und wird hier nicht wiederholt. Danach wird genau dieser Wert als Bandpasswort gespeichert. Ein selbst gewähltes Passwort ist nicht möglich.

Beleg: `yd()` bei Offset 171127.

### 3.3 Band beitreten

Felder: Code, Name. Der Name muss exakt zu einem vorhandenen Mitglied passen, Groß- und Kleinschreibung ist egal. Gibt es die Band lokal nicht, erzeugt die App für jeden sechsstelligen Code eine Phantom-Band mit festem Platzhalter-Namen und Demo-Mitgliedern. Danach muss der Name zu diesen Demo-Mitgliedern passen.

Damit ist der Code kein Geheimnis und keine Zugangskontrolle. Er wählt nur einen lokalen Datensatz aus.

Beleg: `md()` bei Offset 171841.

### 3.4 Bands verwalten

Passwortfeld, danach Liste der lokal bekannten Bands mit „Delete“. Das Passwort ist wieder dasselbe fest eingebaute Passwort.

Beim Löschen entfernt die App den Eintrag aus zwei Listen. Die Schlüssel `members_{code}`, `songs_{code}`, `setlists_{code}` und `current_user_{code}` bleiben im Speicher liegen. Es entstehen verwaiste Daten.

Beleg: `gd()` bei Offset 172784, `kd()` bei Offset 172868.

### 3.5 Demo-Daten

Beim ersten Start existieren:

- Band `BAND-B`, Demo-Band mit festem Platzhalter-Namen im Client.
- Sechs Demo-Mitglieder mit fester Vornamenliste im Client. Die Namen gehören nicht ins Repo.
- Vier Songs: Wonderwall (Test), Let It Be, Blinding Lights, Creep.
- Drei Setlists: Test, Live @ Kulturbrauerei, Acoustic Set.

Das Datum `12.05.2024` steht fest im Code. Es gehört zu keinem Datenmodell.

## 4. Ansichten

### 4.1 Übersicht

Inhalt:

- Bandkarte mit Name, Code, festem Datum, angemeldetem Mitglied.
- Zwei Aktionen: „Offline verfügbar machen“ und „Alle PDFs als Ordner herunterladen“.
- Vier Kennzahlen: Mitglieder, Songs, Setlists, Gesamtzeit.
- Setlist-Liste mit Öffnen-Button.
- Mitgliederliste, auf Desktop rechts.

Ist-Zustand:

- „Offline verfügbar machen“ setzt ein lokales Flag und zeigt zwei Sekunden „Offline bereit!“. Der Service Worker läuft ohnehin immer. Der Knopf ändert nichts.
- „Alle PDFs als Ordner herunterladen“ öffnet nur einen Alert mit einem Mock-Hinweis.
- Auf 390 px Breite bricht der Header um. Der Titel steht zweizeilig, der Zurück-Knopf rutscht darunter, die Kopfzeile ist zu niedrig.
- Das Datum ist fest verdrahtet.

Belege: Übersicht ab Offset 180829, Offline `wd()` bei Offset 172966, Download `Ed()` bei Offset 173054. Screenshots: `03-overview.png`, `08-overview-desktop.png`.

### 4.2 Songs

Inhalt:

- Formular: Titel, Tonart, BPM, Dauer, Notizen, PDF-Datei, Speichern.
- Button „Test PDF 3 Seiten“, legt einen Demo-Song an.
- Suche über den Titel.
- Liste mit Tonart, BPM, Dauer, Seitenzahl, „PDF ansehen“ und Löschen.

Ist-Zustand:

- Songs lassen sich anlegen und löschen. Bearbeiten geht nicht.
- „PDF ansehen“ hat keinen Klick-Handler. Der Knopf tut nichts.
- Der Datei-Input für PDFs hat keinen Handler. Es wird nichts gelesen und nichts gespeichert.
- Beim Löschen entfernt die App den Song aus allen Setlists. Das ist korrekt umgesetzt.
- Die Seitenzahl ist immer 3, außer bei den Demo-Songs.

Belege: `Cd()` bei Offset 173465, `Nd()` bei Offset 173736, toter Button bei Offset 192718. Screenshot: `04-songs.png`.

### 4.3 Setlists

Inhalt:

- Neue Setlist mit Namen anlegen.
- Setlist auswählen.
- Songs hinzufügen und entfernen.
- Gesamtdauer und Songanzahl.
- Buttons „Performance“ und „Live Sync Starten“.
- Song-Suche innerhalb der Setlist.

Ist-Zustand:

- Anlegen, Auswählen, Hinzufügen und Entfernen funktionieren.
- **Umsortieren fehlt.** Eine Setlist ist eine Reihenfolge. Die App kann sie nicht ändern.
- Umbenennen und Löschen einer Setlist fehlen.
- „Live Sync Starten“ öffnet denselben Performance-Modus wie „Performance“, nur mit einem zusätzlichen roten LIVE-Abzeichen. Es gibt keinen Netzwerkaufruf, kein `BroadcastChannel`, kein `WebSocket`.
- Die Gesamtdauer wird aus `durationSec` summiert.

Belege: `zd()` bei Offset 173849, `Ld()` und `Td()` bei 173969 und 174079, `Rd()` und `Od()` bei 174169 und 174228. Screenshot: `05-setlists.png`.

### 4.4 Members

Inhalt:

- Neues Mitglied: Name, Instrument, Rolle.
- Liste mit editierbarem Namen, Instrument-Select, Rollen-Select, DU-Markierung und Löschen.

Ist-Zustand:

- Anlegen, Bearbeiten und Löschen funktionieren lokal.
- Jeder darf jede Rolle setzen. Die Rolle wird nirgends geprüft.
- Auf 390 px läuft die Zeile rechts aus dem Bild. Die Rollen-Auswahl ist abgeschnitten. Der Mobile-Fixer versucht das mit `setInterval` zu reparieren.
- Die Instrumente sind fest: Voc, Git, Bass, Dr, Keys, Gast.

Belege: `_d()` bei Offset 173161, `wu()` bei 173311, `Sd()` bei 173418. Screenshot: `06-members.png`.

### 4.5 Performance

Inhalt:

- Helle „PDF“-Seite mit Titel, Tonart, Dauer, Songtext und Akkorden.
- Kopfzeile: Seitenzähler, „+ Pin“, Auge, Schließen.
- Fußzeile: Songliste, Zurück/Weiter.
- Tastatur und Fußschalter: PageDown, PageUp, Pfeiltasten, Leertaste, Enter, n/p, b.
- Sechs Zustände: Songwechsel, Seitenwechsel, Zoom, Pin-Modus, Pin-Editor, Live-Abzeichen.

Ist-Zustand:

- Seitenwechsel und Songwechsel funktionieren.
- Der Seiteninhalt ist ein fester Mock mit dem Text von „Wonderwall“. Jeder Song zeigt denselben Text. Die Seitenzahl kommt aus dem Song, der Inhalt nicht.
- Der Zoom ist im Code vorhanden, in der mobilen Ansicht aber nicht sichtbar.
- Pins lassen sich per Shift-Klick oder Pin-Modus setzen.
- Das rote LIVE-Abzeichen erscheint nur, wenn man über „Live Sync Starten“ hineingeht. Es bedeutet nichts.

Belege: Performance-View ab Offset 197066, Tastaturlogik bei Offset 169786, Pins `Md()` bei 174598. Screenshot: `07-performance.png`.

### 4.6 Pin-Editor

Inhalt:

- Textarea für den Pin-Text.
- Hintergrund- und Textfarbe aus festen Paletten.
- Größe 10 bis 32 px.
- Vorschau.
- Speichern und Löschen.

Ist-Zustand:

- Der Editor funktioniert.
- Pins werden global unter `pins_v45` gespeichert.
- Beim Speichern und Löschen schreibt die App zusätzlich unter `pins_{code}_{songId}`. Dieser Schlüssel wird beim Laden nie gelesen. Die Daten dort sind tote Kopien.
- Im UI stehen Versionsnotizen wie „V4.5k: Pin Unlimited Width“ und „V4.5l: Fußschalter hinzugefügt“. Entwicklertexte stehen im Produkt.

Belege: `Ut()` bei Offset 174997, `Vd()` bei 175072, `Ud()` bei 175417, Versionsnotizen bei Offset 208187.

## 5. Datenmodell

### 5.1 Entitäten

**Band**

| Feld | Typ | Pflicht | Anmerkung |
|---|---|---|---|
| `code` | String, 6 Zeichen | ja | zufällig erzeugt, lokal |
| `name` | String | ja | frei |
| `pw` | String | ja | immer derselbe fest eingebaute Wert |

**Mitglied**

| Feld | Typ | Pflicht | Anmerkung |
|---|---|---|---|
| `id` | String | ja | `Date.now()` |
| `name` | String | ja | frei editierbar |
| `instrument` | Enum | ja | Voc, Git, Bass, Dr, Keys, Gast |
| `role` | Enum | ja | Admin, Member, Gast |
| `letter` | String | ja | erster Buchstabe des Namens |

**Song**

| Feld | Typ | Pflicht | Anmerkung |
|---|---|---|---|
| `id` | String | ja | `s` plus Zeitstempel |
| `title` | String | ja | frei |
| `key` | String | nein | Standard `C` |
| `bpm` | String | nein | Standard `100`, keine Zahl |
| `duration` | String | nein | `m:ss`, Standard `3:57` |
| `durationSec` | Number | ja | berechnet |
| `notes` | String | nein | frei |
| `pdfPages` | Number | ja | Standard 3 |

**Setlist**

| Feld | Typ | Pflicht | Anmerkung |
|---|---|---|---|
| `id` | String | ja | `sl` plus Zeitstempel |
| `name` | String | ja | frei |
| `songIds` | String[] | ja | Reihenfolge, nicht sortierbar |

**Pin**

| Feld | Typ | Pflicht | Anmerkung |
|---|---|---|---|
| `id` | String | ja | `pin` plus Zeitstempel |
| `x`, `y` | Number | ja | Prozent der Seite |
| `text` | String | ja | mehrzeilig |
| `bg`, `fg` | String | ja | Hex-Farben |
| `size` | Number | ja | 10 bis 32 |
| `page` | Number | ja | Seite im Song |
| `songId` | String | ja | Zuordnung |

### 5.2 Speicherorte

| Schlüssel | Inhalt | Gelesen | Geschrieben |
|---|---|---|---|
| `local_bands_v2` | selbst angelegte Bands | ja | ja |
| `recent_bands_v2` | letzte sechs Bands | ja | ja |
| `currentBandCode` | aktive Band | ja | ja |
| `members_{code}` | Mitglieder | ja | ja |
| `songs_{code}` | Songs | ja | ja |
| `setlists_{code}` | Setlists | ja | ja |
| `current_user_{code}` | angemeldetes Mitglied | ja | ja |
| `pins_v45` | alle Pins | ja | ja |
| `pins_{code}_{songId}` | Pins pro Song | nein | ja |
| `offline_{code}` | Offline-Flag | nein | ja |

## 6. Persistenz und Lebenszyklus

- Beim Bandwechsel liest die App die Schlüssel der Band. Fehlt ein Schlüssel, setzt sie Demo-Daten ein.
- Schreibvorgänge laufen über `useEffect` und `JSON.stringify`.
- Fehler beim Lesen werden mit `catch {}` verschluckt. Ein kaputter Eintrag führt still zu Demo-Daten.
- Die Speicherquote wird nicht geprüft. Ein voller Speicher führt zu einer Exception, die App bleibt stehen.
- Es gibt keinen Export, keinen Import und keine Sicherung.
- Browserdaten löschen heißt Datenverlust.
- Zwei Tabs überschreiben sich gegenseitig, es gibt kein `storage`-Event.

## 7. Rollen und Rechte

Die Rollen Admin, Member und Gast sind reine Etiketten. Es gibt im ganzen Code keine Prüfung auf `role`. Jeder kann:

- jede Rolle an jedes Mitglied vergeben,
- Mitglieder löschen,
- Songs löschen und Setlists verändern,
- die Band über das Passwort „verwalten“.

Der einzige Gate ist das global bekannte Passwort. Es steht im Client und ist damit kein Geheimnis.

## 8. Ist-Reifegrad

| Funktion | Status | Beleg | Anmerkung |
|---|---|---|---|
| Band lokal erstellen | echt | `yd()` | Passwort ist fest verdrahtet |
| Band beitreten | echt, aber wirkungslos als Schutz | `md()` | Name muss zu Mitglied passen |
| Bands verwalten | teilweise | `gd()`, `kd()` | löscht Datenreste nicht |
| Mitglieder anlegen, ändern, löschen | echt | `_d()`, `wu()`, `Sd()` | keine Rechteprüfung |
| Songs anlegen, löschen | echt | `Cd()`, `Nd()` | kein Bearbeiten |
| Songs suchen | echt | Suchfilter | nur Titel |
| Song als PDF ansehen | kaputt | toter Button | kein Handler |
| PDF hochladen | nicht vorhanden | Datei-Input ohne Handler | nichts wird gespeichert |
| Setlist anlegen | echt | `zd()` | kein Umbenennen, kein Löschen |
| Setlist befüllen | echt | `Ld()`, `Td()` | kein Umsortieren |
| Performance anzeigen | teilweise | Performance-View | Inhalt ist ein fester Mock |
| Seiten blättern | echt | `ya()`, `ma()` | funktioniert |
| Song wechseln | echt | `Cv()`, `Nv()` | funktioniert |
| Zoom | echt | `Dd()`, `Pd()`, `Id()` | vorhanden, versteckt |
| Pins setzen und bearbeiten | teilweise | `Md()`, `Ut()` | Speicherung inkonsistent |
| Fußschalter | echt | Tastaturlogik | PageDown, PageUp, Space, Enter |
| Live Sync | Attrappe | `Od()` | kein Netzwerk |
| Offline | Attrappe | `wd()` | Flag ohne Wirkung |
| Alle PDFs herunterladen | Attrappe | `Ed()` | Alert |
| Firebase | nicht vorhanden | kein `firebase` im Code | Footer sagt selbst „Firebase mock“ |
| Auftritte | nicht vorhanden | keine View, kein Feld | README behauptet es |
| Mehrgeräte | nicht vorhanden | kein Server | Daten pro Browser |

## 9. Fehlende Funktionen trotz Ankündigung

- **Auftritte**: Es gibt keine Termine, Orte, Gagen oder Auftrittslisten. Der README nennt sie trotzdem.
- **Echte PDFs**: weder Upload noch Anzeige.
- **Synchronisierung**: weder zwischen Geräten noch zwischen Tabs.
- **Anmeldung**: keine Konten, keine Einladungen, keine Sitzungen.
- **Rechte**: keine Rolle hat Wirkung.
- **Setlist-Pflege**: kein Umsortieren, kein Umbenennen, kein Löschen.
- **Song-Pflege**: kein Bearbeiten.
- **Sicherung**: kein Export, kein Import, kein Backup.
- **Datenschutz**: keine Information, keine Löschfunktion für alle Daten, Google Fonts ohne Hinweis.

## 10. Produktfragen für den Neubau

1. Ist die Reihenfolge der Setlist das Kernstück? Wenn ja, muss Umsortieren rein, inklusive Ziehen am Handy.
2. Braucht die Band echte PDFs oder reichen Akkordblätter mit Text und Akkorden?
3. Nutzen mehrere Mitglieder eigene Geräte? Dann braucht es Konten und Sync.
4. Wer darf Songs anlegen, wer nur spielen?
5. Braucht es Auftritte mit Datum, Ort und Gage?
6. Sollen Pins pro Song und Seite bleiben?
7. Ist der Fußschalter ein Muss? Die Alt-App kann PageDown und PageUp.
8. Muss die App ohne Netz starten und spielen?
9. Braucht es Export und Backup?
10. Eine Band oder viele Bands pro Installation?
11. Nur Deutsch oder Deutsch und Englisch?
12. Bühnenansicht: Text, Akkorde, Noten oder PDF?
13. Welche Daten dürfen auf einen Server, welche bleiben lokal?
14. Wer hostet und wer zahlt?
15. Was passiert mit den Alpha-Daten?

## 11. Methode und Belege

- Statische Extraktion aus dem Bundle. Funktionsnamen sind minifiziert, die Offset-Angaben beziehen sich auf `index.html`.
- Screenshots mit `docs/analyse/tools/analyse-screens.mjs`, aufgenommen in headless Chrome, 390 × 844 und 1280 × 800.
- Die Screenshots liegen unter `docs/analyse/screens/`.
- Wegen der Minifizierung sind einzelne Zustandsnamen schwer zuzuordnen. Wo ich unsicher bin, steht das im Text.

## 12. Sicherheit

Die Sicherheits- und Datenschutzbefunde stehen getrennt in `docs/analyse/02-sicherheit.md`. Kurzfassung: Es gibt kein Sicherheitsmodell, nur ein fest eingebautes Passwort und lokal gespeicherte Daten.
