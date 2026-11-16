import { expect, type Page } from "@playwright/test";

export const benutzer = process.env.E2E_BENUTZER ?? "";
export const passwort = process.env.E2E_PASSWORT ?? "";

export async function anmelden(page: Page, bandId: string) {
  const bandWahl = page.locator("label.bandwechsel select");
  const anmeldeKnopf = page.getByRole("button", { name: "Anmelden" });

  await page.goto("/");
  // Auf langsamen Runnern ist beim ersten Aufbau noch keins von beiden da.
  // `count()` ohne Warten liefert dann 0 und die Anmeldung faellt aus.
  await expect(bandWahl.or(anmeldeKnopf)).toBeVisible();
  if (await anmeldeKnopf.count()) {
    await page.getByLabel("Benutzername").fill(benutzer);
    await page.getByLabel("Passwort").fill(passwort);
    await anmeldeKnopf.click();
  }
  await expect(bandWahl).toBeVisible();
  await bandWahl.selectOption(bandId);
}
