#!/usr/bin/env node
// Führt die in harness/projekt.yaml genannten Test/Lint/Build-Kommandos aus.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadYamlFile } from "./lib/yaml.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wanted = process.argv.slice(2);
const cfgPath = path.join(root, "harness", "projekt.yaml");
if (!fs.existsSync(cfgPath)) {
  console.error("harness/projekt.yaml fehlt.");
  process.exit(1);
}
const projekt = loadYamlFile(cfgPath);
const map = {
  test: projekt.verify?.test,
  lint: projekt.verify?.lint,
  build: projekt.verify?.build,
};

const names = wanted.length ? wanted : Object.keys(map).filter((k) => map[k]);
let rot = false;
for (const name of names) {
  const cmd = map[name];
  if (!cmd) {
    console.log(`übersprungen: ${name} (nicht konfiguriert)`);
    continue;
  }
  const result = spawnSync(cmd, { cwd: root, encoding: "utf8", shell: true });
  if ((result.status ?? 1) !== 0) {
    rot = true;
    console.error(`rot: ${name}\n${result.stdout || ""}\n${result.stderr || ""}`);
    continue;
  }
  console.log(`ok: ${name}`);
}
process.exit(rot ? 1 : 0);
