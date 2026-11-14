# Markenanalyse und Markenentwurf

Stand: 13.11.2026. Grundlage sind die Alt-App, die Screenshots unter `docs/analyse/screens/` und eine kurze Marktrecherche. Ziel ist keine Agentur-Präsentation, sondern eine Entscheidungsgrundlage für eine kleine Band-App.

## 1. Rahmen

Die App ist für die eigene Band und befreundete Bands gedacht. Wachstum ist zweitrangig. Die Marke darf persönlich, direkt und bandnah sein. Sie muss nicht auf Englisch funktionieren und nicht wie ein Start-up aussehen.

Trotzdem braucht sie Klarheit. Die Alt-App verspricht Dinge, die sie nicht hält. Das ist kein Marketingproblem, das ist ein Vertrauensproblem.

## 2. Ist-Aufnahme

### 2.1 Namen und Titel

| Ort | Name |
|---|---|
| Repository | `setlist-pro-live-sync` |
| Manifest | „Setlist Pro V4.1“ |
| App-Header | „SETLIST PRO LIVE SYNC“ |
| App-Footer | „V4.5l Footswitch PDF“ |
| Browser-Titel | „React Artifact“ |
| Projekt-Log | „Band Commander“, Projekt-ID nicht im Repo |
| Demo-Band | fester Platzhalter-Name im Client |
| Monogramm | „SP“ |

Vier Namen für ein Produkt. Keiner davon ist eine Marke. „Setlist Pro“ ist eine Gattungsbezeichnung mit „Pro“-Anhang. „Band Commander“ klingt nach Militär und Software von 2005. „React Artifact“ ist ein Werkzeugtitel.

### 2.2 Farben und Typografie

| Element | Ist |
|---|---|
| Signal | `#ff6a00`, kräftiges Orange |
| Grund | `#09090b`, fast Schwarz |
| Flächen | Zinc 800 bis 950, `#111113`, `#151518` |
| Papier | `#f0f0f0` in der Bühnenansicht |
| Live | Rot und Grün als Statusfarben: red-500/600, emerald-400, green-400 |
| Schrift | Inter 400 bis 800, JetBrains Mono 500 |
| Form | Runde Ecken, viel Schwarz, wenig Weiß, orangefarbene Aktionen |

Das Orange ist die stärkste Zutat. Es funktioniert auf Schwarz und als Marker auf Papier. Die Bühnenansicht mit dem weißen Blatt ist das beste Bild der ganzen App. Darauf lässt sich eine Marke bauen.

Die Grautöne sind für Bühnenlicht zu schwach. `#71717a` auf `#09090b` kommt auf etwa 4,1:1. Für kleine Texte ist das unter dem Richtwert von 4,5:1.

### 2.3 Sprache

Ist-Merkmale:

- Deutsch, Anrede Du.
- Englische Versatzstücke: „Overview“, „Members“, „Setlists“, „Performance“, „LIVE SYNC“, „Performance ready“, „Footswitch PDF“.
- Großbuchstaben-Labels in Versalien.
- Emojis als Icons: ➕, 👥, ⚙️, 📦, 📁, 📅, 👁️.
- Gedankenstriche mitten im Satz.
- Entwicklernotizen im Produkt: „V4.5k: Pin Unlimited Width“, „V4.5l: Fußschalter hinzugefügt“, „Firebase mock“.
- Versprechen, die nicht stimmen: „live-sync fähig“, „LIVE“ ohne Live-Sitzung.

Die Stimme ist die eines Entwicklers, nicht die einer Band.

### 2.4 Bildmarke

- Das „SP“-Monogramm ist generisch.
- Die Icons sind JPEG-Dateien mit `.png`-Endung.
- `logo.webp` ist ein JPEG mit 1920 × 1280 und 140 KB.
- Icons liegen doppelt: `icon-192.png` und `icon-192-v2.png` sind identisch, ebenso bei 512.
- Das maskable Icon läuft bis an den Rand. Android beschneidet es im Kreis.
- Es gibt kein Vektorlogo.

## 3. Versprechen und Wirklichkeit

| Versprechen | Wirklichkeit |
|---|---|
| „LIVE SYNC“ im Header | Kein Netzwerk, kein Sync, kein `BroadcastChannel` |
| „live-sync fähig“ | Nur ein Etikett |
| „performance ready“ | Bühnenansicht ist ein fester Mock |
| „PDF ansehen“ | Button ohne Handler |
| „Alle PDFs herunterladen“ | Alert mit Mock-Hinweis |
| „Band Passwort“ | Fest eingebautes Passwort, keine Wahl |
| „Firebase“ | Footer sagt selbst „Firebase mock“ |
| „Auftritte“ im README | Keine Auftrittsfunktion |

