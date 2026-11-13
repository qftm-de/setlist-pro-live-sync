import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadYamlFile } from "./yaml.mjs";

export function parseRequirements(raw) {
  const lines = String(raw).split(/\r\n|\n|\r/);
  const items = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const start = line.match(/^(R\d+)\s*\|\s*Behavior:\s*(.*)$/);
    if (start) {
      if (current) {
        current.end = i - 1;
        items.push(current);
      }
      current = {
        id: start[1],
        behavior: start[2].trim(),
        verify: "",
        scope: [],
        state: "not_started",
        risk: "niedrig",
        cases: [],
        start: i,
        end: i,
      };
      continue;
    }
    if (!current) {
      continue;
    }
    let m = line.match(/^\s*\|\s*Verify:\s*(.*)$/);
    if (m) {
      current.verify = m[1].trim();
      current.end = i;
      continue;
    }
    m = line.match(/^\s*\|\s*Scope:\s*(.*)$/);
    if (m) {
      current.scope = m[1].split(",").map((p) => p.trim()).filter(Boolean);
      current.end = i;
      continue;
    }
    m = line.match(/^\s*\|\s*Risk:\s*(.*)$/);
    if (m) {
      const risk = m[1].trim().toLowerCase();
      current.risk = risk || "niedrig";
      current.end = i;
      continue;
    }
    m = line.match(/^\s*\|\s*Cases:\s*(.*)$/);
    if (m) {
      current.cases = m[1].split(";").map((p) => p.trim()).filter(Boolean);
      current.end = i;
      continue;
    }
    m = line.match(/^\s*\|\s*State:\s*(.*)$/);
    if (m) {
      const state = m[1].trim().toLowerCase();
      if (["not_started", "in_progress", "passing"].includes(state)) {
        current.state = state;
      }
      current.end = i;
    }
  }
  if (current) {
    current.end = lines.length - 1;
    items.push(current);
  }
  return items;
}

export function renderRequirements(raw, items) {
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const lines = String(raw).split(/\r\n|\n|\r/);
  for (const item of items) {
    for (let i = item.start; i <= item.end && i < lines.length; i++) {
      const m = lines[i].match(/^(\s*\|\s*State:\s*)(.*)$/);
      if (m) {
        lines[i] = m[1] + item.state;
      }
    }
  }
  let out = lines.join(eol);
  if (raw.endsWith("\n") && !out.endsWith("\n")) {
    out += eol;
  }
  return out;
}

export function normalizePath(p) {
  return String(p || "").trim().replace(/\\/g, "/");
}

