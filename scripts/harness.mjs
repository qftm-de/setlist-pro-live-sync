#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = path.join(project, "harness", "lock.json");
const lock = fs.existsSync(lockPath) ? JSON.parse(fs.readFileSync(lockPath, "utf8")) : {};
const home = process.env.HARNESS_HOME || lock.source;
if (!home || !fs.existsSync(path.join(home, "scripts", "harness.mjs"))) {
  console.error("Harness-Quelle nicht gefunden. HARNESS_HOME setzen oder lock.json.source prüfen.");
  process.exit(1);
}
const r = spawnSync(process.execPath, [path.join(home, "scripts", "harness.mjs"), ...process.argv.slice(2), "--project", project], { stdio: "inherit" });
process.exit(r.status ?? 1);
