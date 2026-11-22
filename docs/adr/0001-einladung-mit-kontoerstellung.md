# ADR-0001: Kontoerstellung über einen Einladungslink

- Status: akzeptiert
- Datum: 2026-11-22
- Verantwortlich: Entwicklung Core
- Bezug: `docs/design/band-verwaltung-einladungen.md`, `REQUIREMENTS.md` (`R6`, `R21`, `R22`)

## Kontext

Der Core hat keine offene Registrierung. Neue Mitglieder sollen trotzdem ohne Handarbeit beitreten können. Ein Link in einer Messenger-Gruppe ist der übliche Weg. Gleichzeitig darf der Core nicht vom Hub abhängen und soll keine Konten ohne Einladung anlegen.

## Entscheidung

Wir erlauben die Kontoanlage nur über einen gültigen Einladungslink. Der Link gilt 48 Stunden, kann mehrfach genutzt und optional begrenzt werden. Die Datenbank speichert nur den SHA-256-Hash. Die öffentliche Route `POST /api/invitations/<token>/accept/` legt Konto und Mitgliedschaft atomar an und meldet das Konto an. Vorschau und Beitritt laufen als Django-Views unter der CSRF-Middleware. Ein Rate-Limit im Proxy schützt den Pfad.

## Betrachtete Alternativen

- **Offene Registrierung im Core:** Verworfen. Sie würde den Zutritt nicht an eine Band binden und Spam ermöglichen.
- **Nur bestehende Konten einladen:** Verworfen. Neue Mitglieder bräuchten einen zweiten, unklaren Weg.
- **Kontoanlage im Hub:** Verworfen. Der Core muss autark bleiben.

## Konsequenzen

- **Positiv:** Ein Link genügt. Der Core bleibt geschlossen und unabhängig. Der Klartext-Token lebt nur im Link und in der einmaligen Antwort.
- **Negativ / Trade-offs:** Der Core enthält jetzt einen öffentlichen Schreibendpunkt und Passwortvalidierung. Fehler in diesem Pfad wirken direkt auf die Anmeldung. Das Rate-Limit muss im Betrieb gepflegt werden.
- **Folgearbeiten:** Design Doc pflegen, Token-Redaktion in nginx und Django prüfen, R22 bei Änderungen erneut verifizieren.