export function inScope(file, scopes) {
  const f = normalizePath(file);
  for (const scope of scopes) {
    const s = normalizePath(scope);
    if (!s) {
      continue;
    }
    if (f === s) {
      return true;
    }
    const prefix = s.replace(/\/$/, "") + "/";
    if (f.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

function gitLines(root, args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if ((result.status ?? 1) !== 0) {
    return [];
  }
  // trimEnd, nicht trim: porcelain-Zeilen beginnen mit zwei Statusspalten.
  return (result.stdout || "").split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
}

function isRepoRelPath(file) {
  const f = normalizePath(file);
  if (!f || f.includes("\0") || f.includes(" ")) {
    return false;
  }
  if (/^(warning|error|hint|fatal):/i.test(f)) {
    return false;
  }
  if (f.includes(" LF will be replaced") || f.includes(" CRLF will be replaced")) {
    return false;
  }
  return true;
}

export function listChangedFiles(root) {
  const files = new Set();
  const cmds = [
    ["diff", "--name-only", "HEAD"],
    ["diff", "--name-only", "--cached"],
    ["ls-files", "--others", "--exclude-standard"],
  ];
  for (const args of cmds) {
    for (const file of gitLines(root, args)) {
      const f = normalizePath(file);
      if (isRepoRelPath(f)) {
        files.add(f);
      }
    }
  }
  for (const line of gitLines(root, ["status", "--porcelain=v1"])) {
    if (line.length < 4) {
      continue;
    }
    let rest = line.slice(3);
    if (rest.includes(" -> ")) {
      for (const part of rest.split(" -> ")) {
        const f = normalizePath(part);
        if (isRepoRelPath(f)) {
          files.add(f);
        }
      }
      continue;
    }
    const f = normalizePath(rest);
    if (isRepoRelPath(f)) {
      files.add(f);
    }
  }
  return [...files];
}

const IGNORE = [
  "REQUIREMENTS.md", "PROGRESS.md", "DECISIONS.md", "CHANGELOG.md", "DESIGN.md",
  "AGENTS.md", "CLAUDE.md", "kilo.jsonc", "skills-lock.json", "harness/lock.json",
  ".env.example", ".gitlab-ci.yml", ".gitignore",
];

export function unmappedFiles(files, items) {
  const scopes = items.flatMap((item) => item.scope.map(normalizePath));
  const out = [];
  for (const file of files) {
    const f = normalizePath(file);
    if (!f || IGNORE.includes(f) || !isRepoRelPath(f)) {
      continue;
    }
    if (
      f.startsWith("harness/") ||
      f.startsWith(".cursor/") ||
      f.startsWith(".kilo/") ||
      f.startsWith(".claude/") ||
      f.startsWith(".codex/") ||
      f.startsWith(".agents/") ||
      f.startsWith(".githooks/") ||
      f.startsWith("docs/") ||
      f.startsWith("marketing/") ||
      f.startsWith("scripts/") ||
      f.startsWith(".gitlab/")
    ) {
      continue;
    }
    if (/(^|\/)debug-.*\.log$/.test(f)) {
      continue;
    }
    if (!inScope(f, scopes)) {
      out.push(f);
    }
  }
  return [...new Set(out)];
}

export function affectedItems(items, files) {
  const check = files.map(normalizePath).filter((f) => f && !IGNORE.includes(f));
  const affected = [];
  const seen = new Set();
  for (const item of items) {
    const hits = check.filter((file) => inScope(file, item.scope));
    if (hits.length) {
      affected.push({ ...item, hits: [...new Set(hits)] });
      seen.add(item.id);
    }
  }
  if (files.map(normalizePath).includes("REQUIREMENTS.md")) {
    for (const item of items) {
      if (item.state === "passing" || seen.has(item.id)) {
        continue;
      }
      affected.push({ ...item, hits: ["REQUIREMENTS.md"] });
    }
  }
  affected.sort((a, b) => a.id.localeCompare(b.id));
  return affected;
}

export function loadAllowList(root) {
  const p = path.join(root, "harness", "projekt.yaml");
  if (!fs.existsSync(p)) {
    return ["node scripts/*", "npm test", "npm run *", "npx *"];
  }
  const data = loadYamlFile(p);
  const allow = data?.verify?.allow;
  if (Array.isArray(allow) && allow.length) {
    return allow.map(String);
  }
  const hints = [data?.verify?.test, data?.verify?.lint, data?.verify?.build].filter(Boolean);
  return hints.length ? hints.map(String).concat(["node scripts/*"]) : ["node scripts/*", "npm test", "npm run *", "npx *"];
}

function globMatch(pattern, value) {
  const p = pattern.trim();
  const v = value.trim();
  if (p === v) {
    return true;
  }
  if (p.endsWith("*")) {
    return v.startsWith(p.slice(0, -1));
  }
  return false;
}

export function verifyErlaubt(command, allow) {
  const cmd = String(command || "").trim();
  if (!cmd) {
    return "Verify fehlt.";
  }
  if (/[;|`$]|\$\(/.test(cmd)) {
    return "Verify enthält unerlaubte Zeichen.";
  }
  const teile = cmd.split(/\s*&&\s*/).map((t) => t.trim()).filter(Boolean);
  for (const teil of teile) {
    if (/^cd [A-Za-z0-9_./-]+$/.test(teil) && !teil.includes("..")) {
      continue;
    }
    if (allow.some((a) => globMatch(a, teil))) {
      continue;
    }
    return `Verify-Teil nicht erlaubt: ${teil}`;
  }
  return true;
}

export function gateFehler(items, root, allow) {
  const errors = [];
  const ids = new Set();
  for (const item of items) {
    if (ids.has(item.id)) {
      errors.push(`Doppelte ID ${item.id}.`);
    }
    ids.add(item.id);
    if (!item.behavior || !item.verify || item.scope.length === 0) {
      errors.push(`Vervollständige ${item.id}: Behavior, Verify und Scope müssen gesetzt sein.`);
    }
    const reg = verifyErlaubt(item.verify, allow);
    if (reg !== true) {
      errors.push(`${item.id}: ${reg}`);
    }
    if (item.state !== "passing") {
      errors.push(`${item.id} ist ${item.state}, nicht passing.`);
    }
    const risk = item.risk || "niedrig";
    if (!["hoch", "mittel", "niedrig"].includes(risk)) {
      errors.push(`${item.id}: Risk muss hoch, mittel oder niedrig sein.`);
    }
    if (risk === "hoch" && item.cases.length === 0) {
      errors.push(`${item.id}: Risk hoch braucht Cases.`);
    }
  }
  for (const file of unmappedFiles(listChangedFiles(root), items)) {
    errors.push(`Nimm ${file} in eine Scope-Zeile auf oder nimm die Datei aus dem Diff.`);
  }
  return errors;
}

export function runCommand(command, cwd) {
  const result = spawnSync(command, {
    cwd,
    encoding: "utf8",
    shell: true,
  });
  return {
    code: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}
