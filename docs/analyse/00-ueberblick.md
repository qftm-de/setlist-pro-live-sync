# Überblick: Was die Alt-App ist und was der Neubau braucht

Stand: 13.11.2026. Dieses Dokument fasst die Analyse zusammen. Details stehen in den verlinkten Dateien.

## 1. In einem Absatz

Die Alt-App im Ordner ist ein React-Prototyp für eine Band. Sie verwaltet Mitglieder, Songs und Setlists und zeigt auf der Bühne eine helle Seite mit Text und Akkorden. Alles liegt im Browser. Die Daten im Firebase-Projekt zeigen ein neueres Modell: Mitglieder mit IDs und Rollen, Annotationen, Setlists im Banddokument und ein Live-Session-Feld. Firestore war am 13.11.2026 ohne Anmeldung lesbar. Der Prototyp ist brauchbar, die Alpha ist ein Teststand mit wenig echten Daten.

## 2. Die wichtigsten Befunde

### Funktion

- Sechs Ansichten: Start, Übersicht, Songs, Setlists, Members, Performance, dazu ein Pin-Editor.
- Echt: Bands lokal anlegen und beitreten, Mitglieder, Songs, Setlists, Performance-Blättern, Zoom, Pins, Fußschalter.
- Attrappe: PDF-Anzeige, PDF-Upload, Download aller PDFs, Live Sync, Offline-Knopf.
- Kaputt: Mobile Header, Mobile Mitgliederzeile, doppelte Pin-Speicherung.
- Fehlt: Songs bearbeiten, Setlist umsortieren, umbenennen, löschen, echte PDFs, Auftritte, Sync, Backup.

Details: [01-funktionen.md](01-funktionen.md)

### Sicherheit

- Fest eingebautes Passwort im Client für Anlegen und Verwalten (Wert hier nicht wiederholt).
- Rollen im Prototyp ohne jede Prüfung. In Firestore gibt es ein Rollenfeld, die Regeln sind aber offen.
- Firestore ohne Anmeldung lesbar: 4 Bands, 9 Mitgliedseinträge, 7 Songs, 2 Setlists, 1 PDF.
- Eine Band hat ein Klartextfeld `pw`.
- Daten im Klartext in `localStorage`, kein Backup.
- Logs mit Passwort und Firebase-Config liegen lokal.
- Echte Songtexte im Bundle.

Das ist kein einzelner Exploit. Es ist die Abwesenheit eines Sicherheitsmodells. Der offene Firestore-Lesezugriff ist der schwerwiegendste Teil.

Details: [02-sicherheit.md](02-sicherheit.md)

### Marke

- Vier Namen für ein Produkt: Setlist Pro, Band Commander, beusti_musik, React Artifact.
- Gute Zutaten: Orange `#FF6A00`, Schwarz, weißes Papier, Inter und JetBrains Mono.
- Schwache Zutaten: „Pro“, „Commander“, Emojis als Icons, Entwicklernotizen im UI, falsche LIVE-Versprechen.
- Vorschlag: **Setzettel**, Claim „Die Setlist für die Bühne.“
- Zielgruppe: eigene Band und befreundete Bands.

Details: [01-brand.md](../brand/01-brand.md)

### Firebase

- Der Prototyp nutzt kein Firebase.
- Die Alpha-Daten wurden am 13.11.2026 gelesen: 4 Bands, 9 Mitgliedseinträge, 7 Songs, 2 Setlists, 9 Annotationen, 1 PDF.
- Nur eine echte PDF: 8 Seiten, 416 KB, als Base64 im Banddokument. Inhalt ist ein Produktdatenblatt, kein Setlist-Dokument.
- Die Daten sind überwiegend Testmaterial.
- Firestore war ohne Anmeldung lesbar. Storage ließ sich nicht auflisten.

Details: [03-firebase-ist.md](03-firebase-ist.md)

## 3. Was der Neubau leisten muss

### Muss

1. Setlist anlegen, umsortieren und spielen.
2. Bühnenansicht mit Text und Akkorden, offline, groß und ruhig.
3. Songs anlegen, bearbeiten, löschen.
4. Mitglieder mit Rollen, serverseitig geprüft.
5. Anmeldung und Einladung über einen Code oder Link.
6. Sync zwischen Geräten.
7. Export und Backup.

