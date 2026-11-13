# harness/ — hier trägst du ein

Alles in `.cursor/`, `.kilo/`, `.claude/`, `.codex/` und `.agents/` wird
aus diesen Dateien erzeugt. Nach einer Änderung:

```bash
node scripts/harness.mjs render
```

| Datei | Zweck |
|---|---|
| `projekt.yaml` | Name, Typ, Stack, Test/Lint/Build, Git, Sprache, Ansprache |
| `agenten.yaml` | Tools (cursor, kilo, claude-code, codex), Rollen → Modelle, Provider |
| `module.yaml` | welche Bausteine an sind |
| `content.yaml` | nur mit Content-Team: Bereich, Schienen, Kanäle, Freigaben |
| `mcp.yaml` | MCP-Server |
| `eigene/rules` | projekteigene Regeln |
| `eigene/skills` | projekteigene Skills |
| `eigene/agents` | projekteigene Agenten |
| `lock.json` | maschinell, nicht anfassen |

Modelle stehen nur in `agenten.yaml`. Agenten-Dateien nennen eine Rolle
(`code`, `plan`, `plan-heavy`, `review`, `writer`, …), kein Modell.

Provider tragen nur den Namen der Umgebungsvariable (`key_env`), nie den Key.
Keys gehören nach `.env` (gitignored). `.env.example` listet die Namen.

Cursor: Das Hauptmodell wählst du in der Oberfläche. Die Rollen hier sind
Empfehlung plus Belegung der Subagenten.

Vor Updates `node scripts/harness.mjs update --dry-run` ausführen. Konflikte
werden unter `harness/conflicts/` dokumentiert und blockieren die Anwendung.
Lokale Ergänzungen gehören nach `eigene/`; gleiche Namen sind Fehler.
Policies in projekt.yaml: git (user_only/on_request), requirements
(required/optional), review (on_request/required/off). Die jeweils ersten Werte
sind Standard. Original-Skills werden unabhängig von angepassten Fassungen gepflegt.
