#!/usr/bin/env node
// Einziger Gate-Einstieg. --schnell lokal, --voll vor Push/CI. Schreibt keine Dateien.
// Schritte kommen aus harness/projekt.yaml, sonst die Builtin-Liste.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadYamlFile } from "./lib/yaml.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const listOnly = args.includes("--list");
const voll = args.includes("--voll");
const schnell = args.includes("--schnell") || (!voll && !listOnly);

if (args.includes("--help")) {
  console.log("node scripts/gate.mjs --schnell|--voll [--list]");
  process.exit(0);
}

const DEFAULT_SCHNELL = [
  "requirements-gate",
  "review-constraints",
  "lint-file-size",
  "verify-affected",
  "harness",
];
const DEFAULT_VOLL = [
  "requirements-gate",
  "review-constraints",
  "lint-file-size",
  "verify-all",
  "gitleaks",
  "harness",
  "review-stand",
];

function loadProjekt() {
  const p = path.join(root, "harness", "projekt.yaml");
  if (!fs.existsSync(p)) {
    return {};
  }
  return loadYamlFile(p) || {};
}

const projekt = loadProjekt();
const policy = {requirements:"required",review:"required",...projekt.policy};
const gateCfg = projekt.gate || {};
const SCHNELL = normalizeSteps(gateCfg.schnell || DEFAULT_SCHNELL);
const VOLL = normalizeSteps(gateCfg.voll || DEFAULT_VOLL);
const modus = voll ? "voll" : "schnell";
const schritte = voll ? VOLL : SCHNELL;

function normalizeSteps(list) {
  return (list || []).map((item) => {
    if (typeof item === "string") {
      return { name: item, kind: "builtin", run: null };
    }
    return { name: item.name || item.run, kind: "run", run: item.run };
  });
}

if (listOnly) {
  for (const s of schritte) {
    console.log(s.name);
  }
  process.exit(0);
}

/** @type {Array<{name:string, status:string, detail:string}>} */
const ergebnisse = [];
let rot = false;
let nichtGeprueft = false;

function run(command, argv, cwd = root, env = process.env) {
  const useShell = process.platform === "win32" && !path.isAbsolute(command);
  return spawnSync(command, argv, { cwd, env, encoding: "utf8", shell: useShell });
}

function which(bin) {
  const result = process.platform === "win32" ? run("where", [bin]) : run("sh", ["-c", `command -v ${bin}`]);
  return (result.status ?? 1) === 0;
}

function runShell(command, cwd = root) {
  return spawnSync(command, { cwd, env: process.env, encoding: "utf8", shell: true });
}

function mark(name, status, detail = "", optional = false) {
  ergebnisse.push({ name, status, detail });
  if (status === "rot") {
    rot = true;
  }
  if (status === "nicht geprüft" && !optional) {
    nichtGeprueft = true;
  }
  const extra = detail ? ` — ${detail.split("\n")[0]}` : "";
  console.log(`${status === "grün" ? "ok" : status}: ${name}${extra}`);
}

function kurz(text) {
  const t = (text || "").trim();
  if (t.length <= 400) {
    return t;
  }
  return t.slice(-400);
}

function nodeScript(rel, extra = []) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    return { status: 127, stdout: "", stderr: `${rel} fehlt` };
  }
  return run(process.execPath, [full, ...extra]);
}

function geschuetzteTreffer() {
  const listePath = path.join(root, "scripts", "geschuetzt.json");
  if (!fs.existsSync(listePath)) {
    return [];
  }
  const liste = JSON.parse(fs.readFileSync(listePath, "utf8"));
  const pfade = liste.pfade || [];
  const status = run("git", ["status", "--porcelain=v1"]);
  const files = [];
  for (const line of (status.stdout || "").split(/\r?\n/)) {
    if (line.length < 4) {
      continue;
    }
    let rest = line.slice(3);
    if (rest.includes(" -> ")) {
      rest = rest.split(" -> ").pop() || rest;
    }
    files.push(rest.replace(/\\/g, "/"));
  }
  const treffer = [];
  for (const file of files) {
    for (const p of pfade) {
      if (file === p || file.startsWith(p) || (p.endsWith("/") && file.startsWith(p))) {
        treffer.push(file);
        break;
      }
    }
  }
  return Array.from(new Set(treffer));
}

