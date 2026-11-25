# Design Doc: Band-Verwaltung und Einladungen

- Status: Akzeptiert
- Datum: 2026-11-22
- Verantwortlich: Entwicklung Core
- Bezug: `REQUIREMENTS.md` (`R21`, `R22`), `docs/adr/0001-einladung-mit-kontoerstellung.md`

## 1. Problem, Appetite und Nicht-Ziele

- **Problem:** Bands brauchen eine klare Rollenordnung und einen einfachen Weg, neue Mitglieder aufzunehmen. Ohne Einladung wäre die Registrierung im Core offen oder nur per Handarbeit möglich.
- **Ziel & Erfolgsnachweis:** Owner verwalten Rollen und Einladungen. Ein gültiger Link führt in unter einer Minute zu einer Mitgliedschaft. R21 und R22 bleiben grün, inklusive Nebenläufigkeit und Token-Schutz.
- **Appetite:** Eine Ausbaustufe. Kein weiterer Rollen-Typ, keine offene Registrierung.
- **Nicht-Ziele:** E-Mail-Versand, Einladung per Messenger, Community-Hub-Anbindung, Kontolöschung per Self-Service.

## 2. Kontext und Architektur (C4)

- **System Context:** Mitglied und Owner nutzen den Core über den Browser. Der Core spricht mit PostgreSQL und Redis/Channels. Ein Einladungslink kann außerhalb des Core geteilt werden. Der Core ruft dabei keinen Dritten auf.
- **Container / Komponenten:**
  - `frontend` liefert die Ansichten für Bandverwaltung und `/einladung/<token>`.
  - `api` führt Rollenwechsel, Einladungserstellung, Vorschau und Beitritt aus.
  - `bands` enthält Modell und Fachdienste. Schreibvorgänge laufen unter Zeilensperre.
  - `realtime` schreibt Bandereignisse in derselben Transaktion.
- **Schnittstellen & Datenmodell:**
  - `Membership(band, user)` mit `UNIQUE(band, user)` und Rolle `owner` oder `member`.
  - `BandInvitation` speichert `token_hash` (SHA-256, eindeutig), `expires_at`, `revoked_at`, `uses_count`, `max_uses` und `created_by`.
  - Öffentlich sind `GET /api/invitations/<token>/` und `POST /api/invitations/<token>/accept/`. Owner-Endpunkte liegen unter `/api/bands/<id>/invitations/`.
  - Migrationen `bands/0002` und `bands/0003` legen Tabelle und Zeitstempel-Default an.
- **Fehlerfälle, Zustand & Nebenläufigkeit:**
  - Beitritt und Widerruf sperren die Einladungszeile. `uses_count` steigt nur bei einer neuen Mitgliedschaft.
  - Rollenprüfungen laufen nach der Mitgliedersperre erneut. Ein gleichzeitig entfernter Owner kann weder Einladung erstellen noch widerrufen.
  - Der Widerruf sperrt nur die Einladungszeile, nicht die Bandzeile. Das vermeidet eine gegenläufige Sperrordnung mit einem gleichzeitigen Beitritt.
  - Abgelaufene, widerrufene und ausgeschöpfte Links antworten einheitlich mit 404.
  - Kontoanlage und Mitgliedschaft laufen atomar. Ein doppelter Benutzername oder eine doppelte E-Mail endet kontrolliert als 400.

## 3. Alternativen und Trade-offs

| Option | Vorteile | Nachteile / Risiken | Entscheidung |
|---|---|---|---|
| Offene Registrierung im Core | Weniger Klicks | Unkontrollierter Zutritt, Spam | Verworfen |
| Einladung ohne Kontoanlage | Einfach | Neue Mitglieder brauchen einen zweiten Weg | Verworfen |
| Einladung mit Kontoanlage im Core | Ein Link, ein Ablauf | Auth und öffentlicher Endpunkt im Core | Gewählt |

Die Details der Kontoerstellung stehen im ADR.

## 4. Qualitätsanforderungen (ISO/IEC 25010:2023)