Eine Marke, die das oft genug macht, wird nicht geglaubt. Der erste Schritt zur Marke ist, nur das zu versprechen, was die App kann.

## 4. Zielgruppe

**Kern**: die eigene Band und befreundete Bands. Drei bis sechs Leute, Hobby bis Halbprofi, ein bis vier Auftritte im Monat.

**Situation**:

- Probe im Keller, Auftritt im Club, Hochzeit, Stadtfest.
- Handy oder Tablet auf dem Notenständer.
- Dunkles Licht, laute Umgebung, wenig Zeit.
- Kein WLAN, oft schlechtes Netz.
- Gitarristen und Bassisten treten Fußschalter.
- Die Setlist liegt heute oft auf Papier oder in einer Notiz-App.

**Aufgaben**:

1. Setlist für die nächste Probe oder den nächsten Auftritt bauen.
2. Die Reihenfolge kurz vor dem Auftritt ändern.
3. Auf der Bühne Text und Akkorde sehen, ohne zu blättern.
4. Notizen an eine Stelle schreiben.
5. Wissen, wie lang die Setlist ist.
6. Die Band verwalten, ohne ein zweites Tool.

**Frustpunkte**:

- Papier ist starr und geht verloren.
- Große Apps sind Abos und überladen.
- PDFs auf dem Handy sind fummelig.
- Kein Netz auf der Bühne.
- Jeder hat ein anderes Gerät.

## 5. Wettbewerb

Kurz und ohne Vollständigkeitsanspruch:

| Produkt | Preis | Plattform | Stärke | Schwäche für unsere Zielgruppe |
|---|---|---|---|---|
| BandHelper | 40 bis 80 $ pro Jahr für 2 bis 5 Leute | iOS, Android, Mac, Web | Setlists, Akkorde, Termine, Geld, Fußschalter | Groß, englisch, Abo, viel Funktionsumfang |
| OnSong | 29,99 bis 59,99 $ pro Jahr | Apple | Charts, Annotationen, Bühnensteuerung | Nur Apple, Abo |
| SetBook | 99 $ pro Jahr | iOS, Web | Gigs, Einladungen, Zahlungen | Teuer, Terminlastig |
| Setlist Helper | 17,99 € einmalig | iOS, Android, Web | Günstig, ohne Abo | Funktionsumfang, Synchronisierung |
| SetList Pro Music | App Store | iOS | Setlist-Fokus, bekannter Name | Namenskollision |
| Papier und Notizen | 0 € | überall | robust, schnell | keine Suche, kein Backup, keine Änderung |

Der Platz, der frei bleibt: eine kleine, deutsche, bühnenfeste App für eine Band. Ohne Abo, ohne Konto-Zwang, ohne Termin- und Finanzmodul.

