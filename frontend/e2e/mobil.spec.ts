import { expect, test, type Page } from "@playwright/test";
import { anmelden, benutzer, passwort } from "./anmelden";

const bandId = process.env.E2E_BAND_ID ?? "";
const songId = process.env.E2E_SONG_ID ?? "";
const versionId = process.env.E2E_VERSION_ID ?? "";
const setlistId = process.env.E2E_SETLIST_ID ?? "";

async function ohneUeberlauf(page: Page) {
  const werte = await page.evaluate(() => ({
    breite: document.documentElement.scrollWidth,
    sicht: window.innerWidth,
  }));
  expect(werte.breite).toBeLessThanOrEqual(werte.sicht + 1);
}

test("Auftritte, PDF und Bühne bleiben im Mobilformat bedienbar", async ({ page }) => {
  test.skip(
    !benutzer || !passwort || !bandId || !songId || !versionId || !setlistId,
    "E2E-Umgebung fehlt",
  );
  await anmelden(page, bandId);

  await page.goto("/gigs");
  await expect(page.getByRole("heading", { name: "Auftritte", exact: true })).toBeVisible();
  await expect(page.getByText("Export-Auftritt", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Bühne aus Export-Auftritt öffnen/ })).toBeVisible();
  await ohneUeberlauf(page);

  await page.goto(`/songs/${bandId}/${songId}/pdf/versions/${versionId}`);
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText(/Seite 1 von/)).toBeVisible();
  await expect(page.getByRole("button", { name: "An Breite anpassen" })).toBeVisible();
  await ohneUeberlauf(page);

  await page.goto(`/setlists/${bandId}/${setlistId}`);
  await expect(page.getByText(/^Verbunden\./)).toBeVisible();
  await page.getByRole("button", { name: /Bühne aus Export-Set öffnen/ }).click();
  await expect(page).toHaveURL(new RegExp(`/stage/${bandId}/\\d+`));
  await expect(page.locator(".buehne")).toBeVisible();
  await expect(page.locator(".buehne h1")).toHaveText("Export-Smoke");
  await ohneUeberlauf(page);
});
