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
import fs from "node:fs";
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

// Statische Pruefung: Der oeffentliche Pfad braucht dieselbe Bremse und
// dieselbe Log-Redaktion wie die Band-Einladung. Ein fehlender Block faellt
// hier auf, ohne dass Docker laufen muss.
const nginx = fs.readFileSync(path.join(root, "frontend", "nginx.conf"), "utf8");
const redaktion = fs.readFileSync(
  path.join(root, "backend", "core", "log_redaktion.py"),
  "utf8",
);
const pflicht = [
  [/location \^~ \/api\/beitritt\//, "nginx: location /api/beitritt/ fehlt"],
  [/api\/beitritt/, "nginx: Token-Redaktion fuer api/beitritt fehlt"],
  [/beitritt/, "log_redaktion: beitritt-Pfad fehlt"],
];
for (const [muster, meldung] of pflicht) {
  if (!muster.test(nginx + "\n" + redaktion)) {
    process.stderr.write(`${meldung}\n`);
    process.exit(1);
  }
}
if (!/location \^~ \/api\/beitritt\/ \{[\s\S]{0,400}limit_req zone=einladung/.test(nginx)) {
  process.stderr.write("nginx: /api/beitritt/ ohne limit_req zone=einladung\n");
  process.exit(1);
}

const hoch = compose(["up", "-d", "--wait", "db", "cache"]);
if (hoch.status !== 0) {
  abbruch(`Start von db und cache fehlgeschlagen:\n${hoch.stderr || hoch.stdout}`);
}

const test = compose([
  "run",
  "--rm",
  "--build",
  "--no-deps",
  "api",
  "python",
  "manage.py",
  "test",
  "api.test_instanz_einladung",
  "api.test_instanz_einladungen_api",
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
