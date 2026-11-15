#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const frontend = path.join(root, "frontend");

function lauf(command, args, cwd = frontend) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if ((result.status ?? 1) !== 0) {
    console.error(`Fehlgeschlagen: ${command} ${args.join(" ")}`);
    console.error(result.stdout || "");
    console.error(result.stderr || "");
    process.exit(1);
  }
}

const nginx = path.join(frontend, "nginx.conf");
if (!fs.existsSync(nginx)) {
  console.error("frontend/nginx.conf fehlt.");
  process.exit(1);
}
const nginxText = fs.readFileSync(nginx, "utf8");
for (const pflicht of [
  "try_files $uri $uri/ /index.html",
  "resolver 127.0.0.11",
  "proxy_pass $api_upstream",
]) {
  if (!nginxText.includes(pflicht)) {
    console.error(`nginx.conf enthält nicht: ${pflicht}`);
    process.exit(1);
  }
}

lauf("npm", ["ci", "--no-audit", "--no-fund"]);
lauf("npm", ["run", "build"]);
lauf("npm", ["test"]);

console.log("verify-ui-foundation ok");
