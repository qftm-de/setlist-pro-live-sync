import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { anmelden, benutzer, passwort } from "./anmelden";

const bandId = process.env.E2E_BAND_ID ?? "";

test("Beitritt über den Einladungslink funktioniert im Browser", async ({ page }) => {
  test.skip(!benutzer || !passwort || !bandId, "E2E-Umgebung fehlt");

  // Eigene Client-IP für den Browser-Lauf, damit der Beitritt nicht das
  // Einladungs-Rate-Limit des Node-Smokes im selben Testlauf verbraucht.
  const testIp = "198.51.100.23";
  await page.context().setExtraHTTPHeaders({ "X-Forwarded-For": testIp });
  await anmelden(page, bandId);

  const csrf = (await page.context().cookies()).find(
    (cookie) => cookie.name === "csrftoken",
  )?.value;
  expect(csrf).toBeTruthy();

  const erstellt = await page.request.post(`/api/bands/${bandId}/invitations/`, {
    headers: { "X-CSRFToken": csrf ?? "" },
    data: { note: "Browser-Smoke", max_uses: 1 },
  });
  expect(erstellt.status()).toBe(201);
  const { token, invite_path: invitePath } = (await erstellt.json()) as {
    token: string;
    invite_path: string;
  };

  const browser = page.context().browser();
  expect(browser).not.toBeNull();
  const gastKontext = await browser!.newContext({
    extraHTTPHeaders: { "X-Forwarded-For": testIp },
  });
  const gast = await gastKontext.newPage();
  const referer: string[] = [];
  gast.on("request", (anfrage) => {
    const wert = anfrage.headers()["referer"];
    if (wert) {
      referer.push(wert);
    }
  });

  const antwort = await gast.goto(new URL(invitePath, page.url()).toString());
  expect(antwort?.headers()["referrer-policy"]).toBe("strict-origin");

  const name = `gast-${randomUUID().slice(0, 8)}`;
  const gastPasswort = `Gast-${randomUUID()}-9x`;
  await gast.getByLabel("Benutzername").fill(name);
  await gast.getByLabel("Anzeigename").fill("Browser-Gast");
  await gast.getByLabel("E-Mail").fill(`${name}@example.test`);
  await gast.getByLabel("Passwort", { exact: true }).fill(gastPasswort);
  await gast.getByLabel("Passwort wiederholen").fill(gastPasswort);
  await gast.getByRole("button", { name: "Konto anlegen und beitreten" }).click();

  await expect(
    gast.getByRole("heading", { name: "Bereit für die nächste Probe" }),
  ).toBeVisible();
  expect(new URL(gast.url()).pathname).not.toContain("/einladung/");
  expect(referer.some((wert) => wert.includes(token))).toBe(false);
  await gastKontext.close();
});
