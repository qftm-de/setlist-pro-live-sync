# Versionen der Fremdpakete

Stand: 14.11.2026. Grundlage sind die Live-Abfragen bei npm, PyPI und Docker Hub sowie die EOL-Daten von endoflife.date. Die Liste deckt das Gerüst und die für den Kern geplanten Pakete ab.

## Regeln

- Neueste stabile Version, keine Release Candidates oder Betas.
- LTS bevorzugen, wenn das Ökosystem noch nicht nachgezogen ist.
- Python exakt pinnen. npm hält die Version über `package-lock.json`.
- Docker-Images mit Major.Minor.Patch pinnen. Für Releases zusätzlich den Digest.
- Sicherheitsupdates zuerst. Feature-Upgrades nur mit Test und CHANGELOG-Eintrag.
- Vor jedem Release die Liste neu prüfen.

## Basis-Images

| Baustein | Heute | Neueste stabil | Empfehlung | Hinweis |
|---|---|---|---|---|
| Python | `python:3.13.18-slim` | 3.15.2 | `python:3.13.18-slim` | Django 5.2 unterstützt 3.14. Gunicorn 27.0.1 und Daphne 4.2.3 nennen 3.13 als höchste getestete Version. |
| Node | `node:26.13.1-alpine` | 26.13.1 LTS | `node:26.13.1-alpine` | Node 26 ist seit 28.10.2026 LTS. Vite 8 und Vitest 5 unterstützen ihn. Node 24.22.3 bleibt eine sichere Alternative. |
| nginx | `nginx:1.30.6-alpine` | 1.30.6 Stable, 1.31.8 Mainline | `nginx:1.30.6-alpine` | Stable-Zweig statt Mainline. |
| PostgreSQL | `postgres:18.7-alpine` | 18.7 | `postgres:18.7-alpine` | 19 ist nur RC2. Ab 18 liegt das Volume unter `/var/lib/postgresql`, nicht mehr unter `/var/lib/postgresql/data`. |
| Redis | `redis:8.10.3-alpine` | 8.10.3 | `redis:8.10.3-alpine` | Redis 8 steht zusätzlich unter AGPLv3. Das passt zur Projektlizenz. |

## Backend

| Paket | Zweck | Heute | Neueste stabil | Empfehlung |
|---|---|---|---|---|
| Django | Web-Framework, Auth, Admin | `>=5.2.19,<5.3` | 6.1.3 | `>=5.2.19,<5.3` bleiben. 6.1.3 erst, wenn Channels und die übrigen Pakete nachziehen. |
| djangorestframework | REST-API | `>=3.18.3,<4` | 3.18.3 | `>=3.18.3,<4`. Unterstützt Django 5.2, 6.0 und 6.1. |
| psycopg[binary] | PostgreSQL-Treiber | `>=3.3.9,<4` | 3.3.9 | `>=3.3.9,<4`. |
| gunicorn | WSGI-Server | `>=27.0.1,<28` | 27.0.1 | `>=27.0.1,<28`. 27.0.1 ist vom 12.11.2026, bei Problemen auf 26.2.0 zurück. |
| channels | ASGI und WebSocket | geplant für R8 | 4.3.2 | `>=4.3.2,<5`. Nennt Django 6.0 als höchste unterstützte Version. |
| channels-redis | Channel-Layer über Redis | geplant für R8 | 4.3.0 | `>=4.3.0,<5`. Zieht `redis>=4.6` nach. |
| daphne | ASGI-Server | geplant für R8 | 4.2.3 | `>=4.2.3,<5`. Offizieller Server für Channels. Alternative: `uvicorn` 0.54.0. |
| pypdf | PDF prüfen und Seiten zählen | geplant für R6 | 7.1.0 | `>=7.1.0,<8`. |
| django-allauth | Registrierung und E-Mail-Verifikation | geplant für R6 | 65.22.1 | `>=65.22.1,<66`. Headless auch im Core. Der Core nutzt lokale Konten und Sessions. |
| argon2-cffi | Passwort-Hashing | `>=25.1.0,<26` | 25.1.0 | `>=25.1.0,<26`. In `PASSWORD_HASHERS` vor PBKDF2 setzen. |
| django-filter | Filter in der API | optional für R5 | 26.2 | `>=26.2,<27`. |
| drf-spectacular | OpenAPI-Schema | optional | 0.30.0 | `>=0.30.0,<0.31`. Nennt Django 6.0 als höchste Version. |
| django-cors-headers | CORS | nicht nötig | 4.9.0 | Nur bei getrennten Origins. Vite-Proxy und nginx auf einer Domain lösen das. |
| django-ratelimit | Rate-Limits | Kandidat für den Hub | 4.1.0 | Letztes Release am 24.07.2023. Vor Einsatz prüfen oder über nginx regeln. |

