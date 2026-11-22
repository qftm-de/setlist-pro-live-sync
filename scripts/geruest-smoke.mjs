#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projekt = `geruest-smoke-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
const env = {
  ...process.env,
  APP_MODE: "core",
  DJANGO_SECRET_KEY: `smoke-${randomUUID()}-${randomUUID()}`,
  DJANGO_DEBUG: "false",
  ALLOWED_HOSTS: "testserver,api,localhost,127.0.0.1",
  TRUST_PROXY_HEADERS: "false",
  POSTGRES_PASSWORD: `smoke-${randomUUID()}`,
  WEB_PORT: process.env.WEB_PORT || "18080",
};

function fail(output) {
  console.error(output?.stdout || "");
  console.error(output?.stderr || "");
  spawnSync("docker", ["compose", "-p", projekt, "down", "-v"], { cwd: root, env, encoding: "utf8" });
  process.exit(1);
}

function run(args) {
  const result = spawnSync("docker", ["compose", "-p", projekt, ...args], { cwd: root, env, encoding: "utf8" });
  if ((result.status ?? 1) !== 0) {
    fail(result);
  }
  return result;
}

run(["config", "-q"]);
run(["build"]);
run(["up", "-d", "db", "--wait"]);
run(["run", "--rm", "--no-deps", "api", "python", "manage.py", "test"]);
run(["up", "-d", "--wait"]);

let antwort = null;
for (let versuch = 0; versuch < 30; versuch++) {
  try {
    antwort = await fetch(`http://localhost:${env.WEB_PORT}/api/health/`);
    if (antwort.ok) {
      break;
    }
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

if (!antwort || !antwort.ok) {
  fail({ stderr: "Health-Endpoint antwortet nicht mit 200." });
}

const koerper = await antwort.json();
if (koerper.status !== "ok") {
  fail({ stderr: `Health-Endpoint antwortet falsch: ${JSON.stringify(koerper)}` });
}

const statik = await fetch(`http://localhost:${env.WEB_PORT}/static/admin/css/base.css`);
if (!statik.ok) {
  fail({ stderr: `Admin-Statik antwortet nicht mit 200: ${statik.status}` });
}

run(["down", "-v"]);
console.log("geruest-smoke ok");
