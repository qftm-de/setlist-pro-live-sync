# Sicherheit

## Meldung

Sicherheitslücken bitte nicht als öffentliches Issue, nicht in Discussions und
nicht in einem Pull Request melden.

Zwei Wege:

1. GitHub Security Advisory im Tab **Security** des Repos. Das ist der bevorzugte
   Weg, weil die Meldung privat bleibt und ein Advisory daraus werden kann.
2. service@qftm.de, wenn du kein GitHub-Konto nutzen willst.

Nützlich für uns:

- betroffene Version oder Commit,
- Betriebsmodus (`core` oder `hub`),
- was ein Angreifer erreichen kann,
- Schritte zum Nachstellen,
- ob du die Lücke veröffentlichen willst und wann.

## Ablauf

- Eingang wird bestätigt, meist innerhalb weniger Tage.
- Wir prüfen, beheben und melden uns mit einem Zeitplan.
- Auf Wunsch nennen wir dich im Advisory.
- Kein Bug-Bounty, keine Prämie. Das ist ein kleines Projekt.

## Umfang

Zum Projekt gehören:

- Anwendung und API (Kern und Hub),
- Docker-Images und Compose-Dateien,
- Anleitungen für Betrieb, Backup und Update.

Nicht zum Projekt gehören fremde Instanzen, deren Serverkonfiguration, TLS,
SMTP, Firewall oder Docker-Host. Dafür ist der Betreiber verantwortlich.

## Bekannte Grundsätze

- Kein Standardpasswort, kein Schlüssel im Browser.
- Sessions mit HttpOnly, Secure, SameSite, CSRF-Schutz. Kein Token im
  localStorage.
- PDFs außerhalb des Webroots, Zugriff nur für Mitglieder.
- Uploads validiert, mit Größen- und Seitenlimit, Prüfsumme, ohne Base64-PDFs
  in der Datenbank.
- Rechte serverseitig, pro Aktion und Objekt.
- Keine Telemetrie, kein Telefon nach Hause.

## Keine echten Daten

Dieses Repository enthält keine echten Banddaten. Bitte auch nicht in Issues
oder Pull Requests.