- **Performance Efficiency:** Vorschau und Beitritt antworten im normalen Betrieb unter 300 ms. Das Rate-Limit schützt vor Lastspitzen.
- **Reliability:** Ein Rollback hinterlässt weder Mitgliedschaft noch Ereignis. Doppelte Beitritte bleiben idempotent.
- **Interaction Capability / Barrierefreiheit:** Die Einladungsseite ist per Tastatur bedienbar, Fehler stehen als `role="alert"`, der Entwurfsdialog hält den Fokus.
- **Maintainability & Flexibility:** Eine Einladung ist ein eigenes Modell. Die öffentliche Route bleibt von der Owner-Verwaltung getrennt.
- **Compatibility & Safety:** Der Core bleibt autark. Kein externer Dienst ist für den Beitritt nötig.

## 5. Security und Privacy

- **STRIDE-Kurzcheck:**
  - **Spoofing:** Der Link ist der Besitznachweis. Der Token hat 256 Bit Entropie.
  - **Tampering:** `max_uses` und `expires_at` prüft der Server unter Zeilensperre.
  - **Repudiation:** `created_by`, `created_at` und `last_used_at` bleiben gespeichert.
  - **Information Disclosure:** Die Vorschau nennt nur Bandname, Ablauf und Anmeldestatus. Kontoexistenz verrät die Registrierung nicht.
  - **Denial of Service:** nginx begrenzt öffentliche Aufrufe, DRF begrenzt Owner-Aufrufe.
  - **Elevation of Privilege:** Rollenwechsel und Einladungsverwaltung verlangen Owner-Rechte nach erneuter Prüfung unter Sperre.
- **OWASP ASVS 5.0.0:** Stufe 2. Geprüft werden Session, CSRF, Zugriffskontrolle, Eingabevalidierung, Logging und Kryptografie.
- **DSGVO:** Zweckbindung auf Bandbeitritt, Datenminimierung ohne Profilfelder, Löschung über die Kontolöschung, AVV mit dem Betreiber der Instanz.
- **Lieferkette:** Keine neue Abhängigkeit. Argon2 ist bereits im Einsatz.

## 6. Teststrategie und Auslieferung

- **Testing Trophy:** Django-Tests decken Rollen, Token, Laufzeit, CSRF und Nebenläufigkeit ab. Frontend-Tests decken Formular, Fehler und Dialogverhalten ab. Der Kern-Smoke prüft den echten Browserweg.
- **Rollout & Betrieb:** Kein Feature Flag. Die Migration `bands/0002` legt neue Tabellen an, `bands/0003` ändert nur den Default von `created_at`. Ein Rollback vor dem ersten produktiven Einladungslink ist unkritisch.

## 7. Instanz-Einladung ohne Band (R23, R24)

- **Problem:** Eine fremde Band soll den Server selbst einrichten, ohne dass der Betreiber vorher eine Band mit fremdem Namen anlegt und später austritt. Entscheidung und Alternativen stehen in `docs/adr/0002-instanz-einladung.md`.
- **Datenmodell:** Eigenes Modell `InstanzEinladung` in `accounts` mit `token_hash`, `expires_at`, `revoked_at`, `uses_count`, `max_uses` und `created_by`. Laufzeit 1 bis 90 Tage, Nutzungslimit 1 bis 100. Kein `band`-Feld, keine Mitgliedschaft beim Beitritt.
- **Schnittstellen:** `GET /api/beitritt/<token>/` liefert `kind`, `note`, `expires_at` und `authenticated`. `POST /api/beitritt/<token>/accept/` kennt `mode=login` und `mode=register` und meldet das Konto an. Beide sind Django-Views unter der CSRF-Middleware.
- **Oberfläche:** `/beitritt/<token>` zeigt Hinweis und Ablaufzeit, nutzt das Formular der Band-Einladung mit den Beschriftungen "Konto anlegen" und "Anmelden" und führt nach Erfolg zur Band-Erstellung. Ungültige, abgelaufene und widerrufene Links zeigen denselben Hinweis wie die Band-Einladung.
- **Gemeinsame Regeln:** Hash, Grenzwerte, Ausnahmen und die Suche unter Zeilensperre liegen in `backend/core/einladungstoken.py`. Eine Regeländerung passiert dort einmal.
- **Betrieb:** Der Betreiber erzeugt den Link mit `manage.py instanz_einladung`; die öffentliche Adresse kommt aus `INSTANZ_BASIS` oder `--basis`. Widerruf über `--widerrufen <id>`. Ablauf und Grenzen prüft der Server unter Sperre; Logs redigieren den Token wie beim Band-Pfad.
- **Nicht-Ziele:** Kein E-Mail-Versand, keine Selbstbedienung in der Oberfläche, kein zweiter Weg zur Band-Mitgliedschaft.
