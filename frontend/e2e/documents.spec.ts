import { expect, test, type Page } from "@playwright/test";
import { pdfBytes } from "../../scripts/lib/pdf.mjs";
import { anmelden, benutzer, passwort } from "./anmelden";

const bandId = process.env.E2E_BAND_ID ?? "";
const zweiteBandId = process.env.E2E_ZWEITE_BAND_ID ?? "";
const songId = process.env.E2E_SONG_ID ?? "";

async function pdfRoute(page: Page, versionId?: number) {
  const ziel = versionId
    ? `/songs/${bandId}/${songId}/pdf/versions/${versionId}`
    : `/songs/${bandId}/${songId}/pdf`;
  await page.goto(ziel);
  const menue = page.getByText("PDF-Versionen und Download", {exact:true});
  await expect(menue.or(page.getByLabel("Benutzername"))).toBeVisible();
  if (await menue.count()) await menue.click();
}

async function nichtWeiss(page: Page) {
  return page.locator("canvas").evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext("2d");
    if (!context || canvas.width === 0 || canvas.height === 0) {
      return false;
    }
    const daten = context.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 0; i < daten.length; i += 4) {
      if (daten[i] < 220 || daten[i + 1] < 220 || daten[i + 2] < 220) {
        return true;
      }
    }
    return false;
  });
}