function schrittRequirementsGate() {
  if(policy.requirements === "optional" && !fs.existsSync(path.join(root,"REQUIREMENTS.md"))) {mark("requirements-gate","grün","optional");return;}
  const r = nodeScript("scripts/requirements-gate.mjs", ["--check"]);
  if (r.status === 127) {
    mark("requirements-gate", "nicht geprüft", r.stderr);
    return;
  }
  if ((r.status ?? 1) !== 0) {
    mark("requirements-gate", "rot", kurz(r.stderr || r.stdout));
    return;
  }
  mark("requirements-gate", "grün");
}

function schrittNode(name, rel, extra = []) {
  const r = nodeScript(rel, extra);
  if (r.status === 127) {
    mark(name, "nicht geprüft", r.stderr);
    return;
  }
  if ((r.status ?? 1) !== 0) {
    mark(name, "rot", kurz(r.stderr || r.stdout));
    return;
  }
  mark(name, "grün");
}

function schrittVerify(mode) {
  if(policy.requirements === "optional" && !fs.existsSync(path.join(root,"REQUIREMENTS.md"))) {mark("verify","grün","optional");return;}
  const flag = mode === "all" ? "--commands-all" : "--commands-affected";
  const name = mode === "all" ? "verify-all" : "verify-affected";
  const listed = nodeScript("scripts/requirements-gate.mjs", [flag]);
  if (listed.status === 127) {
    mark(name, "nicht geprüft", listed.stderr);
    return;
  }
  if ((listed.status ?? 1) !== 0) {
    mark(name, "rot", kurz(listed.stderr || listed.stdout));
    return;
  }
  const lines = (listed.stdout || "").split(/\r?\n/).filter(Boolean);
  // Mehrere R-Zeilen können denselben Befehl teilen (etwa R6 bis R9 mit
  // verify-kern). Jeden Befehl nur einmal starten, Kennungen sammeln.
  const befehle = new Map();
  for (const line of lines) {
    const tab = line.indexOf("\t");
    const id = tab === -1 ? "?" : line.slice(0, tab);
    const cmd = tab === -1 ? line : line.slice(tab + 1);
    const bekannt = befehle.get(cmd);
    if (bekannt) {
      bekannt.push(id);
    } else {
      befehle.set(cmd, [id]);
    }
  }
  for (const [cmd, ids] of befehle) {
    const r = runShell(cmd, root);
    if ((r.status ?? 1) !== 0) {
      mark(name, "rot", `${ids.join(", ")}: ${kurz(r.stderr || r.stdout)}`);
      return;
    }
  }
  mark(name, "grün", `${befehle.size} Kommando(s) für ${lines.length} Zeile(n)`);
}

function schrittHarness() {
  const treffer = geschuetzteTreffer();
  if (treffer.length === 0) {
    mark("harness", "grün");
    return;
  }
  const meldung = `Harness geändert, Review Pflicht: ${treffer.slice(0, 8).join(", ")}`;
  if (voll) {
    mark("harness", "rot", meldung);
    return;
  }
  console.log(`Hinweis: ${meldung}`);
  mark("harness", "grün", meldung);
}