### Soll

1. Echte PDFs oder Akkordblätter.
2. Notizen pro Song und Seite.
3. Fußschalter und Tastatur.
4. Auftritte mit Datum und Ort.
5. Suche über Songs und Setlists.
6. Offline-Status sichtbar.

### Kann

1. Setlist-Vorlagen.
2. Teilen per Link.
3. Statistik: Spielzeit, häufigste Songs.
4. Transpose.
5. Metronom oder Klick.
6. Hell und dunkel.

## 4. Kriterien für die Systemwahl

Die Entscheidung steht noch aus. Diese Kriterien sollten sie tragen:

| Kriterium | Frage |
|---|---|
| Sicherheit | Gibt es echte Konten, Rollen und serverseitige Regeln? |
| Offline | Funktioniert die Bühne ohne Netz? |
| Sync | Wie werden Konflikte aufgelöst, wenn zwei Leute dieselbe Setlist ändern? |
| Datenhoheit | Wo liegen die Daten, und wie kommen wir wieder heraus? |
| Datenschutz | EU-Hosting, Auftragsverarbeitung, Löschweg? |
| Kosten | Was kostet die Band pro Monat, und ab wann wächst es? |
| Betrieb | Wer kümmert sich um Backups, Updates, Ausfälle? |
| Komplexität | Kann ein kleines Team das in einem Jahr noch warten? |

## 5. Drei Optionen, ohne Entscheidung

1. **Firebase**: schnell, Auth und Firestore vorhanden, Regeln und App Check nötig. Vendor-Lock-in und Kostenrisiko.
2. **Supabase**: Postgres, Auth, Row Level Security, EU-Region möglich. Näher an einer normalen Datenbank, mehr SQL.
3. **Eigenes Backend**: maximale Kontrolle, aber Betrieb, Backups und Sicherheit liegen bei uns.
4. **Lokal zuerst, Sync später**: einfachster Start, aber die Band sieht sich nicht. Nur sinnvoll, wenn eine Person die Setlist führt.

## 6. Offene Entscheidungen

| Entscheidung | Wer | Nächster Schritt |
|---|---|---|
| Name der App | Nutzer | Setzettel, Beusti oder andere Route wählen |
| Zielsystem | Nutzer | Kriterien gewichten, zwei Optionen testen |
| Anmeldung | Nutzer | Konten, Einladung, anonyme Nutzer? |
| PDF oder Akkordblatt | Nutzer | Bühnenansicht festlegen |
| Auftritte | Nutzer | Muss, Soll oder Kann? |
| Sprache | Nutzer | Nur Deutsch oder zweisprachig? |
| Alpha-Daten | Nutzer | Gelesen. Überwiegend Testmaterial, Umzug wahrscheinlich nicht nötig. |
| Firestore-Regeln | Kollege mit Konsolenzugriff | Anmeldung plus Mitgliedschaft pro Band, App Check |
| Passwort und `pw`-Feld | Kollege | Passwort rotieren, Feld entfernen |
| V12-Datei | Kollege | Besorgen, Schreibpfad prüfen |
| Storage | Kollege | Verwaiste PDFs mit Leserechten prüfen |

## 7. Nächste Schritte

1. Firestore-Regeln schließen, zuerst Anmeldung, dann Mitgliedschaft pro Band.
2. Passwort rotieren und das Feld `pw` entfernen.
3. Den Kollegen nach der V12-Datei und nach der aktuellen Alpha-Verteilung fragen.
4. Namen entscheiden.
5. Zwei Systemoptionen anhand der Kriterien testen.
6. Für den Neubau eine eigene `REQUIREMENTS.md` mit R-Zeilen anlegen.
7. Erst danach Produktcode schreiben.

## 8. Dokumente

| Datei | Inhalt |
|---|---|
| [01-funktionen.md](01-funktionen.md) | Funktionen, Datenmodell, Ist-Reifegrad |
| [02-sicherheit.md](02-sicherheit.md) | Sicherheits- und Datenschutzbefund |
| [03-firebase-ist.md](03-firebase-ist.md) | Firebase: gelesener Bestand, PDFs, Sicherheit |
| [01-brand.md](../brand/01-brand.md) | Marke, Name, Sprache, visuelle Richtung |
| [screens/](screens/) | Screenshots der Alt-App |
