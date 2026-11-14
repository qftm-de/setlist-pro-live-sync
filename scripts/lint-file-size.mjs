#!/usr/bin/env node
// Gate-Schritt lint-file-size: keine ausufernden Dateien.
// Code hart bei 500 Zeilen, Doku hart bei 1000. Weiche Grenzen (300/500) nur als Hinweis.
// Generierte und normative Dateien sind exempt.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = process.cwd();

const excludeDirNames = new Set([
  ".git", ".venv", "venv", "node_modules", "__pycache__", "dist",
  "staticfiles", "coverage", ".cache", "vendor", ".tmp", "alte_projektdatein", "_lokal",
  "plans", "conflicts",
]);

// Generiert oder normativ: Größe ist kein Qualitätssignal.
const exempt = new Set([
  "package-lock.json",
  "frontend/package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "harness/lock.json",
  "LICENSE",
  "CHANGELOG.md",
]);

const codeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".css", ".scss", ".html", ".vue", ".php", ".toml", ".yaml", ".yml", ".json"]);
const docExtensions = new Set([".md"]);

const limits = {
  code: { weich: 300, hart: 500 },
  doku: { weich: 500, hart: 1000 },
};

function collectFiles(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }
  const files = [];
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    const name = path.basename(current);
    if (excludeDirNames.has(name) || name.endsWith(".egg-info")) {
      continue;
    }
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        stack.push(path.join(current, entry));
      }
      continue;
    }
    const ext = path.extname(current).toLowerCase();
    if (codeExtensions.has(ext) || docExtensions.has(ext)) {
      files.push(current);
    }
  }
  return files;
}

function rel(filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join("/");
}

const fehler = [];
const hinweise = [];

for (const file of collectFiles(projectRoot)) {
  const r = rel(file);
  if (exempt.has(r)) {
    continue;
  }
  const ext = path.extname(file).toLowerCase();
  const art = codeExtensions.has(ext) ? "code" : "doku";
  const { weich, hart } = limits[art];
  const zeilen = fs.readFileSync(file, "utf8").split("\n").length;
  if (zeilen > hart) {
    fehler.push(`${r}: ${zeilen} Zeilen, harte Grenze ${hart} (${art}) überschritten`);
  } else if (zeilen > weich) {
    hinweise.push(`${r}: ${zeilen} Zeilen, Ziel ${weich} (${art})`);
  }
}

for (const h of hinweise) {
  console.log(`Hinweis: ${h}`);
}

if (fehler.length > 0) {
  for (const f of fehler) {
    process.stderr.write(`${f}\n`);
  }
  process.stderr.write("Datei aufteilen: eine Datei, eine Verantwortlichkeit. Siehe Regel struktur.\n");
  process.exit(1);
}
console.log(`lint-file-size grün${hinweise.length ? ` (${hinweise.length} Hinweis/Hinweise)` : ""}`);
process.exit(0);
