#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const secretName = /\b(?:API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY)\s*[:=]\s*['"][^'"]+['"]/;
const jwtToken = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/;
const glpat = /\bglpat-[A-Za-z0-9_-]+\b/;
const sk = /\bsk-[A-Za-z0-9]{16,}\b/;
const gcpKey = /\bAIza[0-9A-Za-z_-]{35}\b/;
const firebaseConfig = /\b(?:apiKey|authDomain|projectId|storageBucket|messagingSenderId|measurementId|appId)\s*[:=]\s*['"][^'"]{3,}['"]/;
const privateIp = /\b(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/;
const dataUri = /data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]{200,}/;
const privateKeyBlock = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;

// Kein echtes Nutzdatum, kein Zugangsmittel und keine Infrastruktur-Adresse
// im Repo. Das Projekt ist privat und soll offen werden.
const patterns = [
  { re: secretName, message: "mögliches Secret im Dateiinhalt" },
  { re: jwtToken, message: "JWT im Dateiinhalt" },
  { re: glpat, message: "GitLab-Token im Dateiinhalt" },
  { re: sk, message: "API-Key im Dateiinhalt" },
  { re: gcpKey, message: "Google-API-Key im Dateiinhalt" },
  { re: firebaseConfig, message: "Firebase-Config-Zuweisung mit Wert" },
  { re: privateIp, message: "private IP-Adresse im Dateiinhalt" },
  { re: dataUri, message: "eingebettete Datei als Data-URI" },
  { re: privateKeyBlock, message: "Private-Key-Block" },
];

// Muster, die später zu Sicherheitslücken führen. Nur auf Code, nicht auf Prosa.
// Ein Treffer ist ein Stopp, kein Hinweis: Zeile begründen oder umbauen.
const codeExtensions = new Set([".js", ".mjs", ".jsx", ".ts", ".tsx", ".vue", ".html", ".php", ".py"]);
const codePatterns = [
  { re: /\.(?:inner|outer)HTML\s*=/, message: "HTML per innerHTML setzen (XSS-Risiko)" },
  { re: /(?:dangerouslySetInnerHTML|insertAdjacentHTML)/, message: "HTML aus String einsetzen (XSS-Risiko)" },
  { re: /\b(?:eval|new\s+Function)\s*\(/, message: "dynamische Code-Ausführung" },
  { re: /@?csrf_exempt/, message: "CSRF-Schutz deaktiviert" },
  { re: /\bDEBUG\s*=\s*True\b/, message: "DEBUG=True" },
  { re: /\bverify\s*=\s*False\b/, message: "TLS-Prüfung deaktiviert" },
  { re: /\bshell\s*=\s*True\b/, message: "Shell-Injection-Risiko" },
  { re: /localStorage\.setItem\(\s*["'][^"']*(?:token|jwt|auth)/i, message: "Token im localStorage" },
  { re: /yaml\.load\(\s*(?!.*Loader=)/, message: "yaml.load ohne SafeLoader" },
];

const findings = [];

function collectFiles(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }
  // Git kennt getrackte und neue, aber nicht ignorierte Dateien. Werkzeug-
  // ausgaben lokaler Agenten werden damit nicht mitgeprüft.
  const liste = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: rootDir, encoding: "utf8" },
  ).stdout || "";
  const endungen = [
    ".ts", ".tsx", ".js", ".mjs", ".vue", ".php", ".py", ".html",
    ".json", ".md", ".yaml", ".yml", ".sh", ".toml",
  ];
  return liste
    .split("\0")
    .filter(Boolean)
    .map((rel) => path.join(rootDir, rel))
    .filter((datei) => endungen.includes(path.extname(datei).toLowerCase()));
}

function rel(filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join("/");
}

const skip = /^(\.env\.example$|CHANGELOG\.md$|scripts\/review-constraints\.mjs$)/;
for (const file of collectFiles(projectRoot)) {
  const r = rel(file);
  if (skip.test(r) || r.includes("node_modules")) {
    continue;
  }
  const ext = path.extname(file).toLowerCase();
  const isCode = codeExtensions.has(ext);
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.trim().startsWith("#") || line.trim().startsWith("//")) {
      return;
    }
    for (const p of patterns) {
      if (p.re.test(line)) {
        findings.push({ file: r, line: i + 1, message: p.message, hard: true });
      }
    }
    if (isCode) {
      for (const p of codePatterns) {
        if (p.re.test(line)) {
          findings.push({ file: r, line: i + 1, message: p.message, hard: true });
        }
      }
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