## Frontend

| Paket | Zweck | Heute | Neueste stabil | Empfehlung |
|---|---|---|---|---|
| react | UI | `^19.3.1` | 19.3.1 | `^19.3.1`. |
| react-dom | DOM-Renderer | `^19.3.1` | 19.3.1 | `^19.3.1`. |
| @types/react | Typen | `^19.3.0` | 19.3.0 | `^19.3.0`. |
| @types/react-dom | Typen | `^19.3.0` | 19.3.0 | `^19.3.0`. |
| vite | Build und Dev-Server | `^8.3.8` | 8.3.8 | `^8.3.8`. |
| @vitejs/plugin-react | React-Plugin | `^6.3.0` | 6.3.0 | `^6.3.0`. Verlangt Vite 8. |
| typescript | Typprüfung | `^7.0.2` | 7.0.2 | `^7.0.2`. |
| vitest | Unit-Tests | `^5.1.0` | 5.1.0 | `^5.1.0`. |
| react-router-dom | Routing | geplant | 7.18.5 | `^7.18.5`. |
| @tanstack/react-query | Server-State und Cache | geplant | 5.107.1 | `^5.107.1`. |
| pdfjs-dist | PDF-Anzeige | geplant für R6 | 6.5.438 | `^6.5.438`. Den Worker separat über Vite laden. |
| vite-plugin-pwa | Offline und PWA | geplant | 2.0.0 | `^2.0.0`. Peers: `workbox-build` und `workbox-window` 7.4.1. |
| workbox-build | PWA-Build | transitiv | 7.4.1 | `^7.4.1`. |
| workbox-window | Service-Worker-Registrierung | transitiv | 7.4.1 | `^7.4.1`. |
| zod | Schema-Validierung | optional | 4.6.7 | `^4.6.7`. |
| react-hook-form | Formulare | optional | 7.92.0 | `^7.92.0`. |
| tailwindcss | Styles | Kandidat | 4.3.5 | `^4.3.5`. Entscheidung steht aus. |
| @tailwindcss/vite | Tailwind-Plugin für Vite | Kandidat | 4.3.5 | `^4.3.5`. Kein PostCSS-Setup nötig. |
| clsx | Klassennamen | optional | 2.1.1 | `^2.1.1`. |
| date-fns | Datum und Zeit | optional | 4.4.0 | `^4.4.0`. |

## Test und Lint

| Paket | Zweck | Neueste stabil | Empfehlung |
|---|---|---|---|
| @testing-library/react | Komponententests | 16.3.3 | `^16.3.3`. |
| @testing-library/dom | Peer von Testing Library | 10.4.2 | `^10.4.2`. |
| @testing-library/jest-dom | DOM-Matcher | 7.0.1 | `^7.0.1`. |
| jsdom | DOM für Vitest | 31.0.1 | `^31.0.1`. |
| @playwright/test | E2E für R10 | 1.65.1 | `^1.65.1`. |
| @types/node | Typen für Vite-Konfiguration | 26.6.6 | `^26.6.6`, passend zur Node-Linie. |
| eslint | Lint | 10.15.0 | `^10.15.0`. |
| eslint-plugin-react-hooks | Hook-Regeln | 7.1.1 | `^7.1.1`. Unterstützt ESLint 10. |
| prettier | Formatierung | 3.10.1 | `^3.10.1`. |
| typescript-eslint | Typprüfung im Lint | 8.72.2 | Noch nicht einsetzen. Die Peer-Grenze ist `typescript <6.1.0`, das Projekt nutzt 7.0.2. Auf v9 warten. |
| oxlint | Lint-Alternative ohne Typinformation | 1.93.0 | Optional. `tsc --noEmit` bleibt die Typprüfung. |

