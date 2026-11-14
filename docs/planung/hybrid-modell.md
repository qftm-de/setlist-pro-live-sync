# Hybrid-Modell: Autarker Kern und optionaler Community-Hub

Stand: 14.11.2026. Verbindlicher Plan für den Neubau von Setlist Pro. Er ersetzt die Annahme „nur zentrale Plattform“ aus der ersten Planungsfassung.

## 1. Entscheidung

Ein Repository, eine Codebasis, zwei Betriebsmodi:

- **`core`**: selbst gehostet, autark, alle Bandfunktionen, keine Community-Pflicht.
- **`hub`**: zentral betrieben, Bandfunktionen plus Community, Profile, Pinnwand, Kontaktanfragen, Moderation.
- **`core` plus `COMMUNITY_URL`**: wie `core`, zusätzlich ein Link zum Hub. Keine geteilte Identität, kein automatischer Datenaustausch.

Der Kern darf niemals vom Hub abhängen. Kein Telefon nach Hause, keine Pflicht-Anmeldung, kein Sync ohne ausdrückliche Aktion.

## 2. Betriebsmodi

| Modus | `APP_MODE` | Registrierung | Community | Einsatz |
|---|---|---|---|---|
| Autark | `core` | geschlossen, Admin und Einladungen | aus | Band auf eigenem Server |
| Autark mit Link | `core` + `COMMUNITY_URL` | geschlossen | nur Link | Band, die die Pinnwand sehen will |
| Hub | `hub` | öffentlich mit E-Mail-Verifikation | an | zentrale Plattform |

Konfiguration:

```env
APP_MODE=core
COMMUNITY_URL=
INSTANCE_NAME=Setlist Pro
PUBLIC_REGISTRATION=false
```

Im Hub-Modus wird `PUBLIC_REGISTRATION=true` gesetzt und die Community-Routen werden aktiv.

## 3. Architektur

```text
backend/
  config/settings/base.py, core.py, hub.py, test.py
  accounts/ bands/ library/ setlists/ documents/ annotations/
  realtime/ audit/
  community/        # nur im Hub geroutet
frontend/
  src/features/     # core
  src/features/community/  # lazy, nur bei Hub oder Link
deploy/
  docker-compose.yml
  Dockerfile
  .env.example
  scripts/backup.sh, restore.sh, upgrade.sh
docs/
  planung/ architektur/ betrieb/
```

- `community` ist eine eigene Django-App. Modelle und Migrationen existieren überall, die URLs und die UI werden über `APP_MODE` freigeschaltet. Keine bedingten Migrationen.
- Das Frontend lädt `features/community` nur, wenn der Modus oder die URL es erlaubt.
- Ein Docker-Image für beide Modi. Der Unterschied ist die Umgebung, nicht der Build.
- Keine Telemetrie. Keine automatischen Aufrufe zum Hub. Der Link ist ein Link.

## 4. Identität und Datenfluss

- **Core**: lokale Konten. Der erste Admin wird per Setup angelegt. Weitere Mitglieder kommen per Einladung. Keine öffentliche Registrierung.
- **Hub**: eigene Konten mit E-Mail-Verifikation und öffentlicher Registrierung.
- Wer beides nutzt, hat zwei Konten. Das ist für Version 1 ehrlicher als eine halbe SSO-Lösung.
- Banddaten, Songs, Setlists und PDFs werden nie automatisch veröffentlicht. Ein Bandprofil oder ein Pinnwandeintrag ist eine bewusste Aktion auf dem Hub.
- Später, nicht in Version 1: OAuth, „Mit Hub verbinden“, signierter Share-Handoff. Keine Föderation, kein ActivityPub.

## 5. Phasen und Umfang

### Phase 1: Autarker Kern

- Registrierung, Anmeldung, Sessions, CSRF, Einladungen.
- Bands, Mitgliedschaften, individuelle Rechte, letzter Owner.
- Songs, Setlists mit Sets, Pausen, Zugaben, Dauer.
- PDFs privat, Upload, Validierung, Streaming, Versionen.
- Annotationen: Text und Marker, persönlich und bandweit, später Freihand.
- Echtzeit-Signale, Lesereserve, Bühnenmodus.
- Docker Compose, Backup/Restore, Upgrade, Healthchecks.
- Release über GitHub und GHCR.