function schrittReviewStand() {
  if(policy.review === "off") {mark("review-stand","grün","deaktiviert");return;}
  const findingsPath = path.join(root, ".tmp", "review", "findings.md");
  if (!fs.existsSync(findingsPath)) {
    mark("review-stand", policy.review === "required" ? "rot" : "grün", "kein findings.md");
    return;
  }
  const stand = nodeScript("scripts/review-stand.mjs");
  if ((stand.status ?? 1) !== 0) {
    mark("review-stand", "rot", kurz(stand.stderr || stand.stdout));
    return;
  }
  const erwartet = (stand.stdout || "").trim();
  const headZeile = erwartet.split(/\r?\n/).find(l=>l.startsWith("HEAD ")) || "";
  const diffZeile = erwartet.split(/\r?\n/).find((l) => l.startsWith("DIFF ")) || "";
  const text = fs.readFileSync(findingsPath, "utf8");
  if (!diffZeile || !headZeile || !text.includes(diffZeile) || !text.includes(headZeile)) {
    mark("review-stand", "rot", "findings.md gehört zu einem anderen Diff");
    return;
  }
  const befunde = parseFindings(text);
  if (befunde.length === 0 && !/keine belegten befunde/i.test(text)) {
    mark("review-stand", "rot", "findings.md ohne Befundabschnitte im Format '## F1 – Titel'");
    return;
  }
  const offen = befunde.filter((b) => (b.schwere === "blocker" || b.schwere === "major") && b.status === "offen");
  if (offen.length > 0) {
    mark("review-stand", "rot", `${offen.length} offene(r) Blocker oder Major`);
    return;
  }
  mark("review-stand", "grün");
}

// Befundabschnitte nach dem Review-Skill: jede Überschrift '## F<n> – Titel'
// leitet einen Befund ein. Felder gelten bis zur nächsten Überschrift.
// Fehlt die Statuszeile, gilt der Befund als offen (fail-safe).
function parseFindings(text) {
  const bloecke = text.split(/\n(?=##\s+F\d+\b)/i);
  const befunde = [];
  for (const block of bloecke) {
    if (!/^##\s+F\d+\b/i.test(block.trim())) {
      continue;
    }
    const schwere = (block.match(/Schwere:\s*(blocker|major|minor)\b/i) || [])[1];
    const status = (block.match(/Status:\s*(offen|behoben|abgelehnt)\b/i) || [])[1];
    befunde.push({
      schwere: (schwere || "").toLowerCase(),
      status: (status || "offen").toLowerCase(),
    });
  }
  return befunde;
}

function schrittGitleaks() {
  if (!which("gitleaks")) {
    mark("gitleaks", "nicht geprüft", "gitleaks nicht installiert", true);
    return;
  }
  const r = run("gitleaks", ["detect", "--no-banner", "--redact"]);
  if ((r.status ?? 1) !== 0) {
    mark("gitleaks", "rot", kurz(r.stdout || r.stderr));
    return;
  }
  mark("gitleaks", "grün");
}

function schrittRun(step) {
  const r = runShell(step.run, root);
  if ((r.status ?? 1) !== 0) {
    mark(step.name, "rot", kurz(r.stderr || r.stdout));
    return;
  }
  mark(step.name, "grün");
}

const builtins = {
  "requirements-gate": schrittRequirementsGate,
  "review-constraints": () => schrittNode("review-constraints", "scripts/review-constraints.mjs"),
  "lint-colors": () => schrittNode("lint-colors", "scripts/lint-colors.mjs"),
  "content-validate": () => schrittNode("content-validate", "scripts/content-validate.mjs"),
  "lint-file-size": () => schrittNode("lint-file-size", "scripts/lint-file-size.mjs"),
  "verify-affected": () => schrittVerify("affected"),
  "verify-all": () => schrittVerify("all"),
  gitleaks: schrittGitleaks,
  harness: schrittHarness,
  "review-stand": schrittReviewStand,
};

console.log(`Gate ${modus}`);
for (const step of schritte) {
  if (step.kind === "run") {
    schrittRun(step);
    continue;
  }
  const fn = builtins[step.name];
  if (!fn) {
    mark(step.name, "nicht geprüft", "unbekannter Schritt");
    continue;
  }
  fn();
}

if(voll && policy.review === "required" && !schritte.some(s=>s.name === "review-stand")) schrittReviewStand();

if (nichtGeprueft) {
  console.log("nicht geprüft — gilt nicht als grün.");
  rot = true;
}
if (rot) {
  console.error("Gate rot.");
  process.exit(1);
}
console.log("Gate grün.");
process.exit(0);
