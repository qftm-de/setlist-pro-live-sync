#!/usr/bin/env node
// Pre-Push-Review: ruft den Kilo-Review-Agenten non-interaktiv auf (kilo run --agent review).
// Gate-Schritt kilo-review in harness/projekt.yaml, läuft vor review-stand.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const findingsPath = path.join(root, ".tmp", "review", "findings.md");
const timeoutSekunden = Number.parseInt(process.env.KILO_REVIEW_TIMEOUT || "", 10) || 600;

function git(args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if ((result.status ?? 1) !== 0) {
    return null;
  }
  return result.stdout;
}

function stand() {
  const r = spawnSync(process.execPath, [path.join(root, "scripts", "review-stand.mjs")], {
    cwd: root,
    encoding: "utf8",
  });
  if ((r.status ?? 1) !== 0) {
    process.stderr.write("review-stand.mjs fehlgeschlagen\n");
    process.exit(1);
  }
  const head = (r.stdout || "").split(/\r?\n/).find((l) => l.startsWith("HEAD ")) || "";
  const diff = (r.stdout || "").split(/\r?\n/).find((l) => l.startsWith("DIFF ")) || "";
  if (!head || !diff) {
    process.stderr.write("review-stand.mjs lieferte keinen Stand\n");
    process.exit(1);
  }
  return { head, diff };
}

function findingsAktuell(st) {
  if (!fs.existsSync(findingsPath)) {
    return false;
  }
  const text = fs.readFileSync(findingsPath, "utf8");
  return text.includes(st.head) && text.includes(st.diff);
}

// Review-Basis: der tatsächliche Commit-Bereich plus Working Tree.
// Kette: Upstream → origin/main → main. Ein Kandidat entfällt, wenn der
// Merge-Base HEAD selbst ist (dann gäbe es keinen diffbaren Bereich).
// Ohne auflösbare Basis bleibt nur der Working Tree; committete Arbeit
// läge dann außerhalb des Reviews, deshalb wird das gemeldet.
function diffBasis() {
  const dirty = (git(["status", "--porcelain=v1"]) || "").trim().length > 0;
  if (dirty) {
    return null;
  }
  const head = (git(["rev-parse", "HEAD"]) || "").trim();
  if (!/^[0-9a-f]{7,40}$/.test(head)) {
    return null;
  }
  const upstream = (git(["rev-parse", "--abbrev-ref", "@{u}"]) || "").trim();
  const kandidaten = [];
  if (upstream) {
    kandidaten.push(upstream);
  }
  kandidaten.push("origin/main", "main");
  for (const ref of kandidaten) {
    const base = (git(["merge-base", "HEAD", ref]) || "").trim();
    if (/^[0-9a-f]{7,40}$/.test(base) && base !== head) {
      return base;
    }
  }
  process.stderr.write("Keine Review-Basis gefunden (kein Upstream, kein origin/main/main). Review prüft nur den Working Tree.\n");
  return null;
}

function kurz(text) {
  const t = (text || "").trim();
  return t.length <= 400 ? t : t.slice(-400);
}

const st = stand();
if (findingsAktuell(st)) {
  console.log(`Review für diesen Stand bereits aktuell (${st.head.slice(5, 12)})`);
  process.exit(0);
}

const kiloCheck = spawnSync("sh", ["-c", "command -v kilo"], { encoding: "utf8" });
if ((kiloCheck.status ?? 1) !== 0) {
  process.stderr.write("kilo nicht im PATH, Pre-Push-Review nicht möglich\n");
  process.exit(1);
}

const base = diffBasis();
const env = { ...process.env };
if (base) {
  env.REQUIREMENTS_DIFF_BASE = base;
}
const basisText = base ? `Branch-Diff ab ${base.slice(0, 12)} (REQUIREMENTS_DIFF_BASE gesetzt)` : "Working Tree";

const r = spawnSync("kilo", [
  "run",
  "--agent", "review",
  "--title", "Pre-Push-Review",
  `Pre-Push-Review: Prüfe den Diff nach dem Skill review. Basis: ${basisText}. Schreibe .tmp/review/findings.md.`,
], { cwd: root, encoding: "utf8", env, timeout: timeoutSekunden * 1000, shell: process.platform === "win32" });

if ((r.error && r.error.code === "ETIMEDOUT") || r.signal === "SIGTERM") {
  process.stderr.write(`kilo run Timeout nach ${timeoutSekunden}s (KILO_REVIEW_TIMEOUT anpassbar)\n`);
  process.exit(1);
}
if ((r.status ?? 1) !== 0) {
  process.stderr.write(`kilo run fehlgeschlagen (Exit ${r.status}):\n${kurz(r.stderr || r.stdout)}\n`);
  process.exit(r.status ?? 1);
}

if (!findingsAktuell(stand())) {
  process.stderr.write("kilo run lief, aber findings.md passt nicht zum aktuellen Stand\n");
  process.exit(1);
}

console.log(`Review geschrieben: .tmp/review/findings.md (${stand().head.slice(5, 12)})`);
