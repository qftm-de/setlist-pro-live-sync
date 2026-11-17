# Support

Setlist Pro ist ein selbst gehostetes Projekt. Es gibt keinen bezahlten Support
und keine zugesagte Wiederherstellung von Daten.

## Sicherheitsmeldungen

Schwachstellen bitte über die private Schwachstellenmeldung des Repositories
melden (GitHub, Tab "Security", "Report a vulnerability"). Nicht als öffentliches
Issue. Wir bestätigen den Eingang innerhalb von drei Werktagen und nennen danach
einen Zeitplan für die Behebung. Sicherheitsfixes erscheinen im Abschnitt
`Security` der `CHANGELOG.md`, ohne Ausnutzungsdetails vor der Bereitstellung.

## Fehler und Wünsche

Reguläre Fehler und Wünsche gehören als Issue ins Repository. Hilfreich sind
Version oder Commit, Betriebsart (`core` oder `hub`), Browser und die Schritte
bis zum Fehler. Bitte keine Zugangsdaten, Tokens oder personenbezogenen Daten in
Issues.

## Veröffentlichungen

Getaggte Versionen mit Änderungen aus `CHANGELOG.md`. Die Images liegen in der
GitHub Container Registry (GHCR). Ein Update ist ein neuer Container, kein
Datenbankmuster von Hand. Vor dem Aktualisieren ein Backup der Datenbank ziehen.

## Betrieb

Betriebsfragen deckt `docs/betrieb.md` ab. Wer selbst hostet, verantwortet
Backups, TLS, Reverse Proxy und die Aktualisierung der Images.