Der Kern ist auch ohne Hub vollständig nutzbar. Das ist die wichtigste Abnahmebedingung.

### Phase 2: Hub

- Öffentliche Registrierung mit Verifikation.
- Bandprofile, freiwillig und opt-in.
- Pinnwand für Musiker- und Auftrittsgesuche, Kategorien, Region, Ablaufdatum.
- Kontaktanfragen mit Nachricht, Annehmen, Ablehnen, Blockieren, Melden.
- Moderation, Limits, Spam-Schutz, AGB, Datenschutz.
- Kein Chat, keine Anhänge, keine Kommentare in Version 1.

Der Hub ist eine separate Instanz derselben Codebasis mit eigener Domain, Datenbank, SMTP und Moderation. Er kann auch als gehostete Band-App dienen.

### Phase 3: Optionale Integration

- „Auf die Pinnwand teilen“ als bewusster Handoff.
- OAuth oder SSO, wenn der Bedarf belegt ist.
- Keine Föderation.

### Phase 4: Öffentliche Veröffentlichung

- Lizenz, Markenrichtlinie, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`.
- CI, Releases, Migrationhinweise, Sicherheitsmeldungen.
- Dokumentation für Installation, Update, Backup, Restore, Domain/TLS, SMTP.
- Erst veröffentlichen, wenn der Kern stabil und wartbar ist.

## 6. Datenmodell

### Kern

| Entität | Kernfelder |
|---|---|
| `accounts.User` | Custom User, E-Mail eindeutig, `display_name`, `is_active`, `is_staff` |
| `bands.Band` | `name`, `created_by`, `version`, `deleted_at` |
| `bands.Membership` | `band`, `user`, `role`, Flags für Songs, Setlists, Dokumente, gemeinsame Annotationen |
| `bands.Invitation` | `band`, `email`, `token_hash`, `expires_at`, `accepted_at`, `revoked_at` |
| `library.Song` | `band`, `title`, `artist`, `key`, `bpm`, `duration_seconds` nullable, `notes`, `archived_at` |
| `setlists.Setlist` | `band`, `name`, `version`, `archived_at` |
| `setlists.Section` | `setlist`, `name`, `kind`, `position` |
| `setlists.Entry` | `section`, `position`, `entry_type`, `song`, `label`, `duration_seconds` |
| `documents.Document` | `band`, `song`, `title`, `kind`, `archived_at` |
| `documents.DocumentVersion` | `document`, `version`, privates `file`, `page_count`, `sha256`, unveränderlich |
| `annotations.Annotation` | `document_version`, `page`, `kind`, `geometry`, `style`, `visibility`, `author`, `version` |
| `audit.AuditEvent` | `band`, `actor`, `action`, `target`, `metadata`, `created_at` |

### Hub

| Entität | Kernfelder |
|---|---|
| `community.BandProfile` | `owner`, `band` optional, `name`, `region`, `genres`, `description`, `contact_policy`, `published` |
| `community.PinboardPost` | `author`, `category`, `region`, `title`, `body`, `expires_at`, `status` |
| `community.ContactRequest` | `from_user`, `profile`, `message`, `status`, `created_at`, `responded_at` |
| `community.Block` | `user`, `blocked_user` |
| `community.Report` | `reporter`, `target_type`, `target_id`, `reason`, `status` |
| `community.ModerationAction` | `moderator`, `target`, `action`, `note`, `created_at` |

Regeln:

- Jedes Bandobjekt ist bandgebunden. Cross-Band-Zugriffe scheitern serverseitig.
- Persönliche Annotationen sieht nur der Autor. Bandweite Annotationen brauchen das Recht und sind für die Band sichtbar.
- Der Hub veröffentlicht nur, was ausdrücklich veröffentlicht wurde. Keine automatische Übernahme von Banddaten.
- Kontaktdaten werden erst nach Annahme einer Kontaktanfrage freigegeben.

## 7. API

### Kern

- `GET /api/v1/me`
- `GET/POST /api/v1/bands`, `GET/PATCH /api/v1/bands/{id}`
- `GET /api/v1/bands/{id}/members`, `PATCH/DELETE .../members/{mid}`
- `POST /api/v1/bands/{id}/invitations`, `POST /api/v1/invitations/{token}/accept`
- `GET/POST /api/v1/bands/{id}/songs`, `GET/PATCH/DELETE .../songs/{sid}`
- `GET/POST /api/v1/bands/{id}/setlists`, `PUT .../setlists/{lid}/content`
- `GET/POST /api/v1/bands/{id}/songs/{sid}/documents`, `POST .../documents/{did}/versions`
- `GET .../documents/{did}/versions/{v}/file` (privat, Streaming)
- `GET/POST .../versions/{v}/annotations`, `PATCH/DELETE .../annotations/{aid}`
- `GET /api/v1/healthz`

### Hub

- `GET/POST /api/v1/community/profiles`
- `GET/PATCH /api/v1/community/profiles/{id}`
- `GET/POST /api/v1/community/board`
- `POST /api/v1/community/contact-requests`
- `POST /api/v1/community/contact-requests/{id}/accept|decline|block|report`
- `POST /api/v1/community/reports`

Der Kern ruft keine Hub-API auf. `COMMUNITY_URL` ist nur ein Link.

## 8. Sicherheit

- Keine öffentliche Registrierung im Core. Erster Admin per Setup, Rest per Einladung.
- Kein Standardpasswort, keine Admin-Schlüssel im Browser.
- Sessions mit HttpOnly, Secure, SameSite, CSRF-Schutz. Kein JWT im localStorage.
- PDFs außerhalb des Webroots, Streaming nur für Mitglieder, keine öffentlichen Dateilinks.
- Upload-Validierung, Größen- und Seitenlimits, Prüfsumme, keine Base64-PDFs in der Datenbank.
- CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- Rechte serverseitig, pro Aktion und Objekt. UI-Ausblendung ist kein Schutz.
- Hub: E-Mail-Verifikation, Rate-Limits, Spam-Schutz, Melden, Blockieren, Moderation, AGB, Datenschutz.
- Keine Telemetrie, kein Phone-Home.
- Selbsthoster sind für ihre Instanz verantwortlich. Der Hub ist der einzige betriebene Dienst.

## 9. Betrieb und Updates

- `docker compose up -d` startet `web`, `db`, `redis`. Keine Host-Ports für Datenbank und Redis.
- `.env.example` mit Namen, keine Werte. Setup generiert Secrets.
- Healthchecks für Web, Datenbank und Redis.
- Backup: `pg_dump` plus Medienarchiv. Restore in eine leere Datenbank. Beides getestet.
- Update: Backup, `docker compose pull` auf eine feste Version, `docker compose up -d`, Migration, Healthcheck. Rollback über das Backup.
- Kein Auto-Update. Der Betreiber entscheidet.
- GitHub Actions: Lint, Tests, Image-Build, Push nach GHCR, Release Notes.
- Semantic Versioning, Changelog, Migrationshinweise, Security Advisories.
- Support: best effort, kein SLA. Sicherheitsfixes zuerst. Kein Einzelsupport für fremde Server.
- Der Hub wird von euch betrieben und aktualisiert. Selfhosting-Instanzen ziehen selbst.

## 10. Lizenz, Marke, Governance

- **Lizenz**: Annahme für den Plan ist AGPL-3.0, weil der Hub ein Netzdienst ist und ein geschlossener Klon verhindert werden soll. Alternative: Apache-2.0 für maximale Adoption. Entscheidung vor der öffentlichen Veröffentlichung.
- **Marke**: Code-Lizenz und Name sind getrennt. Selbsthoster dürfen den Code nutzen, aber nicht den Eindruck erwecken, offizielle Instanz zu sein. Kurze `TRADEMARK.md`.
- **Governance**: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, Issue- und PR-Templates, Release-Prozess.
- **Entscheidungen**: `DECISIONS.md` bleibt die Quelle. Änderungen werden dort begründet.
- **Release-Rhythmus**: kein festes Versprechen. Sicherheits- und kritische Fixes zuerst, Feature-Releases nach Kapazität.

## 11. Markt und Positionierung

Das Hybrid-Modell ist der eigentliche Unterschied zu forScore, MobileSheets, Newzik, OnSong, BandHelper und Gigmeister. Alle sind geschlossen. Keine lässt sich selbst hosten.

Die Nische:

- Deutsche Bands und Ensembles, die Datenhoheit und DSGVO wichtig finden.
- Vereine, Kirchen, Schulen, Blasmusik, Chor, Big Band.
- Tüftler, die ihren eigenen Server haben.
- Bands, die keine US-Cloud und kein Abo wollen.

Der Hub ist die Wachstumsschicht für alle, die kein Docker betreiben wollen. Der Kern ist das Vertrauensversprechen für alle, die es tun.

Nicht in Version 1: MIDI, Audio, Backing Tracks, Booking, Finanzen, KI, OMR. Das ist die Welt von Gigmeister und BandHelper. Dort nicht antreten.

## 12. Meilensteine und R-Zeilen

R1 bleibt. Die neuen Zeilen kommen nacheinander, nicht alle gleichzeitig. Das Gate verlangt, dass jede Zeile `passing` ist.

| R | Behavior | Verify | Scope | Risk |
|---|---|---|---|---|
| R2 | Repo und Harness sind auf React/TS/Vite, Django, PostgreSQL und Docker umgestellt; der Altbestand bleibt unverändert. | `node scripts/verify-foundation.mjs` | `harness`, `README.md`, `.gitignore`, `frontend`, `backend`, `deploy`, `scripts` | mittel |
| R3 | Registrierung im Hub und lokale Anmeldung im Core funktionieren mit Sessions, CSRF und E-Mail-Verifikation. | `node scripts/verify-auth.mjs` | `backend/accounts`, `backend/config`, `frontend/src/features/auth` | hoch |
| R4 | Bands, Einladungen, Mitgliedschaften und individuelle Rechte werden serverseitig durchgesetzt; der letzte Owner bleibt geschützt. | `node scripts/verify-bands.mjs` | `backend/bands`, `frontend/src/features/bands` | hoch |
| R5 | Songs und Setlists mit Sets, Pausen, Zugaben, doppelten Songs und unbekannter Dauer funktionieren; Reihenfolge bleibt stabil. | `node scripts/verify-library.mjs` | `backend/library`, `backend/setlists`, `frontend/src/features/library`, `frontend/src/features/setlists` | mittel |
| R6 | PDFs werden validiert, privat gespeichert und nur für Mitglieder gestreamt; Versionen bleiben unveränderlich. | `node scripts/verify-documents.mjs` | `backend/documents`, `frontend/src/features/documents` | hoch |
| R7 | Persönliche und bandweite Annotationen sind getrennt, seitenbezogen und nur für Berechtigte sichtbar. | `node scripts/verify-annotations.mjs` | `backend/annotations`, `frontend/src/features/annotations` | hoch |
| R8 | Echtzeit-Signale, Lesereserve und Bühnenmodus funktionieren; nach Reconnect wird der Serverstand geladen. | `node scripts/verify-realtime.mjs` | `backend/realtime`, `frontend/src/features/stage`, `frontend/src/shared/connection` | hoch |
| R9 | Der Core startet mit Docker Compose, Healthchecks, Backup/Restore und Upgrade-Anleitung; `COMMUNITY_URL` leer lässt keine Hub-Abhängigkeit entstehen. | `node scripts/verify-deploy.mjs` | `deploy`, `docs/betrieb`, `scripts/verify-deploy.mjs` | hoch |
| R10 | Der selbst gehostete Kern läuft auf zwei Geräten durch den Kernablauf; der Hub ist optional und nicht Voraussetzung. | `node scripts/verify-e2e.mjs --core` | `frontend/e2e`, `scripts/verify-e2e.mjs` | hoch |

Phase 2 bekommt eigene Zeilen für Community, Profile, Pinnwand, Kontaktanfragen und Moderation. Sie kommen erst, wenn der Kern steht.

## 13. Abnahmekriterien

- Installation in unter 15 Minuten mit Docker Compose.
- Erster Admin, Einladung, Band, Song, PDF, Annotation, Setlist, Bühnenansicht.
- Backup und Restore getestet.
- Upgrade auf eine neue Version getestet, inklusive Migration und Rollback über Backup.
- Core läuft mit leerem `COMMUNITY_URL` ohne Hub-Aufrufe.
- Hub läuft separat mit `APP_MODE=hub`, öffentlicher Registrierung, Pinnwand, Kontaktanfragen und Moderation.
- Keine automatische Datenübertragung zwischen Core und Hub.
- CI baut, testet und veröffentlicht Images.
- Lizenz, Marke, Sicherheit und Beiträge sind dokumentiert.
- `node scripts/gate.mjs --schnell` grün, `--voll` nach Review.

## 14. Risiken

- **Wartung**: Open Source bedeutet Issues, PRs, Releases, Sicherheitsmeldungen, Übersetzungen. Das ist ein zweiter Job.
- **Support**: Selbsthoster brauchen Hilfe bei Docker, TLS, SMTP, Backups. Ohne Grenzen wird das unbezahlt und endlos.
- **Hub-Moderation**: Pinnwand und Kontaktanfragen brauchen Moderation, Spam-Schutz und eine verantwortliche Person.
- **Kaltstart**: Eine leere Pinnwand ist uninteressant. Der Kern muss zuerst einen eigenen Nutzen haben.
- **Lizenz und Marke**: AGPL schreckt manche ab, Apache erlaubt geschlossene Klone. Marke getrennt regeln.
- **Sicherheit der Selfhoster**: Ihr könnt deren Instanzen nicht absichern. Sichere Defaults und klare Doku sind Pflicht.
- **Migrationen**: Updates können Datenbanken brechen. Backup-Pflicht und Migrationshinweise.
- **Scope**: PDF, Annotationen, Rollen, Sync, Community, Hub, Releases. Das ist viel. Phasen halten es beherrschbar.
- **Markt**: forScore, MobileSheets, Newzik, BandHelper und Gigmeister sind stark. Selbsthosting ist die Nische, nicht die Masse.
- **Name**: „Setlist Pro“ kollidiert mit einem App-Store-Produkt. Vor öffentlicher Veröffentlichung prüfen.

## 15. Offene Entscheidungen

1. Lizenz: AGPL-3.0 oder Apache-2.0.
2. Hub-Domain und Name.
3. Wer moderiert den Hub, und wie viel Zeit ist dafür da?
4. Wie viel Support leistet ihr für Selfhoster?
5. Release-Rhythmus: best effort oder fest?
6. Deutsch zuerst, Englisch später?
7. MFA für Betreiberkonten vor dem Hub-Start?
8. Soll der Hub auch gehostete Bands aufnehmen, oder nur Community? Empfehlung: beides, gleiche Codebasis.
9. Name „Setlist Pro“ behalten oder vor dem Public Release ändern?

## 16. Erste Schritte

1. Lizenz und Hub-Domain entscheiden.
2. Dieses Dokument in `docs/planung/hybrid-modell.md` ablegen.
3. `PROGRESS.md` nachziehen.
4. `harness/projekt.yaml` auf den neuen Stack und die zwei Modi umstellen, Dry-Run, Render, Konflikte prüfen.
5. R2 anlegen, Gerüst bauen, Docker Compose und CI aufsetzen.
6. Core bauen: Auth, Bands, Songs, Setlists, PDFs, Annotationen, Realtime, Bühne.
7. Betrieb: Backup, Restore, Upgrade, Release.
8. Erst danach den Hub als eigene Instanz.

Kurz: Der Kern muss allein laufen. Der Hub ist eine Option, kein Fundament. Wenn der Kern ohne Hub nützlich ist, ist das Modell richtig.
