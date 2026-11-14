#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projekt = "setlist-foundation";
const env = {
  ...process.env,
  APP_MODE: "core",
  DJANGO_SECRET_KEY: `foundation-${randomUUID()}-${randomUUID()}`,
  DJANGO_DEBUG: "false",
  ALLOWED_HOSTS: "testserver,api,localhost,127.0.0.1",
  CSRF_TRUSTED_ORIGINS: "https://pilot.example",
  TRUST_PROXY_HEADERS: "false",
  POSTGRES_PASSWORD: `foundation-${randomUUID()}`,
};

function compose(args) {
  return spawnSync("docker", ["compose", "-p", projekt, ...args], {
    cwd: root,
    env,
    encoding: "utf8",
  });
}

function aufraeumen() {
  compose(["down", "-v", "--remove-orphans"]);
}

function pruefe(args, beschreibung) {
  const result = compose(args);
  if ((result.status ?? 1) === 0) {
    return;
  }
  console.error(`Fehlgeschlagen: ${beschreibung}`);
  console.error(result.stdout || "");
  console.error(result.stderr || "");
  aufraeumen();
  process.exit(1);
}

try {
  pruefe(["config", "-q"], "Compose-Konfiguration");
  pruefe(["build", "api"], "API-Image bauen");
  pruefe(["up", "-d", "db", "--wait"], "PostgreSQL starten");
  pruefe(
    ["run", "--rm", "--no-deps", "api", "python", "manage.py", "check"],
    "Django-Systemprüfung",
  );
  pruefe(
    ["run", "--rm", "--no-deps", "api", "python", "manage.py", "test"],
    "Backend-Tests",
  );
} finally {
  aufraeumen();
}

console.log("verify-foundation ok");
