#!/usr/bin/env node
/**
 * R23-Verify: Instanz-Einladung, die nur ein Konto anlegt.
 *
 * Startet einen eigenen Compose-Verbund mit eigener Datenbank, damit parallele
 * Läufe sich nicht dieselben Container und Volumes wegziehen, und führt die
 * Django-Tests der Instanz-Einladung darin aus.
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projekt = `setlist-instanz-${process.pid}`;
const port = String(18800 + (process.pid % 200));
const env = {
  ...process.env,
  APP_MODE: "core",
  DJANGO_SECRET_KEY: `instanz-${randomUUID()}-${randomUUID()}`,
  DJANGO_DEBUG: "false",
  ALLOWED_HOSTS: "127.0.0.1,localhost,api,web",
  TRUST_PROXY_HEADERS: "false",
  POSTGRES_DB: "setlist",
  POSTGRES_USER: "setlist",
  POSTGRES_PASSWORD: `instanz-${randomUUID()}`,
  WEB_PORT: port,
};

function compose(args) {
  return spawnSync(
    "docker",
    ["compose", "-p", projekt, "-f", "docker-compose.yml", ...args],
    { cwd: root, env, encoding: "utf8" },
  );
}

function abbruch(text) {
  process.stderr.write(`${text}\n`);
  compose(["down", "-v"]);
  process.exit(1);
}

const hoch = compose(["up", "-d", "--wait", "db", "cache"]);
if (hoch.status !== 0) {
  abbruch(`Start von db und cache fehlgeschlagen:\n${hoch.stderr || hoch.stdout}`);
}

const test = compose([
  "run",
  "--rm",
  "--no-deps",
  "api",
  "python",
  "manage.py",
  "test",
  "api.test_instanz_einladung",
]);

const runter = compose(["down", "-v"]);

if (test.status !== 0) {
  process.stderr.write(test.stdout || "");
  process.stderr.write(test.stderr || "");
  abbruch("Instanz-Einladung: Tests rot.");
}
if (runter.status !== 0) {
  abbruch("Aufräumen fehlgeschlagen.");
}

process.stdout.write("verify-instanz-einladung ok\n");
