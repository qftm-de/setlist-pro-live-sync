#!/usr/bin/env node
/**
 * R25-Verify: Instanz-Einladungen in der Band-Verwaltung.
 *
 * Prueft Typprüfung und die Tests des Bereichs "Weitere Band einladen":
 * unsichtbar bei 403, Formular fuer den Betreiber, erzeugter Link,
 * Grenzen der Laufzeit und Widerruf.
 *
 * Nicht abgedeckt: die Serverrechte selbst. Die stehen in
 * backend/api/test_instanz_einladungen_api.py und laufen ueber
 * node scripts/verify-instanz-einladung.mjs.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const frontend = path.join(root, "frontend");

function lauf(befehl, args) {
  return spawnSync(befehl, args, { cwd: frontend, encoding: "utf8" });
}

const typen = lauf("npx", ["tsc", "--noEmit"]);
if (typen.status !== 0) {
  process.stderr.write(typen.stdout || "");
  process.stderr.write(typen.stderr || "");
  process.stderr.write("Instanz-Einladungen: Typprüfung rot.\n");
  process.exit(1);
}

const tests = lauf("npx", ["vitest", "run", "src/bands/InstanzEinladungen.test.tsx"]);
if (tests.status !== 0) {
  process.stderr.write(tests.stdout || "");
  process.stderr.write(tests.stderr || "");
  process.stderr.write("Instanz-Einladungen: Tests rot.\n");
  process.exit(1);
}

process.stdout.write("verify-instanz-ui ok\n");
