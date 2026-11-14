#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { resolveDiffBase } from "./lib/git-base.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function git(args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if ((result.status ?? 1) !== 0) {
    process.stderr.write(result.stderr || "git fehlgeschlagen\n");
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

const head = git(["rev-parse", "HEAD"]).trim();
const base = resolveDiffBase(root);
const commitDiff = base ? git(["diff", base, "HEAD"]) : "";
const diff = git(["diff", "HEAD"]);
const cached = git(["diff", "--cached"]);
const extra = git(["ls-files", "--others", "--exclude-standard", "-z"]);
const untracked = extra.split("\0").filter(Boolean).sort().map(file=>file+":"+crypto.createHash("sha256").update(fs.readFileSync(path.join(root,file))).digest("hex")).join("\n");
const hash = crypto.createHash("sha256").update(commitDiff).update("\n").update(diff).update("\n").update(cached).update("\n").update(untracked).digest("hex").slice(0, 16);

console.log(`HEAD ${head}`);
if (base) {
  console.log(`BASE ${base}`);
}
console.log(`DIFF ${hash}`);
