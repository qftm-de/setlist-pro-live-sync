# ADR-0002: Instanz-Einladung ohne Band

- Status: akzeptiert
- Datum: 2026-11-25
- Verantwortlich: Entwicklung Core
- Bezug: `REQUIREMENTS.md` (`R6`, `R23`, `R24`), `docs/adr/0001-einladung-mit-kontoerstellung.md`

## Kontext

ADR-0001 bindet jede Kontoanlage an eine bestehende Band. Für eine fremde Band,
die den Server selbst nutzen will, hieße das: Der Betreiber legt vorher eine Band
mit fremdem Namen an und tritt später wieder aus. Das ist umständlich, und in der
Zwischenzeit sieht der Betreiber fremde Inhalte.

Gebraucht wird ein Weg, der nur ein Konto anlegt. Die Band entsteht danach im
normalen Ablauf über `POST /api/bands/`, den jedes angemeldete Konto nutzen darf
(`R7`).

## Entscheidung

Es gibt eine zweite Einladungsart, die **Instanz-Einladung**. Sie hat keinen
Bandbezug, wird vom Betreiber per `manage.py instanz_einladung` erzeugt und liegt
im Modell `InstanzEinladung`. Laufzeit 1 bis 90 Tage, optionales Nutzungslimit 1
bis 100, Widerruf per `--widerrufen`. Die Datenbank speichert nur den
SHA-256-Hash; der Klartext erscheint einmal in der Kommandoausgabe.

Der Beitritt läuft über `GET /api/beitritt/<token>/` (schreibfreie Vorschau) und
`POST /api/beitritt/<token>/accept/` (Modi `login` und `register`). Beide sind
Django-Views unter der CSRF-Middleware, teilen sich die nginx-Zone `einladung`
mit der Band-Einladung und werden wie diese im Log redigiert. Der Beitritt legt
kein `Membership` an.

Hash, Grenzwerte, Ausnahmen und die Suche unter Zeilensperre liegen für beide
Einladungsarten in `backend/core/einladungstoken.py`. Band- und Instanzmodul
behalten nur ihre Fachanteile.

## Betrachtete Alternativen

- **`BandInvitation.band` nullable machen:** Verworfen. Jede Auswertung müsste den
  Sonderfall prüfen, und die Band-Einladung hätte zwei Bedeutungen in einem Modell.
- **Offene Registrierung:** Verworfen, wie in ADR-0001. Der Zutritt bleibt an einen
  gültigen Link gebunden.
- **Betreiber legt die Band vorher an:** Verworfen. Fremder Name, fremde Inhalte,
  zusätzlicher Austritt.

## Konsequenzen

- Zweiter öffentlicher Token-Pfad. Er braucht dieselbe Bremse, dieselbe
  Log-Redaktion und dieselbe CSRF-Behandlung wie der Band-Pfad. Beides ist
  umgesetzt und geprüft.
- Der Betreiber braucht Zugriff auf das Verwaltungskommando, also Shell im
  `api`-Container. Ein Weg über die Oberfläche ist nicht Teil dieser Entscheidung.
- `R6` sagt jetzt, dass Konten nur über einen gültigen Einladungslink entstehen,
  nicht mehr, dass es nur Band-Einladungen gibt.
- Wer den Link erhält, kann ein Konto anlegen, aber ohne weitere Einladung keine
  zweite Band betreten. Die Mitgliedschaft in der eigenen Band entsteht beim
  Anlegen der Band.
