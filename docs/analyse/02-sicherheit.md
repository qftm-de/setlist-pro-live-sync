# Sicherheits- und Datenschutzbefund: Alt-App

Stand: 13.11.2026. Grundlage ist die statische Analyse von `alte_projektdatein/index.html`, `sw.js`, `manifest.json`, `netlify.toml` und der beiden Log-Dateien. Dazu kommt ein einmaliger Lesezugriff auf Firestore am 13.11.2026. Es wurden keine Angriffe gefahren, keine Payloads gebaut und keine Schreibzugriffe versucht.

## 1. Kurzfassung

Die Alt-App hat kein Sicherheitsmodell. Sie hat ein fest eingebautes Passwort, lokal gespeicherte Daten und Rollen ohne Prüfung. Das ist kein einzelner Bug, den man patchen kann. Es ist die Architektur eines Prototyps, der für ein Gerät und eine vertrauenswürdige Person gebaut wurde.

Dazu kommt ein konkreter Serverbefund: Firestore in der Alt-App war ohne Anmeldung lesbar. Jeder mit der Projekt-ID konnte Bands, Mitglieder, Songs, Setlists, Annotationen und eine PDF abrufen. Das ist der schwerwiegendste Befund, schwerer als das Passwort im Client.

Die gute Nachricht: Es ist wenig Daten, überwiegend Testmaterial. Die schlechte Nachricht: Der Lesezugriff war offen, und Schreibzugriff haben wir nicht getestet.

## 2. Bedrohungsmodell im Ist

**Schutzobjekte**

- Namen und Instrumente der Mitglieder.
- Rollen und Bandzugehörigkeit.
- Songs, Notizen, Setlists, Annotationen und Pins.
- Bandcodes.
- Die PDF im Firestore-Dokument.
- Die Firebase-Konfiguration und das Passwort im lokalen Log.

**Akteure**

- Bandmitglieder auf eigenen Geräten.
- Jede Person, die die HTML-Datei erhält.
- Jede Person mit Zugriff auf das Browserprofil.
- Jede Person mit der Projekt-ID und einem Web-API-Key.
- Dritte, die im Netzwerk mitlesen oder Google Fonts sehen.
- Der Betreiber des Firebase-Projekts.

**Vertrauensgrenzen**

Es gibt keine wirksame Vertrauensgrenze. Firestore ist ohne Anmeldung lesbar. Der Client entscheidet allein, was passiert.

## 3. Befunde

