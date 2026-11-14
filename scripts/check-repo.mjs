#!/usr/bin/env node
// R1-Verify: Repo-Grundausstattung und Agent-Harness sind vorhanden und
// versionierbar, der Brownfield-Bestand bleibt unversioniert.
// Läuft im Working Tree und im sauberen CI-Checkout (alte_projektdatein/ fehlt dort planmäßig).

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fehler = [];

const pflichtDateien = [
  "README.md",
  "LICENSE",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "SECURITY.md",
  "CHANGELOG.md",
  ".editorconfig",
  ".gitattributes",
  ".env.example",
  ".gitignore",
  "AGENTS.md",
  "kilo.jsonc",
  "docker-compose.yml",
  ".github/workflows/ci.yml",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/ISSUE_TEMPLATE/fehler.yml",
  ".github/ISSUE_TEMPLATE/funktionswunsch.yml",
  "docs/templates/REQUIREMENTS.md",
  "docs/conventions.md",
  "harness/projekt.yaml",
  "harness/module.yaml",
  "scripts/gate.mjs",
  "scripts/requirements-gate.mjs",
  "scripts/verify-requirements.mjs",
  "scripts/review-constraints.mjs",
  "scripts/lint-file-size.mjs",
  "scripts/review-stand.mjs",
  "scripts/review-kilo.mjs",
  ".githooks/pre-push",
];

for (const rel of pflichtDateien) {
  if (!fs.existsSync(path.join(root, rel))) {
    fehler.push(`Pflichtdatei fehlt: ${rel}`);
  }
}

// Gate muss laufen und Schritte kennen.
const gate = spawnSync(process.execPath, [path.join(root, "scripts", "gate.mjs"), "--list"], {
  cwd: root,
  encoding: "utf8",
});
if ((gate.status ?? 1) !== 0 || (gate.stdout || "").trim().length === 0) {
  fehler.push("node scripts/gate.mjs --list liefert keine Schritte");
}

// Brownfield-Schutz: alte_projektdatein/ bleibt ignoriert und unversioniert.
// In einem CI-Checkout existiert der Ordner nicht, der Check entfällt dann.
const altPath = path.join(root, "alte_projektdatein");
if (fs.existsSync(altPath)) {
  const ignoriert = spawnSync("git", ["check-ignore", "-q", "alte_projektdatein"], {
    cwd: root,
    encoding: "utf8",
  });
  if ((ignoriert.status ?? 1) !== 0) {
    fehler.push("alte_projektdatein/ ist nicht gitignored");
  }
  const getrackt = spawnSync("git", ["ls-files", "alte_projektdatein"], {
    cwd: root,
    encoding: "utf8",
  });
  if ((getrackt.status ?? 1) !== 0 || (getrackt.stdout || "").trim().length > 0) {
    fehler.push("alte_projektdatein/ ist versioniert (git ls-files liefert Treffer)");
  }
} else {
  console.log("Hinweis: alte_projektdatein/ fehlt (erwartbar in CI oder frischem Clone).");
}

if (fehler.length > 0) {
  for (const f of fehler) {
    process.stderr.write(`${f}\n`);
  }
  process.exit(1);
}
console.log("check-repo ok: Grundausstattung und Harness vorhanden, Brownfield unversioniert.");
