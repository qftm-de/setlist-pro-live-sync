#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowPfad = path.join(root, ".github", "workflows", "ci.yml");

if (!fs.existsSync(workflowPfad)) {
  console.error("CI-Workflow fehlt: .github/workflows/ci.yml");
  process.exit(1);
}

const workflow = parse(fs.readFileSync(workflowPfad, "utf8"));
const fehler = [];

function befehle(job) {
  return (job?.steps || [])
    .map((step) => step.run)
    .filter((run) => typeof run === "string")
    .join("\n");
}

function enthaelt(text, teil) {
  return String(text || "").includes(teil);
}

function nutztVersion(job, name, wert) {
  return (job?.steps || []).some(
    (step) => String(step?.with?.[name] ?? "") === String(wert),
  );
}

function nutztMajor(job, name, major) {
  return (job?.steps || []).some((step) =>
    String(step?.with?.[name] ?? "").startsWith(`${major}.`) ||
    String(step?.with?.[name] ?? "") === String(major),
  );
}

const jobs = workflow?.jobs || {};
const gate = jobs.gate;
const frontend = jobs.frontend;
const backend = jobs.backend;

if (!gate) {
  fehler.push("Job gate fehlt.");
} else {
  const text = befehle(gate);
  if (!enthaelt(text, "node scripts/requirements-gate.mjs --check")) {
    fehler.push("Gate prüft die Anforderungen nicht.");
  }
  if (!enthaelt(text, "node scripts/review-constraints.mjs")) {
    fehler.push("Gate prüft die Sicherheits-Baseline nicht.");
  }
}

if (!frontend) {
  fehler.push("Job frontend fehlt.");
} else {
  const text = befehle(frontend);
  for (const pflicht of ["npm ci", "npm run build", "npm test"]) {
    if (!enthaelt(text, pflicht)) {
      fehler.push(`Frontend-Job führt nicht aus: ${pflicht}`);
    }
  }
  if (!nutztMajor(frontend, "node-version", "26")) {
    fehler.push("Frontend-Job nutzt nicht Node 26.");
  }
}

if (!backend) {
  fehler.push("Job backend fehlt.");
} else {
  const text = befehle(backend);
  if (!enthaelt(text, "python manage.py test")) {
    fehler.push("Backend-Job führt die Tests nicht aus.");
  }
  const postgres = backend.services?.postgres;
  if (!postgres) {
    fehler.push("Backend-Job hat keinen PostgreSQL-Dienst.");
  } else if (!String(postgres.image || "").startsWith("postgres:18")) {
    fehler.push("Backend-Job nutzt nicht PostgreSQL 18.");
  }
  if (backend.env?.APP_MODE !== "core") {
    fehler.push("Backend-Job setzt APP_MODE nicht auf core.");
  }
  if (!nutztVersion(backend, "python-version", "3.13")) {
    fehler.push("Backend-Job nutzt nicht Python 3.13.");
  }
}

function pruefeSchritte(job, name) {
  for (const step of job?.steps || []) {
    if (step["continue-on-error"] === true) {
      fehler.push(`${name}: Schritt ${step.name || step.uses || "unbenannt"} darf nicht fehlertolerant sein.`);
    }
  }
}
for (const [name, job] of Object.entries(jobs)) {
  pruefeSchritte(job, name);
}

if (workflow?.on?.pull_request_target) {
  fehler.push("pull_request_target ist nicht erlaubt.");
}

if (fehler.length) {
  console.error("CI-Prüfung rot:");
  for (const eintrag of fehler) {
    console.error(`- ${eintrag}`);
  }
  process.exit(1);
}

console.log("verify-ci ok");