Quellen: [Produser-Vergleich](https://produser.io/de/blog/playing-live/bandorganisation-setlist-apps-vergleich/), [Orphiq-Übersicht](https://orphiq.com/resources/setlist-maker-apps), [SetList Pro Music im App Store](https://apps.apple.com/pt/app/setlist-pro-music/id6751470024). Preise und Funktionslisten sind Anbieterangaben, Stand 13.11.2026.

## 6. Positionierung

**Satz**: Setzettel ist die Setlist-App für kleine Bands, die auf der Bühne funktioniert, auch ohne Netz.

**Werte**:

- **Bühnenfest**: groß, ruhig, lesbar, ohne Ablenkung.
- **Ehrlich**: nur Funktionen, die wirklich da sind.
- **Schnell**: drei Schritte bis zur Setlist, ein Griff bis zur nächsten Seite.

**Nicht**:

- kein Band-Management-System,
- kein Songwriting-Tool,
- kein soziales Netzwerk,
- kein PDF-Editor,
- keine Plattform für alle.

**Versprechen**: „Steht, wenn das Licht angeht.“

## 7. Namen

### 7.1 Kriterien

1. Merkbar in einer lauten Runde.
2. Sprechbar auf Deutsch, ohne Buchstabieren.
3. Bandnah, kein Software-Sprech.
4. Kollisionsarm bei Suche und App Stores.
5. Erweiterbar, falls später mehr dazukommt.

### 7.2 Drei Routen

**Route A: Das Ding beim Namen nennen**

- Setzettel
- Bandzettel
- Setkasten

**Route B: Das Gefühl**

- Zugabe
- Soundcheck
- Bühnenlicht

**Route C: Die Person**

- Beusti
- Beusti Musik

Route C funktioniert nur, wenn die Band wirklich Beusti heißt. Dann ist sie stark, weil sie echt ist.

### 7.3 Bewertung

Skala 1 bis 5.

| Name | Merkbar | Sprechbar | Bandnah | Kollisionsarm | Erweiterbar | Summe |
|---|---|---|---|---|---|---|
| **Setzettel** | 5 | 5 | 5 | 4 | 4 | **23** |
| Bandzettel | 4 | 5 | 5 | 4 | 4 | 22 |
| Zugabe | 4 | 5 | 4 | 2 | 4 | 19 |
| Setkasten | 4 | 4 | 4 | 4 | 3 | 19 |
| Soundcheck | 4 | 5 | 4 | 2 | 3 | 18 |
| Beusti | 5 | 5 | 5 | 4 | 2 | 21 |
| Setline | 4 | 4 | 2 | 3 | 5 | 18 |

### 7.4 Empfehlung

**Setzettel** als Arbeitsname. Es ist der Gegenstand, den die App ersetzt. Es ist deutsch, kurz, bildhaft und nicht mit einer großen App belegt. Als Claim passt „Die Setlist für die Bühne.“

Wenn die Band Beusti heißt und die App bewusst bandintern bleiben soll, ist **Beusti** die ehrlichere Route. Dann gehört der Name aber der Band, nicht dem Produkt.

„Setlist Pro“ würde ich fallen lassen. Der Name ist belegt und sagt nichts. „Band Commander“ ebenfalls: zu groß, zu militärisch, zu austauschbar.

Eine schnelle Suche zeigt keine offensichtliche Kollision für „Setzettel“. Das ist keine Markenrecherche. Vor einer Veröffentlichung braucht es eine Domain- und Markenprüfung.

## 8. Sprache

### 8.1 Grundsätze

- Deutsch, Anrede Du.
- Kurz. Ein Gedanke pro Satz.
- Verb zuerst bei Buttons: „Song anlegen“, „Setlist öffnen“, „Seite zurück“.
- Konkret statt Werbung: „Ohne Netz spielbar“ statt „offline-first“.
- Keine falschen Zustände. LIVE nur, wenn live.
- Keine Entwicklernotizen, keine Versionsnummern, keine „Mocks“.
- Keine Emojis als Icons. Icons sind Icons.
- Keine Gedankenstriche. Punkt, Komma oder Doppelpunkt.

### 8.2 Glossar

| Begriff | Entscheidung |
|---|---|
| Setlist | bleibt. Ist in Bands etabliert. |
| Setliste | nicht verwenden. |
| Song | bleibt. |
| Auftritt | statt „Gig“. |
| Probe | bleibt. |
| Zugabe | bleibt. |
| Mitglied | bleibt. |
| Tonart | bleibt. |
| BPM | bleibt, ist auf der Bühne üblich. |
| Notiz | statt „Pin“. |
| Bandcode | Einladungscode. |

### 8.3 Mikrotexte

**Start**

- „Deine Setlist. Fertig, wenn das Licht angeht.“
- „Songs, Setlists und Mitglieder an einem Ort. Auch ohne Netz.“

**Band anlegen**

- „Band anlegen“ statt „Band erstellen“.
- „Du bekommst einen Einladungscode. Teile ihn mit der Band.“
- Kein Passwortfeld.

**Beitreten**

- „Code eingeben. Namen wählen. Los.“
- Fehler: „Den Namen kennt die Band nicht. Frag nach dem richtigen Namen oder lass dich hinzufügen.“

**Leere Zustände**

- Songs: „Noch kein Song. Der erste ist der schwerste.“
- Setlists: „Noch keine Setlist. Für die nächste Probe reichen drei Songs.“
- Mitglieder: „Noch niemand eingetragen.“

**Löschen**

- „Song löschen? Er verschwindet aus allen Setlists.“
- „Setlist löschen? Die Songs bleiben erhalten.“

**Bühne**

- „Seite 2 von 3“
- „Nächster Song“
- „Notiz setzen“
- „Schrift größer“
- „Zurück zur Setlist“

**Offline**

- „Ohne Netz spielbar. Alles bleibt auf diesem Gerät.“
- „Keine Verbindung. Die Setlist ist trotzdem da.“

**Speichern**

- „Gespeichert.“
- „Das hat nicht geklappt. Nochmal?“

### 8.4 Do und Don't

| Do | Don't |
|---|---|
| „Song anlegen“ | „CREATE SONG“ |
| „Ohne Netz spielbar“ | „offline-first, live-sync fähig“ |
| „Seite 2 von 3“ | „Page 2/3“ |
| „Notiz setzen“ | „+ Pin“ |
| „LIVE“ nur bei laufender Sitzung | Dauerhaftes LIVE-Abzeichen |
| Icons mit Text | Emoji als einziger Hinweis |
| Fehler als Satz | `alert("Falsches Passwort")` |
| Eine Sprache | Deutsch-Englisch-Mix |

## 9. Visuelle Richtung

### 9.1 Leitbild

**Das weiße Blatt auf der dunklen Bühne.** Die Bühnenansicht zeigt es schon: ein helles Papier, darauf Text und Akkorde, drumherum Schwarz. Das ist die stärkste Bildidee der Alt-App. Die Marke sollte sie übernehmen.

Orange ist das Licht, das auf das Blatt fällt. Es bleibt Signal- und Aktionsfarbe. Schwarz ist der Raum. Weiß ist das Papier.

### 9.2 Palette

| Rolle | Farbe | Einsatz |
|---|---|---|
| Signal | `#FF6A00` | Aktionen, aktive Tabs, Marker |
| Grund | `#09090B` | Hintergrund |
| Fläche | `#18181B` | Karten |
| Papier | `#F5F5F4` | Bühnenansicht |
| Text | `#FAFAFA` | Primärtext |
| Sekundär | `#A1A1AA` | höchstens für große Texte |
| Warnung | `#F59E0B` | Fehler, nicht als Deko |
| Live | `#EF4444` | nur bei echter Live-Sitzung |

Kontrast: Primärtext und Orange auf Schwarz sind gut. Sekundärtexte unter 4,5:1 nur ab 18 px oder fett.

### 9.3 Typografie

- **Inter** für UI und Bühne. Vertraut, gut lesbar, viele Schnitte.
- **JetBrains Mono** für Codes, Zeiten, BPM.
- Bühne: mindestens 18 px, besser 22 px. Songtitel 28 bis 36 px.
- Zeilenlänge auf der Bühne kurz halten. Keine Blocksätze.

### 9.4 Logo

Drei Richtungen:

1. **Zettel**: ein weißes Rechteck mit geknickter Ecke und einer orangefarbenen Linie. Funktioniert als Icon und als Bildmarke.
2. **Z / S**: ein Monogramm aus zwei Linien, die eine Setlist andeuten. Nur, wenn der Name kurz ist.
3. **Licht**: ein orangefarbener Kegel auf einem weißen Blatt. Stärker für Plakate, schwächer als Icon.

Empfehlung: Richtung 1. Sie ist einfach, wiedererkennbar und passt zum Namen.

### 9.5 Icon und PWA

- 192, 512, 1024 als echtes PNG.
- Maskable mit 10 Prozent Rand, Inhalt in der Safe Zone.
- Ein SVG als Quelle.
- Kein JPEG mit falscher Endung.
- Kein 140-KB-Foto als Icon.

### 9.6 Bühnenmodus

- Wenig Chrome: Seite, Song, Zurück, Weiter.
- Große Trefferflächen, mindestens 44 px.
- Kontrast auch bei hellem Licht.
- Kein Scrollen im Songtext, wenn es sich vermeiden lässt.
- Bildschirm bleibt an, wenn die App das darf.
- Fußschalter und Pfeiltasten bleiben.

## 10. Marken-One-Pager

**Name**: Setzettel (Arbeitsname)

**Claim**: Die Setlist für die Bühne.

**Versprechen**: Steht, wenn das Licht angeht.

**Zielgruppe**: kleine Bands, drei bis sechs Leute, ein bis vier Auftritte im Monat, eigene und befreundete Bands.

**Werte**: bühnenfest, ehrlich, schnell.

**Stimme**: Deutsch, Du, ruhig, direkt, ohne Werbung.

**Farben**: Orange `#FF6A00`, Schwarz `#09090B`, Papier `#F5F5F4`.

**Schrift**: Inter, JetBrains Mono.

**Bild**: weißes Blatt, orange Linie, dunkler Raum.

**Don'ts**: kein „Pro“, kein „Commander“, kein LIVE ohne Live, keine Tech-Notizen im UI, keine Emojis als Icons.

## 11. Offene Entscheidungen

1. Wird der Name Setzettel, Beusti oder etwas anderes?
2. Ist die Band tatsächlich „Beusti“? Dann ist die personalisierte Route stark.
3. Nur Deutsch oder Deutsch und Englisch?
4. Bleibt Orange die Signalfarbe?
5. Wird das Logo neu gezeichnet oder reicht ein sauberes Icon?
6. Gibt es eine Domain?
7. Soll die Marke bandintern bleiben oder später für andere Bands offen sein?
8. Wie viel Persönlichkeit darf sein? Ein trockener Ton passt, Ironie eher nicht.

## 12. Quellen

- [Produser: Setlist-Apps und BandHelper im Vergleich](https://produser.io/de/blog/playing-live/bandorganisation-setlist-apps-vergleich/)
- [Orphiq: Setlist Maker Apps for Live Performances](https://orphiq.com/resources/setlist-maker-apps)
- [SetList Pro Music im App Store](https://apps.apple.com/pt/app/setlist-pro-music/id6751470024)
- [Set Lists Pro im App Store](https://apps.apple.com/cn/app/set-lists-pro/id6745643806)
- Eigene Screenshots unter `docs/analyse/screens/`.