test("PDF.js rendert, zoomt, dreht, laedt herunter und erhaelt Entwuerfe", async ({
  page,
  context,
}) => {
  test.skip(!benutzer || !passwort || !bandId || !songId, "E2E-Umgebung fehlt");
  await anmelden(page, bandId);
  await pdfRoute(page);
  await expect(page.getByText("Für diesen Song ist noch keine PDF hinterlegt.")).toBeVisible();

  const ersteAntwort = page.waitForResponse(
    (antwort) => antwort.request().method() === "POST" && antwort.url().endsWith("/versions/"),
  );
  await page.getByLabel("PDF-Datei").setInputFiles({
    name: "browser-partitur.pdf",
    mimeType: "application/pdf",
    buffer: pdfBytes(),
  });
  await page.getByRole("button", { name: "PDF hochladen" }).click();
  const erste = await (await ersteAntwort).json();
  await expect(page.getByText(/Version 1 gespeichert/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Version 1 ist aktiv" })).toHaveCount(0);
  await page.getByRole("button", { name: "Als aktive Version wählen" }).click();
  await expect(page.getByRole("button", { name: "Version 1 ist aktiv" })).toBeVisible();

  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect(page.getByText("Seite 1 von 3")).toBeVisible();
  await expect.poll(() => nichtWeiss(page), { timeout: 20_000 }).toBe(true);

  await page.getByText("Ansicht", {exact:true}).click();
  const zoom = page.getByLabel("Zoom in Prozent");
  await expect(zoom).toHaveAttribute("min", "50");
  await expect(zoom).toHaveAttribute("max", "300");
  await zoom.focus();
  await zoom.press("Home");
  await expect(page.locator(".pdf-werkzeuge .songmeta")).toHaveText("50 %");
  await expect(page.getByRole("button", { name: "Verkleinern" })).toBeDisabled();
  await zoom.press("End");
  await expect(page.locator(".pdf-werkzeuge .songmeta")).toHaveText("300 %");
  await expect(page.getByRole("button", { name: "Vergrößern" })).toBeDisabled();
  await zoom.press("Home");
  await page.getByRole("button", { name: "Vergrößern" }).click();
  await page.getByRole("button", { name: "Vergrößern" }).click();
  await page.getByRole("button", { name: "Vergrößern" }).click();
  await expect(page.locator(".pdf-werkzeuge .songmeta")).toHaveText("125 %");
  await page.getByRole("button", { name: "An Breite anpassen" }).click();
  await expect(page.locator(".pdf-werkzeuge .songmeta")).toHaveText("Breite");

  const hoch = await canvas.evaluate((element) => (element as HTMLCanvasElement).height);
  await page.getByRole("button", { name: "Drehen" }).click();
  await expect
    .poll(() => canvas.evaluate((element) => (element as HTMLCanvasElement).height))
    .not.toBe(hoch);

  await page.getByRole("button", { name: "Nächste Seite" }).click();
  await expect(page.getByText("Seite 2 von 3")).toBeVisible();
  await expect.poll(() => nichtWeiss(page), { timeout: 20_000 }).toBe(true);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Version 1 herunterladen" }).click();
  expect((await download).suggestedFilename()).toBe("browser-partitur.pdf");

  const uploadMenue = page.locator("details").filter({has:page.locator(".pdf-upload")});
  if (await uploadMenue.getAttribute("open") === null) await uploadMenue.locator("summary").click();
  await page.getByLabel("PDF-Datei").setInputFiles({
    name: "zweite-fassung.pdf",
    mimeType: "application/pdf",
    buffer: pdfBytes({ seiten: [{ width: 420, height: 595 }] }),
  });
  await page.getByRole("button", { name: "PDF hochladen" }).click();
  await expect(page.getByText(/Version 2 gespeichert/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Version 1 ist aktiv" })).toBeVisible();
  await page.getByRole("button", { name: "Version 2 aktivieren" }).click();
  await expect(page.getByRole("button", { name: "Version 2 ist aktiv" })).toBeVisible();
  await page.getByRole("button", { name: "Version 1 ansehen" }).click();
  await expect(page.getByRole("button", { name: "Version 2 ist aktiv" })).toBeVisible();

  const formularAntwort = page.waitForResponse(
    (antwort) => antwort.request().method() === "POST" && antwort.url().endsWith("/versions/"),
  );
  await page.getByLabel("PDF-Datei").setInputFiles({
    name: "formular.pdf",
    mimeType: "application/pdf",
    buffer: pdfBytes({
      seiten: [{ width: 595, height: 842, rotate: 0 }],
      formular: true,
      anhang: true,
    }),
  });
  await page.getByRole("button", { name: "PDF hochladen" }).click();
  const formular = await (await formularAntwort).json();
  await pdfRoute(page, formular.id);
  await expect(page.getByText("Seite 1 von 1")).toBeVisible();
  await expect(page.locator(".pdf-seite canvas")).toBeVisible();
  await expect(
    page.locator(".pdf-seite input, .pdf-seite textarea, .pdf-seite select, .pdf-seite a, .pdf-seite iframe, .pdf-seite object, .pdf-seite embed"),
  ).toHaveCount(0);
  expect(page.url()).toContain(`/versions/${formular.id}`);
  await expect.poll(() => nichtWeiss(page), { timeout: 20_000 }).toBe(true);

  await pdfRoute(page, erste.id);
  await expect(page.getByRole("button", { name: "Version 1 ansehen", pressed: true })).toBeVisible();
  await expect(page.getByText("Seite 1 von 3")).toBeVisible();
  await page.goBack();
  await page.getByText("Band und Konto", {exact:true}).click();
  await expect(page.locator("label.bandwechsel select")).toBeVisible();

  await page.goto("/setlists");
  await page.getByText("Setlist hinzufügen", {exact:true}).click();
  await page.getByLabel("Neue Setlist").fill("PDF-Entwurf");
  await page.getByRole("button", { name: "Setlist anlegen" }).click();
  await page.getByRole("button", { name: "Set hinzufügen" }).click();
  await page.locator(".setlist-hinzufuegen select").first().selectOption({ label: "PDF-Browser" });
  await page.getByRole("button", { name: "Song in Abschnitt 1" }).click();
  await expect(page.getByText("Entwurf", { exact: true })).toBeVisible();
  const [neueSeite] = await Promise.all([
    context.waitForEvent("page"),
    page.getByRole("link", { name: /PDF in neuem Tab öffnen/ }).first().click(),
  ]);
  await neueSeite.waitForLoadState();
  await expect(neueSeite).toHaveURL(new RegExp(`/songs/${bandId}/${songId}/pdf`));
  await neueSeite.close();
  await expect(page.getByText("Entwurf", { exact: true })).toBeVisible();

  if (zweiteBandId) {
    await pdfRoute(page);
    await page.getByText("Band und Konto", {exact:true}).click();
    await page.locator("label.bandwechsel select").selectOption(zweiteBandId);
    await expect(page).toHaveURL(/\/songs$/);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await pdfRoute(page);
  await expect(page.getByText("Seite 1 von 1")).toBeVisible();
  const breite = await canvas.evaluate((element) => (element as HTMLCanvasElement).getBoundingClientRect().width);
  expect(breite).toBeLessThanOrEqual(390);

  await context.clearCookies();
  await pdfRoute(page);
  await expect(page.getByLabel("Benutzername")).toBeVisible();
});
