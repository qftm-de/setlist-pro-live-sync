#!/usr/bin/env node
/**
 * R24-Verify: Oberflaeche der Instanz-Einladung.
 *
 * Prueft Typprüfung und die Tests der Seite /beitritt/<token>: Vorschau,
 * Registrierung, ungueltiger Link vor und beim Absenden, sichtbarer Fehler,
 * angemeldeter Besucher und die Routentrennung zu /einladung/<token>.
 *
 * Nicht abgedeckt: der Neuladevorgang nach der Kontoanlage
 * (`beitrittFertig` in App.tsx). Er haengt an der Session und wird derzeit
 * weder als Unit-Test noch als E2E-Spec gefahren. Bis eine E2E-Spec unter
 * frontend/e2e existiert, bleibt das ein manueller Pruefschritt.
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
  process.stderr.write("Beitritt-UI: Typprüfung rot.\n");
  process.exit(1);
}

const tests = lauf("npx", [
  "vitest",
  "run",
  "src/bands/BeitrittAnsicht.test.tsx",
  "src/app/startInhalt.test.tsx",
]);
if (tests.status !== 0) {
  process.stderr.write(tests.stdout || "");
  process.stderr.write(tests.stderr || "");
  process.stderr.write("Beitritt-UI: Tests rot.\n");
  process.exit(1);
}

process.stdout.write("verify-beitritt-ui ok\n");
