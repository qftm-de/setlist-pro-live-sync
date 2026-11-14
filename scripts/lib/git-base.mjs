import { spawnSync } from "node:child_process";

export function gitText(root, args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if ((result.status ?? 1) !== 0) {
    return null;
  }
  return result.stdout || "";
}

export function resolveDiffBase(root) {
  const head = (gitText(root, ["rev-parse", "HEAD"]) || "").trim();
  if (!/^[0-9a-f]{7,40}$/.test(head)) {
    return null;
  }
  const explizit = (process.env.REQUIREMENTS_DIFF_BASE || "").trim();
  if (explizit) {
    const aufgeloest = (gitText(root, ["rev-parse", "--verify", `${explizit}^{commit}`]) || "").trim();
    if (/^[0-9a-f]{7,40}$/.test(aufgeloest)) {
      return aufgeloest;
    }
  }
  for (const ref of ["@{u}", "origin/main", "main"]) {
    const base = (gitText(root, ["merge-base", "HEAD", ref]) || "").trim();
    if (/^[0-9a-f]{7,40}$/.test(base) && base !== head) {
      return base;
    }
  }
  return null;
}
