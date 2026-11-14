#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseRequirements,
  renderRequirements,
  listChangedFiles,
  affectedItems,
  loadAllowList,
  verifyErlaubt,
  runCommand,
} from "./lib/requirements.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reqPath = path.join(root, "REQUIREMENTS.md");
const args = process.argv.slice(2);
const listAffected = args.includes("--affected");
const verifyAffected = args.includes("--verify-affected");
const noWrite = args.includes("--no-write");
const onlyIds = args.filter((a) => /^R\d+$/.test(a));

if (!fs.existsSync(reqPath)) {
  process.stderr.write("REQUIREMENTS.md fehlt.\n");
  process.exit(1);
}

const raw = fs.readFileSync(reqPath, "utf8");
const items = parseRequirements(raw);
const changed = listChangedFiles(root);
const affected = affectedItems(items, changed);
const allow = loadAllowList(root);

if (listAffected) {
  if (changed.length === 0) {
    process.stdout.write("Keine geänderten Dateien im Working Tree. Voller Lauf prüft alle R-Zeilen.\n");
    process.exit(0);
  }
  process.stdout.write(`${changed.length} geänderte Datei(en).\n`);
  if (affected.length === 0) {
    process.stdout.write("Keine R-Zeile trifft den Scope. Scope in REQUIREMENTS.md ergänzen oder Harness-Datei ignorieren.\n");
    process.exit(0);
  }
  process.stdout.write(`${affected.length} betroffene R-Zeile(n):\n`);
  for (const row of affected) {
    const sample = row.hits.slice(0, 3).join(", ") + (row.hits.length > 3 ? ", …" : "");
    process.stdout.write(`  ${row.id} (${row.state}) ← ${sample}\n`);
  }
  process.stdout.write("Gezielt prüfen: node scripts/verify-requirements.mjs --verify-affected\n");
  process.stdout.write("Vor Merge: node scripts/gate.mjs --voll\n");
  process.exit(0);
}

let chosen = items;
if (onlyIds.length) {
  const want = new Set(onlyIds);
  chosen = items.filter((i) => want.has(i.id));
} else if (verifyAffected) {
  chosen = affected.map(({ hits, ...rest }) => rest);
}

let failed = false;
for (const item of chosen) {
  const reg = verifyErlaubt(item.verify, allow);
  if (reg !== true) {
    process.stderr.write(`${item.id}: ${reg}\n`);
    failed = true;
    continue;
  }
  const result = runCommand(item.verify, root);
  if (result.code !== 0) {
    process.stderr.write(`${item.id} rot:\n${result.stdout}\n${result.stderr}\n`);
    failed = true;
    continue;
  }
  item.state = "passing";
  process.stdout.write(`${item.id} passing\n`);
}

if (!noWrite && !failed) {
  fs.writeFileSync(reqPath, renderRequirements(raw, items), "utf8");
}

process.exit(failed ? 1 : 0);
