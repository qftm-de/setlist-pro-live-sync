#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseRequirements,
  listChangedFiles,
  affectedItems,
  loadAllowList,
  verifyErlaubt,
  gateFehler,
} from "./lib/requirements.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reqPath = path.join(root, "REQUIREMENTS.md");
const mode = process.argv[2] || "--check";

if (!["--check", "--commands-affected", "--commands-all"].includes(mode)) {
  process.stderr.write("Nur --check, --commands-affected oder --commands-all.\n");
  process.exit(1);
}
if (!fs.existsSync(reqPath)) {
  process.stderr.write("REQUIREMENTS.md fehlt.\n");
  process.exit(1);
}

const raw = fs.readFileSync(reqPath, "utf8");
const items = parseRequirements(raw);
if (items.length === 0) {
  process.stderr.write("Keine R-Zeilen.\n");
  process.exit(1);
}

const allow = loadAllowList(root);

if (mode === "--commands-affected" || mode === "--commands-all") {
  let chosen = items;
  if (mode === "--commands-affected") {
    chosen = affectedItems(items, listChangedFiles(root)).map((row) => {
      const { hits, ...rest } = row;
      return rest;
    });
  }
  for (const item of chosen) {
    const reg = verifyErlaubt(item.verify, allow);
    if (reg !== true) {
      process.stderr.write(`${item.id}: ${reg}\n`);
      process.exit(1);
    }
    process.stdout.write(`${item.id}\t${item.verify}\n`);
  }
  process.exit(0);
}

const errors = gateFehler(items, root, allow);
if (errors.length === 0) {
  process.stdout.write("Requirements-Gate bestanden.\n");
  process.exit(0);
}
process.stderr.write("Requirements-Gate rot:\n- " + errors.join("\n- ") + "\n");
process.exit(1);