| ID | Befund | Schwere | Beleg | Auswirkung | Empfehlung für den Neubau |
|---|---|---|---|---|---|
| S1 | Globales Passwort fest im Client (Wert hier nicht wiederholt). Es gilt für „Band erstellen“ und „Bands verwalten“. | hoch | `yd()` 171127, `gd()` 172784 | Jede Person mit der Datei kann lokal Bands anlegen und löschen. Das Passwort ist kein Geheimnis. | Kein geteiltes Passwort. Konten, Einladungen, serverseitige Prüfung. |
| S2 | Rollen Admin, Member und Gast werden nirgends geprüft. | hoch | Rollen-Select bei 188130, keine `role`-Prüfung im Code | Jeder darf alles: Rollen ändern, Mitglieder und Songs löschen, Setlists verändern. | Rechte serverseitig prüfen, pro Aktion, nicht pro Anzeige. |
| S3 | Der Prototyp hat keinen Server, keine Anmeldung, keine Mehrbenutzer-Isolation. | hoch für geteilte Nutzung | Kein `firebase`, kein `fetch`, kein `WebSocket` im Client | Daten sind pro Browser getrennt. „Band“ ist nur ein lokaler Schlüssel. Kein Schutz gegen fremde Geräte, weil es keine gemeinsame Wahrheit gibt. | Architektur mit Konten, Rollen und einer Datenquelle. |
| S4 | Alle Daten liegen im Klartext in `localStorage`. | mittel | Schlüssel siehe Funktionsanalyse | Jedes Skript auf derselben Origin und jeder mit Zugriff auf das Profil liest alles. Kein Ablaufdatum, keine Verschlüsselung. | Daten minimieren, Sitzungen kurz halten, keine sensiblen Daten lokal. |
| S5 | Keine Sicherung, keine Quota-Behandlung, kein Export. | mittel | `catch {}` beim Lesen, kein `removeItem` | Browserdaten löschen oder voller Speicher bedeutet Datenverlust. | Export, Backup, saubere Fehlerbehandlung. |
| S6 | Log-Dateien enthalten Passwort und Firebase-Config im Klartext. | mittel | `Band-Commander-Log.txt` Zeile 7, 8, 90 bis 95 | Der Ordner ist gitignored und nicht versioniert. Er liegt aber auf der Platte und kann weitergegeben werden. | Passwort rotieren, Logs nicht teilen, Keys außerhalb des Repos. |
| S7 | Keine CSP, keine Security-Header, mehrere Inline-Skripte. | mittel | `index.html`, `netlify.toml` | Keine Defense in Depth. Jede eingeschleuste Zeile Code läuft mit vollen Rechten. | CSP mit Hashes oder Nonces, Header für Frame, Referrer und Permissions. |
| S8 | Google Fonts werden per `@import` im Render geladen. | niedrig bis mittel | Zeile 54, `@import` | IP-Adressen gehen an Google. Ohne Netz fehlt die Schrift, die App bleibt lesbar. | Schriften lokal ausliefern, Datenschutzhinweis. |
| S9 | Service Worker cached die Hülle, aber keine neuen Antworten. | niedrig | `sw.js` Zeile 32 | Offline reicht nur für die Precache-Liste. Alte Stände bleiben länger als gedacht. | Versionierter Cache, echte Offline-Strategie, Update-Hinweis. |
| S10 | Echte Songtexte im Bundle. | hoch für Veröffentlichung | Zeilen 57 bis 84 | Urheberrechtlich geschützte Texte werden mit ausgeliefert. | Demo-Inhalte entfernen oder lizenzieren. |
| S11 | Personenbezogene Daten ohne Hinweis und ohne Löschfunktion. | mittel | Mitglieder, Notizen, Rollen | Betroffene wissen nicht, was gespeichert wird. Löschen heißt Browserdaten löschen. | Datenschutzhinweis, Löschfunktion, Datenminimierung. |
| S12 | Fehler werden per `alert` gemeldet, teils still verschluckt. | niedrig | `catch {}`, `alert()` | Keine Nachvollziehbarkeit, keine sauberen Zustände. | Fehlerzustände sichtbar und zugänglich machen, Logs ohne Personenbezug. |
| S13 | Firestore ist ohne Anmeldung lesbar. | hoch | GET am 13.11.2026 ohne Auth: 4 Bands, 9 Mitgliedseinträge, 7 Songs, 2 Setlists, 1 PDF | Mitgliedernamen, Rollen, Setlists, Annotationen und die PDF sind für jede Person mit Projekt-ID lesbar. | Regeln sofort auf Anmeldung, dann auf Mitgliedschaft pro Band. App Check aktivieren. |
| S14 | Ein Banddokument enthält ein Klartextfeld `pw`. | hoch | Band `BAND-C` | Das Passwort ist lesbar, solange die Regeln offen sind. | Feld entfernen, Passwort rotieren, Passwörter nie in der Datenbank speichern. |
| S15 | Die PDF liegt als Base64-Data-URI im Banddokument. | mittel | 416 KB PDF, 555.016 Zeichen Data-URI, Banddokument 564.692 Bytes | Das Dokument liegt nah am 1-MiB-Limit von Firestore. Die nächste PDF kann Schreibvorgänge brechen. Die PDF ist Teil des öffentlichen Dokuments. | PDFs in Objekt-Storage ablegen, nur Metadaten in der Datenbank. |
| S16 | Zwei Schemata in einer Collection. | niedrig | `created` gegen `createdAt`, `inst` gegen `instrument`, Mitglieder ohne IDs und Rollen | Migration und Rechteprüfung werden fehleranfällig. | Schema versionieren, Pflichtfelder validieren. |

## 4. Was nicht das Problem ist

- Es gibt keine SQL-Datenbank, also keine SQL-Injection.
- Es gibt keine serverseitige Anmeldung, also keinen Auth-Bypass im engeren Sinn. Die offene Firestore-Regel macht eine Anmeldung überflüssig.
- Der Prototyp hat keinen Datei-Upload. Die Alpha legt eine PDF als Base64 in Firestore. Ein klassischer Upload-Endpunkt ist nicht sichtbar.
- React escapt Textinhalte. Nutzereingaben landen nicht als HTML im DOM. Ein direkter XSS über Songtitel ist nicht erkennbar.
- Die Inline-Skripte sind Teil der Datei. Ein Angreifer müsste die Datei oder den Hosting-Stand ändern.