## Kompatibilität

1. **Django 5.2 LTS bleibt die Basis.** Django 6.1.3 ist die neueste stabile Version. Channels 4.3.2, django-cors-headers 4.9.0 und drf-spectacular 0.30.0 nennen aber Django 6.0 als höchste Version. Der Wechsel lohnt erst mit Django 6.2 LTS oder wenn Channels 6.1 freigibt.
2. **Python 3.13 statt 3.15.** Django 6.1 unterstützt 3.15. Gunicorn 27.0.1 und Daphne 4.2.3 nennen 3.13 als höchste getestete Version. Python 3.13.18 ist der gemeinsame Nenner.
3. **TypeScript 7 und typescript-eslint passen nicht zusammen.** `typescript-eslint` 8.72.2 verlangt TypeScript `<6.1.0`. Bis v9 gilt: `tsc --noEmit` prüft die Typen, ESLint prüft Syntax und Regeln ohne Typinformation, oder oxlint übernimmt den Lint.
4. **Node 22 ist Wartung.** Node 26.13.1 ist aktives LTS. Vite 8, Vitest 5 und das React-Plugin unterstützen es.
5. **PostgreSQL 18 ändert den Volume-Pfad.** In `docker-compose.yml` muss das Volume von `/var/lib/postgresql/data` auf `/var/lib/postgresql` wandern. Sonst liegen die Daten im anonymen Volume.
6. **Redis 8 ist AGPLv3.** Die Lizenz passt zum Projekt. `channels-redis` 4.3.0 verlangt mindestens `redis` 4.6, der Python-Client 8.1.0 erfüllt das.

## Nicht aufnehmen

- `axios`: `fetch` reicht. Kein zusätzlicher Client.
- `socket.io`: Channels nutzt natives WebSocket.
- `zustand` oder `redux`: React Query deckt Server-State, React deckt lokalen State.
- `celery`: Version 1 hat keine Hintergrundjobs.
- `sentry` und andere Telemetrie: Der Core sendet nichts nach außen.
- JWT-Bibliotheken: Der Plan nutzt Sessions und CSRF, kein Token im localStorage.
- `Pillow`: Nur nötig, wenn Bilder verarbeitet werden. PDFs laufen über pypdf und pdfjs.
- `whitenoise`: nginx liefert die statischen Dateien aus.
- `django-cors-headers`: Nur bei getrennten Origins nötig.

## Offene Entscheidungen

- Django 5.2.19 LTS bleibt. Empfehlung: bestätigen.
- Python 3.13.18 im Backend-Image. Empfehlung: bestätigen.
- Node 26 LTS statt 24. Empfehlung: 26, sobald das Image umgestellt wird.
- Tailwind 4 einsetzen oder die Markenfarben als CSS-Variablen pflegen. Empfehlung: CSS-Variablen, solange die Oberfläche klein ist.
- PWA jetzt einplanen oder erst mit dem Bühnenmodus. Empfehlung: erst mit R8, und nur statische Assets cachen.

## Prüfen

```bash
curl -fsSL https://pypi.org/pypi/Django/json | python3 -c "import sys,json; print(json.load(sys.stdin)['info']['version'])"
curl -fsSL https://registry.npmjs.org/vite/latest | python3 -c "import sys,json; print(json.load(sys.stdin)['version'])"
curl -fsSL https://endoflife.date/api/python.json | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['latest'])"
docker manifest inspect postgres:18.7-alpine >/dev/null && echo "Image vorhanden"
```
