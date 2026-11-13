#!/usr/bin/env node
import fs from "node:fs";

let input = {};
try {
  input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
} catch {
  console.log(JSON.stringify({ permission: "deny", user_message: "Hook-Eingabe war kein JSON.", agent_message: "git-sperre: JSON ungültig." }));
  process.exit(0);
}

const command = String(input.command || input.tool_input?.command || input.tool_input?.command_line || "");
function respond(permission, message="") {
 if(input.hook_event_name === "PreToolUse") console.log(JSON.stringify({hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:permission,permissionDecisionReason:message}}));
 else console.log(JSON.stringify({permission,user_message:message,agent_message:message}));
}
const norm = command.replace(/\s+/g, " ").trim();
const verboten = [
  /\bgit\s+commit\b/,
  /\bgit\s+push\b/,
  /\bgit\s+merge(?:\s|$)/,
  /\bgit\s+rebase\b/,
  /\bgit\s+tag\b/,
  /\bgit\s+reset\s+.*--hard\b/,
  /\bgit\s+checkout\s+-b\b/,
  /\bgit\s+switch\s+-c\b/,
  /\bgit\s+branch\s+(?!-)/,
];

if (verboten.some((re) => re.test(norm))) {
  respond("deny", "Git-Schreibaktionen macht nur der Nutzer.");
  process.exit(0);
}

respond("allow");
