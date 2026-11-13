# beusti_musik

Setlist Pro ist eine Band-App für Setlisten, Songs, Mitglieder und Auftritte.
Sie läuft als installierbare Single-File-PWA ohne Build-Schritt und wird über
Netlify ausgeliefert.

## Stand

Brownfield-Start. Der übernommene Bestand liegt unverändert unter
`alte_projektdatein/` und dient als Referenz. Der Ordner ist bewusst nicht
versioniert, weil er Zugangsdaten enthält. Neue Arbeit beginnt mit einer Zeile
in `REQUIREMENTS.md`.

## Arbeiten

```bash
node scripts/harness.mjs check      # Config prüfen
node scripts/harness.mjs render     # Dateien aus harness/ neu erzeugen
node scripts/gate.mjs --schnell     # vor dem Commit
node scripts/gate.mjs --voll        # vor Push oder Merge Request
```

Git-Schreibaktionen macht der Mensch. Der Pre-Push-Hook wird mit
`git config core.hooksPath .githooks` aktiv.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `harness/` | einzige Quelle für Projekt-, Agenten- und Modulconfig |
| `docs/` | Konventionen und Vorlagen |
| `scripts/` | Gate, Requirements und Review |
| `.claude/`, `.codex/`, `.agents/` | erzeugt aus `harness/`, nicht direkt ändern |
| `alte_projektdatein/` | Bestand vor dem Harness-Start |

## Deployment

Netlify liefert das Repo-Root aus (`netlify.toml`, `_redirects`). Der Service
Worker cached versioniert. Nach Änderungen an `sw.js` die Cache-Version erhöhen.
