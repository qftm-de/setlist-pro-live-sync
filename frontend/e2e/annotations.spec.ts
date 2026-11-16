import { expect, test, type Locator, type Page } from "@playwright/test";
import { anmelden, benutzer, passwort } from "./anmelden";

const bandId = process.env.E2E_BAND_ID ?? "";
const songId = process.env.E2E_SONG_ID ?? "";
const version1 = Number(process.env.E2E_VERSION_1 ?? 0);
const version2 = Number(process.env.E2E_VERSION_2 ?? 0);

async function pdfRoute(page: Page, versionId: number) {
  await page.goto(`/songs/${bandId}/${songId}/pdf/versions/${versionId}`);
  await expect(page.locator(".pdf-ebene")).toBeVisible();
}

async function positioniere(page: Page, anteil: number) {
  await page.evaluate((wert) => {
    const element = document.querySelector(".pdf-ebene");
    if (!element) {
      return;
    }
    const rect = element.getBoundingClientRect();
    const ziel = window.scrollY + rect.top + rect.height * wert - window.innerHeight / 2;
    window.scrollTo(0, Math.max(0, ziel));
  }, anteil);
}

async function ziehe(
  page: Page,
  vonX: number,
  vonY: number,
  bisX: number,
  bisY: number,
) {
  await positioniere(page, (vonY + bisY) / 2);
  const ebene = page.locator(".pdf-ebene");
  const box = await ebene.boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    return;
  }
  await page.mouse.move(box.x + box.width * vonX, box.y + box.height * vonY);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * bisX, box.y + box.height * bisY);
  await page.mouse.up();
}

async function werkzeug(page: Page, name: string) {
  const knopf = page.getByRole("button", { name });
  await knopf.click();
  await expect(knopf).toHaveAttribute("aria-pressed", "true");
}

async function klicke(page: Page, x: number, y: number) {
  await positioniere(page, y);
  const ebene = page.locator(".pdf-ebene");
  const box = await ebene.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
  }
}

async function rechteckPasst(
  page: Page,
  element: Locator,
  x: number,
  y: number,
  breite: number,
  hoehe: number,
) {
  const ebene = await page.locator(".pdf-ebene").boundingBox();
  const marker = await element.boundingBox();
  expect(ebene).not.toBeNull();
  expect(marker).not.toBeNull();
  if (!ebene || !marker) {
    return;
  }
  expect(Math.abs(marker.x - ebene.x - ebene.width * x)).toBeLessThan(6);
  expect(Math.abs(marker.y - ebene.y - ebene.height * y)).toBeLessThan(6);
  expect(Math.abs(marker.width - ebene.width * breite)).toBeLessThan(6);
  expect(Math.abs(marker.height - ebene.height * hoehe)).toBeLessThan(6);
}

