#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const excludeDirNames = new Set([
  ".git", ".venv", "venv", "node_modules", "__pycache__", "dist",
  "staticfiles", "coverage", ".cache", "vendor",
]);

const secretName = /\b(?:API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY)\s*[:=]\s*['"][^'"]+['"]/;
const jwtToken = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/;
const glpat = /\bglpat-[A-Za-z0-9_-]+\b/;
const sk = /\bsk-[A-Za-z0-9]{16,}\b/;

const findings = [];

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
    if ([".ts", ".tsx", ".js", ".mjs", ".vue", ".php", ".py", ".html", ".json", ".md"].includes(ext)) {
      files.push(current);
    }
  }
  return files;
}

function rel(filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join("/");
}

const skip = /^(harness\/|docs\/|\.env\.example$|CHANGELOG\.md$)/;
for (const file of collectFiles(projectRoot)) {
  const r = rel(file);
  if (skip.test(r) || r.includes("node_modules")) {
    continue;
  }
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.trim().startsWith("#") || line.trim().startsWith("//")) {
      return;
    }
    if (secretName.test(line) || jwtToken.test(line) || glpat.test(line) || sk.test(line)) {
      findings.push({ file: r, line: i + 1, message: "mögliches Secret im Dateiinhalt", hard: true });
    }
  });
}

if (findings.length) {
  for (const f of findings) {
    console.error(`${f.file}:${f.line} ${f.message}`);
  }
  process.exit(1);
}
console.log("review-constraints grün");
process.exit(0);
