/** Browser-Smoke im Mobilformat für Auftritte, PDF und Bühne (R15, R16). */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export async function pruefeMobil({
  basis,
  bandId,
  songId,
  setlistId,
  versionId,
  benutzer,
  passwort,
}) {
  const frontend = path.join(root, "frontend");
  if (!fs.existsSync(path.join(frontend, "node_modules", "@playwright", "test"))) {
    throw new Error("Playwright fehlt. Im Frontend npm ci und npx playwright install chromium ausführen.");
  }
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const lauf = spawnSync(
    npx,
    [
      "playwright",
      "test",
      "e2e/mobil.spec.ts",
      "e2e/menues-mobil.spec.ts",
      "e2e/abstaende-mobil.spec.ts",
      "--project=mobil",
      "--reporter=line",
    ],
    {
      cwd: frontend,
      env: {
        ...process.env,
        E2E_BASIS: basis,
        E2E_BENUTZER: benutzer,
        E2E_PASSWORT: passwort,
        E2E_BAND_ID: String(bandId),
        E2E_SONG_ID: String(songId),
        E2E_VERSION_ID: String(versionId),
        E2E_SETLIST_ID: String(setlistId),
      },
      encoding: "utf8",
      timeout: 300_000,
    },
  );
  if ((lauf.status ?? 1) !== 0) {
    throw new Error(`Browser-Smoke Mobilformat rot:\n${lauf.stdout || ""}${lauf.stderr || ""}`);
  }
}