test("Anmerkungen: Marker, Text, Teilen, Ebenen, Entwuerfe und Rotation", async ({
  page,
  context,
}) => {
  test.skip(
    !benutzer || !passwort || !bandId || !songId || !version1 || !version2,
    "E2E-Umgebung fehlt",
  );
  await anmelden(page, bandId);
  await pdfRoute(page, version1);
  await expect(page.getByText("Seite 1 von 3")).toBeVisible();

  await werkzeug(page, "Marker zeichnen");
  await ziehe(page, 0.2, 0.2, 0.4, 0.4);
  await expect(page.getByRole("button", { name: "Marker auf Seite 1" })).toBeVisible();
  await rechteckPasst(
    page,
    page.locator(".pdf-anmerkung.art-marker").first(),
    0.2,
    0.2,
    0.2,
    0.2,
  );

  await page.getByRole("button", { name: "Marker auf Seite 1" }).click();
  await page.locator(".anmerkung-formular select").first().selectOption("blau");
  await page.getByRole("button", { name: "Anmerkung speichern" }).click();
  await expect(page.locator(".pdf-anmerkung.farbe-blau")).toBeVisible();

  for (let runde = 0; runde < 4; runde += 1) {
    await werkzeug(page, "Marker zeichnen");
    await ziehe(page, 0.05 + runde * 0.2, 0.85, 0.12 + runde * 0.2, 0.95);
    await expect(page.locator(".pdf-anmerkung.art-marker")).toHaveCount(runde + 2);
    await rechteckPasst(
      page,
      page.locator(".pdf-anmerkung.art-marker").last(),
      0.05 + runde * 0.2,
      0.85,
      0.07,
      0.1,
    );
    await page.getByRole("button", { name: "Drehen" }).click();
  }

  await werkzeug(page, "Text setzen");
  await klicke(page, 0.5, 0.5);
  await page.locator(".anmerkung-formular textarea").fill("Bitte leiser");
  await page.getByLabel("Sichtbarkeit").selectOption("band");
  await expect(page.getByText(/Alle aktuellen Bandmitglieder sehen diesen Inhalt/)).toBeVisible();
  await page.getByRole("button", { name: "Anmerkung speichern" }).click();
  await expect(page.getByRole("button", { name: /Bitte leiser/ })).toBeVisible();

  await page.getByRole("button", { name: /Bitte leiser/ }).click();
  await page.locator(".anmerkung-formular textarea").fill("Bitte leiser und ruhiger");
  await page.getByRole("button", { name: "Anmerkung speichern" }).click();
  await expect(page.getByRole("button", { name: /Bitte leiser und ruhiger/ })).toBeVisible();

  await page.getByLabel("Eigene persönliche Anmerkungen anzeigen").uncheck();
  await expect(page.locator(".pdf-anmerkung.art-marker")).toHaveCount(0);
  await page.getByLabel("Eigene persönliche Anmerkungen anzeigen").check();
  await page.getByLabel("Bandweite Anmerkungen anzeigen").uncheck();
  await expect(page.locator(".pdf-anmerkung.art-text")).toHaveCount(0);
  await page.getByLabel("Bandweite Anmerkungen anzeigen").check();

  await werkzeug(page, "Text setzen");
  await klicke(page, 0.6, 0.6);
  await page.locator(".anmerkung-formular textarea").fill("Ungespeicherter Entwurf");
  await page.getByRole("button", { name: "Version 2 ansehen" }).click();
  await expect(page.getByRole("dialog", { name: "Ungespeicherter Entwurf" })).toBeVisible();
  await page.getByRole("button", { name: "Wechsel abbrechen" }).click();
  await expect(page.getByText("Seite 1 von 3")).toBeVisible();
  await page.getByRole("button", { name: "Version 2 ansehen" }).click();
  await page.getByRole("button", { name: "Entwurf verwerfen und wechseln" }).click();
  await expect(page.getByText("Seite 1 von 1")).toBeVisible();
  await page.getByRole("button", { name: "Version 1 ansehen" }).click();
  await expect(page.getByText("Seite 1 von 3")).toBeVisible();
  await expect(page.getByRole("button", { name: /Bitte leiser und ruhiger/ })).toBeVisible();

  await werkzeug(page, "Text setzen");
  await klicke(page, 0.7, 0.7);
  await page.locator(".anmerkung-formular textarea").fill("Entwurf fuer Seite 2");
  await page.getByRole("button", { name: "Nächste Seite" }).click();
  await expect(page.getByRole("dialog", { name: "Ungespeicherter Entwurf" })).toBeVisible();
  await page.getByRole("button", { name: "Entwurf verwerfen und wechseln" }).click();
  await expect(page.getByText("Seite 2 von 3")).toBeVisible();

  const leinwand = page.locator("canvas");
  const masse = await leinwand.evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    return { breite: canvas.width, hoehe: canvas.height };
  });
  expect(masse.breite).toBeGreaterThan(masse.hoehe);

  await werkzeug(page, "Marker zeichnen");
  await ziehe(page, 0.3, 0.3, 0.5, 0.5);
  await expect(page.getByRole("button", { name: "Marker auf Seite 2" })).toBeVisible();
  await rechteckPasst(
    page,
    page.locator(".pdf-anmerkung.art-marker").first(),
    0.3,
    0.3,
    0.2,
    0.2,
  );

  const zoom = page.getByLabel("Zoom in Prozent");
  await zoom.focus();
  await zoom.press("Home");
  await zoom.press("ArrowRight");
  await zoom.press("ArrowRight");
  await expect(page.getByText("100 %")).toBeVisible();
  const vorher = await page.locator(".pdf-anmerkung.art-marker").first().boundingBox();
  await zoom.press("End");
  await expect(page.getByText("300 %")).toBeVisible();
  const nachher = await page.locator(".pdf-anmerkung.art-marker").first().boundingBox();
  expect(vorher).not.toBeNull();
  expect(nachher).not.toBeNull();
  if (vorher && nachher) {
    expect(nachher.width / vorher.width).toBeGreaterThan(2.5);
  }

  await positioniere(page, 0.5);
  const ebene = page.locator(".pdf-ebene");
  const box = await ebene.boundingBox();
  const anzahlVorher = await page.locator(".pdf-anmerkung.art-marker").count();
  if (box) {
    await ebene.dispatchEvent("pointerdown", {
      pointerId: 9,
      pointerType: "touch",
      clientX: box.x + box.width * 0.2,
      clientY: box.y + box.height * 0.2,
    });
    await ebene.dispatchEvent("pointermove", {
      pointerId: 9,
      pointerType: "touch",
      clientX: box.x + box.width * 0.4,
      clientY: box.y + box.height * 0.4,
    });
    await ebene.dispatchEvent("pointercancel", { pointerId: 9, pointerType: "touch" });
    await expect(page.locator(".pdf-anmerkung.art-marker")).toHaveCount(anzahlVorher);
    await ebene.dispatchEvent("pointerdown", {
      pointerId: 10,
      pointerType: "touch",
      clientX: box.x + box.width * 0.6,
      clientY: box.y + box.height * 0.6,
    });
    await ebene.dispatchEvent("pointermove", {
      pointerId: 10,
      pointerType: "touch",
      clientX: box.x + box.width * 0.75,
      clientY: box.y + box.height * 0.75,
    });
    await ebene.dispatchEvent("pointerup", {
      pointerId: 10,
      pointerType: "touch",
      clientX: box.x + box.width * 0.75,
      clientY: box.y + box.height * 0.75,
    });
    await expect(page.locator(".pdf-anmerkung.art-marker")).toHaveCount(anzahlVorher + 1);
  }

  await page.getByRole("button", { name: "Nächste Seite" }).click();
  await expect(page.getByText("Seite 3 von 3")).toBeVisible();
  await werkzeug(page, "Marker zeichnen");
  await ziehe(page, 0.3, 0.3, 0.5, 0.5);
  await expect(page.getByRole("button", { name: "Marker auf Seite 3" })).toBeVisible();
  await rechteckPasst(
    page,
    page.locator(".pdf-anmerkung.art-marker").first(),
    0.3,
    0.3,
    0.2,
    0.2,
  );

  await page.getByRole("button", { name: "An Breite anpassen" }).click();
  await expect(page.locator(".pdf-werkzeuge .songmeta")).toHaveText("Breite");
  await werkzeug(page, "Text setzen");
  await klicke(page, 0.8, 0.8);
  await page.locator(".anmerkung-formular textarea").fill("Browser-Zurueck");
  const entwurfAdresse = page.url();
  await page.evaluate(() => {
    window.history.pushState({}, "", "/songs");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.getByRole("dialog", { name: "Ungespeicherter Entwurf" })).toBeVisible();
  await expect(page).toHaveURL(entwurfAdresse);
  await page.getByRole("button", { name: "Wechsel abbrechen" }).click();
  await expect(page).toHaveURL(entwurfAdresse);
  await page
    .locator(".anmerkung-formular")
    .getByRole("button", { name: "Abbrechen" })
    .click();

  await context.clearCookies();
  await page.goto(`/songs/${bandId}/${songId}/pdf/versions/${version1}`);
  await expect(page.getByLabel("Benutzername")).toBeVisible();
});
