#!/usr/bin/env node
// Erstgutachten über die Antigravity-CLI in Orca. Bezahlt aus dem Google-AI-Pro-Abo,
// nicht aus dem OpenRouter-Guthaben. Der Agent läuft als Terminal in Orca, schreibt die
// Befunddatei selbst, dieses Skript startet ihn und wartet auf die Datei. Standard ist
// findings.md, damit das Gate den Erstbefund liest.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDiffBase } from "./lib/git-base.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const findingsRel = process.env.REVIEW_OUT || ".tmp/review/findings.md";
const findingsPath = path.join(root, findingsRel);
const timeouts = Number.parseInt(process.env.AGY_REVIEW_TIMEOUT || "", 10) || 1200;
const orca =
  process.env.ORCA_CLI ||
  path.join(process.env.HOME || "", ".config", "orca", "linux-orca-cli-shim", "orca");

function stand() {
  const r = spawnSync(process.execPath, [path.join(root, "scripts", "review-stand.mjs")], {
    cwd: root,
    encoding: "utf8",
  });
  if ((r.status ?? 1) !== 0) {
    process.stderr.write("review-stand.mjs fehlgeschlagen\n");
    process.exit(1);
  }
  const zeilen = (r.stdout || "").split(/\r?\n/);
  const head = zeilen.find((l) => l.startsWith("HEAD ")) || "";
  const diff = zeilen.find((l) => l.startsWith("DIFF ")) || "";
  const base = zeilen.find((l) => l.startsWith("BASE ")) || "";
  if (!head || !diff) {
    process.stderr.write("review-stand.mjs lieferte keinen Stand\n");
    process.exit(1);
  }
  return { head, diff, base };
}

function findingsAktuell(st) {
  if (!fs.existsSync(findingsPath)) {
    return false;
  }
  const text = fs.readFileSync(findingsPath, "utf8");
  return text.includes(st.head) && text.includes(st.diff);
}

// Abgeschlossen heißt: Befunde da oder das Befund-frei-Wort des Review-Skills,
// und die Datei ist seit 20 s unverändert. "Keine belegten Befunde" ist kürzer
// als die Größenschranke, deshalb gilt sie dort nicht.
function berichtFertig() {
  if (!fs.existsSync(findingsPath)) {
    return false;
  }
  const { size, mtimeMs } = fs.statSync(findingsPath);
  const text = fs.readFileSync(findingsPath, "utf8");
  if (!/## F\d|Nachgeprüft|Keine belegten Befunde/i.test(text)) {
    return false;
  }
  if (size < 200 && !/Keine belegten Befunde/i.test(text)) {
    return false;
  }
  return Date.now() - mtimeMs > 20_000;
}

function standSchreiben(st) {
  const text = fs.readFileSync(findingsPath, "utf8");
  const zeilen = text
    .split("\n")
    .filter((zeile) => !/^(HEAD|BASE|DIFF) \S*$/.test(zeile.trim()));
  const block = [`HEAD ${st.head.slice(5)}`];
  if (st.base) {
    block.push(`BASE ${st.base.slice(5)}`);
  }
  block.push(`DIFF ${st.diff.slice(5)}`);
  fs.writeFileSync(findingsPath, `${block.join("\n")}\n\n${zeilen.join("\n").trimStart()}`);
}

const st = stand();
if (findingsAktuell(st)) {
  console.log(`Review für diesen Stand bereits aktuell (${st.head.slice(5, 12)})`);
  process.exit(0);
}

if (!fs.existsSync(orca)) {
  process.stderr.write(`orca-CLI nicht gefunden: ${orca}\n`);
  process.exit(1);
}

const base = resolveDiffBase(root);
const basisText = base
  ? `Branch-Diff ab ${base} plus Working Tree. Prüfe mit "git diff ${base}..HEAD" und "git diff ${base}".`
  : "Working Tree";

fs.mkdirSync(path.dirname(findingsPath), { recursive: true });
fs.rmSync(findingsPath, { force: true });

const auftrag = [
  "Pre-Push-Review. Prüfe den Diff dieses Repositories nach den Regeln in",
  ".kilo/agents/review.md; fehlt die Datei, nach docs/conventions.md und AGENTS.md.",
  `Basis: ${basisText}.`,
  `Schreibe deine Befunde nach ${findingsRel} im Repo-Root, Abschnitte "## F<n> – <Titel>"`,
  "mit Schwere (blocker, major, minor), Pfad:Zeile und Beleg.",
  "Die Kopfzeilen HEAD, BASE und DIFF schreibt das Skript selbst, lass sie weg.",
  "Kein Commit, kein Push, keine Änderung am Produktcode.",
].join(" ");

const start = spawnSync(
  orca,
  ["agent", "launch", "--agent", "antigravity", "--surface", "terminal", "--prompt", auftrag, "--json"],
  {
    cwd: root,
    encoding: "utf8",
    timeout: 120_000,
    env: base ? { ...process.env, REQUIREMENTS_DIFF_BASE: base } : process.env,
  },
);
let handle = "";
try {
  handle = JSON.parse(start.stdout || "{}").result.outcome.handle || "";
} catch {
  handle = "";
}
if (!handle) {
  process.stderr.write(`orca agent launch fehlgeschlagen:\n${(start.stderr || start.stdout || "").slice(-400)}\n`);
  process.exit(1);
}

const ende = Date.now() + timeouts * 1000;
let fertig = false;
while (Date.now() < ende) {
  spawnSync("sleep", ["10"]);
  if (berichtFertig()) {
    fertig = true;
    break;
  }
}

if (!fertig) {
  process.stderr.write(`Antigravity-Review Timeout nach ${timeouts}s (AGY_REVIEW_TIMEOUT anpassbar)\n`);
  process.exit(1);
}

standSchreiben(stand());

if (!findingsAktuell(stand())) {
  process.stderr.write(`Antigravity lief, aber ${findingsRel} passt nicht zum aktuellen Stand\n`);
  process.exit(1);
}

console.log(`Review geschrieben: ${findingsRel} (${stand().head.slice(5, 12)})`);
