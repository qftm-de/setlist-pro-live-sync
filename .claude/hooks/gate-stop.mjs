#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const gate = path.join(root, "scripts", "gate.mjs");
const result = spawnSync(process.execPath, [gate, "--schnell"], {
  cwd: root,
  encoding: "utf8",
  timeout: 1200000,
});
if ((result.status ?? 1) === 0) {
  console.log("{}");
  process.exit(0);
}
const out = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
const tail = out.slice(-1500);
console.log(JSON.stringify({
  followup_message: `Gate --schnell ist rot. Behebe die Lücken, dann stoppe erneut.\n${tail}`,
}));
