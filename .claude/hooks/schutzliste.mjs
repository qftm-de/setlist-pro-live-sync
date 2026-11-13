#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

let input = {};
try {
  input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
} catch {
  console.log(JSON.stringify({ permission: "deny", user_message: "Hook-Eingabe war kein JSON.", agent_message: "schutzliste: JSON ungültig." }));
  process.exit(0);
}

const tool = String(input.tool_name || input.toolName || input.hook_event_name || "");
const writeTools = new Set(["Write", "StrReplace", "Delete", "EditNotebook", "Edit", "WriteFile"]);
if (tool && !writeTools.has(tool) && !/pretooluse/i.test(String(input.hook_event_name || ""))) {
  const looksWrite = Boolean(
    input.tool_input?.path ||
    input.tool_input?.file_path ||
    input.file_path ||
    input.path,
  );
  if (!looksWrite) {
    console.log(JSON.stringify({ permission: "allow" }));
    process.exit(0);
  }
}

const raw = String(
  input.tool_input?.path ||
    input.tool_input?.file_path ||
    input.file_path ||
    input.path ||
    "",
);
if (!raw) {
  console.log(JSON.stringify({ permission: "allow" }));
  process.exit(0);
}
const rel = path.relative(root, path.resolve(raw)).split(path.sep).join("/");
const listePath = path.join(root, "scripts", "geschuetzt.json");
if (!fs.existsSync(listePath)) {
  console.log(JSON.stringify({ permission: "allow" }));
  process.exit(0);
}
const liste = JSON.parse(fs.readFileSync(listePath, "utf8"));
const geschuetzt = (liste.pfade || []).some((p) => rel === p.replace(/\/$/, "") || rel.startsWith(p));

if (geschuetzt) {
  console.log(JSON.stringify({
    permission: "ask",
    user_message: `${rel} steht auf der Schutzliste. Änderungen am Harness brauchen eine bewusste Freigabe.`,
    agent_message: "Schutzliste: Harness-Datei, Nutzer muss zustimmen.",
  }));
  process.exit(0);
}

console.log(JSON.stringify({ permission: "allow" }));