Die eigentliche Schwäche ist die fehlende Vertrauensgrenze, nicht eine einzelne Injection. Die offene Firestore-Regel ist kein Client-Bug. Sie lässt sich ohne Codeänderung schließen.

## 5. Der XSS-Punkt genauer

- Der App-Code nutzt kein `dangerouslySetInnerHTML`.
- Die Mobile-Fixer lesen `innerHTML` und schreiben Styles, aber keine Fremddaten.
- Ein `@import` für Fonts ist kein Skript.
- Damit ist das aktuelle XSS-Risiko niedrig.
- Für den Neubau gilt trotzdem: keine Fremddaten als HTML, CSP als zweite Schicht, keine Inline-Skripte.

## 6. Firebase und Schlüssel

- Im Client der Alt-App kommt Firebase nicht vor.
- Das Firebase-Projekt der Alt-App ist real. Firestore war am 13.11.2026 ohne Anmeldung lesbar.
- Gelesen wurden 4 Bands, 9 Mitgliedseinträge, 7 Songs, 2 Setlists, 9 Annotationen und eine PDF.
- Storage ließ sich nicht auflisten. Der Aufruf endete mit HTTP 403.
- Schreibzugriff wurde nicht getestet. Ob die Regeln auch Schreiben erlauben, ist offen.
- Ein Firebase-Web-API-Key ist kein Secret im engeren Sinn. Er identifiziert das Projekt. Gefährlich wird er, wenn die Regeln offen sind, und genau das war der Fall.
- Der Schlüssel sollte auf HTTP-Referrer und erlaubte APIs eingeschränkt werden. App Check sollte aktiv sein.
- Das Passwort im Log ist ein echtes Secret und muss vor einer Veröffentlichung ersetzt werden. Das Feld `pw` in einem Banddokument ist ebenfalls zu entfernen.
- Ich habe nichts geändert. Die laufende Alpha könnte davon abhängen. Das Schließen der Regeln ist eine Aufgabe für den Kollegen mit Konsolenzugriff.

## 7. Konsequenzen für den Neubau

1. **Identität**: Konten mit echter Anmeldung, keine geteilten Passwörter.
2. **Rollen**: serverseitig prüfen, pro Aktion. Admin, Member und Gast brauchen definierte Rechte.
3. **Mandantentrennung**: Eine Band ist ein Mandant. Jede Abfrage filtert auf die Band, der der Nutzer angehört.
4. **Datenminimierung**: Nur speichern, was für Setlists und Bühne nötig ist.
5. **Transport**: nur HTTPS, keine Secrets im Client, keine Keys im Repo.
6. **Header**: CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors`.
7. **Sicherung**: Export und Wiederherstellung, bevor Daten migriert werden.
8. **Recht**: Songtexte lizenzieren oder entfernen, Datenschutzhinweis, Löschweg.
9. **Betrieb**: Update-Strategie für den Service Worker, versionierter Cache, sichtbarer Build-Stand.
10. **Datenbank**: Regeln pro Band, nicht nur pro Projekt. Keine offenen Regeln, kein unauthentifizierter Zugriff.
11. **Dateien**: PDFs in Objekt-Storage, nicht als Base64 in Dokumenten.
12. **Secrets**: keine Passwörter in der Datenbank, keine Keys im Client, keine Keys im Repo.

## 8. Prüfmethode

- Statische Suche nach Auth, Rollen, Speicher, Netzwerk und HTML-Senken.
- Abgleich mit den Screenshots aus `docs/analyse/screens/`.
- Firestore-REST am 13.11.2026, nur GET, ohne Auth-Token. Keine Schreibversuche.
- Keine dynamischen Angriffe, keine Exploit-Payloads.
- Die Bewertung ist eine Architekturbewertung, keine Penetrationstest-Bescheinigung.

## 9. Offene Punkte

- Firestore-Lesesperre: bestätigt offen. Schreibzugriff: nicht getestet.
- App-Check-Status: unbekannt.
- Storage-Bucket: Liste verweigert, verwaiste Dateien möglich.
- Das Passwort muss vor einer Veröffentlichung rotiert werden.
- Das Feld `pw` muss aus dem Banddokument verschwinden.
- Der API-Key sollte eingeschränkt werden, sobald klar ist, welche Alpha-Version ihn nutzt.
