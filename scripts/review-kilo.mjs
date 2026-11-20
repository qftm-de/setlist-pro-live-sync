#!/usr/bin/env node
// Zweitgutachten: ruft den Kilo-Review-Agenten non-interaktiv auf (kilo run --agent review).
// Gate-Schritt kilo-review-2 in harness/projekt.yaml, läuft vor review-stand-2.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDiffBase } from "./lib/git-base.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// REVIEW_OUT erlaubt einen eigenen Pfad. Standard ist zweit.md, weil das
// Erstgutachten in findings.md liegt.
const findingsRel = process.env.REVIEW_OUT || ".tmp/review/zweit.md";
const findingsPath = path.join(root, findingsRel);
const timeoutSekunden = Number.parseInt(process.env.KILO_REVIEW_TIMEOUT || "", 10) || 600;
// Review-Modell: glm-5.3 über OpenCode Go, unabhängig vom Kilo-Standard.
const modell = process.env.KILO_REVIEW_MODEL || "opencode-go/glm-5.3";

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
  const base = (r.stdout || "").split(/\r?\n/).find((l) => l.startsWith("BASE ")) || "";
  const diff = (r.stdout || "").split(/\r?\n/).find((l) => l.startsWith("DIFF ")) || "";
  if (!head || !diff) {
    process.stderr.write("review-stand.mjs lieferte keinen Stand\n");
    process.exit(1);
  }
  return { head, base, diff };
}

function findingsAktuell(st) {
  if (!fs.existsSync(findingsPath)) {
    return false;
  }
  const text = fs.readFileSync(findingsPath, "utf8");
  return text.includes(st.head) && text.includes(st.diff);
}

// Review-Basis: der tatsächliche Commit-Bereich plus Working Tree.
// Die Basis wird auch bei unsauberem Working Tree ermittelt.
function diffBasis() {
  const base = resolveDiffBase(root);
  if (!base) {
    process.stderr.write("Keine Review-Basis gefunden (kein Upstream, kein origin/main/main). Review prüft nur den Working Tree.\n");
  }
  return base;
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
const basisText = base
  ? `Branch-Diff ab ${base} plus Working Tree. Prüfe mit "git diff ${base}..HEAD" und "git diff ${base}".`
  : "Working Tree";

const r = spawnSync("kilo", [
  "run",
  "--model",
  modell,
  "--agent", "review",
  "--title", "Pre-Push-Review",
  `Pre-Push-Review: Prüfe den Diff nach dem Skill review. Basis: ${basisText}. Schreibe ${findingsRel}.`,
], { cwd: root, encoding: "utf8", env, timeout: timeoutSekunden * 1000, shell: process.platform === "win32" });

if ((r.error && r.error.code === "ETIMEDOUT") || r.signal === "SIGTERM") {
  process.stderr.write(`kilo run Timeout nach ${timeoutSekunden}s (KILO_REVIEW_TIMEOUT anpassbar)\n`);
  process.exit(1);
}
if ((r.status ?? 1) !== 0) {
  process.stderr.write(`kilo run fehlgeschlagen (Exit ${r.status}):\n${kurz(r.stderr || r.stdout)}\n`);
  process.exit(r.status ?? 1);
}

// Der Stand wird vom Modell im Bericht zitiert und dabei gelegentlich falsch
// abgetippt. Dann scheitert das Gate an einem Zeichen, obwohl der Bericht zum
// richtigen Diff gehört. Deshalb schreibt das Skript die Stand-Zeilen selbst.
function standSchreiben(st) {
  if (!fs.existsSync(findingsPath)) {
    process.stderr.write(`${findingsRel} fehlt. Der Gutachter hat eine andere Datei geschrieben.\n`);
    process.exit(1);
  }
  const text = fs.readFileSync(findingsPath, "utf8");
  const zeilen = text.split("\n").filter(
    (zeile) => !/^(HEAD|BASE|DIFF) \S*$/.test(zeile.trim()),
  );
  const block = [`HEAD ${st.head.slice(5)}`];
  if (st.base) {
    block.push(`BASE ${st.base.slice(5)}`);
  }
  block.push(`DIFF ${st.diff.slice(5)}`);
  fs.writeFileSync(findingsPath, `${block.join("\n")}\n\n${zeilen.join("\n").trimStart()}`);
}

standSchreiben(stand());

if (!findingsAktuell(stand())) {
  process.stderr.write(`kilo run lief, aber ${findingsRel} passt nicht zum aktuellen Stand\n`);
  process.exit(1);
}

console.log(`Review geschrieben: ${findingsRel} (${stand().head.slice(5, 12)})`);
