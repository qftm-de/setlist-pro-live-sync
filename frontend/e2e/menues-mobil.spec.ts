import { expect, test, type Locator, type Page } from "@playwright/test";

const setlistName = "Jubiläums- und Sommernachts-Setlist mit Gästen aus mehreren Städten";
const songTitel = "Ein sehr langer Songtitel mit Untertitel und Gästen";
const notizText = "Eine lange Notiz für den Abschnitt auf schmalen Bildschirmen";
const songs = [{ id: 11, title: songTitel }];
const setlist = {
  id: 1,
  name: setlistName,
  revision: 0,
  sections: [{
    id: 21,
    name: "Erster Abschnitt mit langem Namen für schmale Bildschirme",
    kind: "set",
    position: 1,
    entries: [
      { id: 31, position: 1, entry_type: "song", song: songs[0], label: "", duration_seconds: null },
      { id: 32, position: 2, entry_type: "notiz", song: null, label: notizText, duration_seconds: null },
    ],
  }],
};

async function apiAntworten(page: Page) {
  const band = { id: 1, name: "Beispielband mit außergewöhnlich langem Namen", songs };
  const antworten: Record<string, unknown> = {
    "/api/config/": { mode: "core", instance_name: "E2E-Menüs", community_url: null },
    "/api/session/": { username: "e2e", display_name: "E2E Test" },
    "/api/bands/": [band],
    "/api/bands/1/": band,
    "/api/bands/1/sync/": { counters: { band: 0, personal: 0 }, server_time: "2026-01-01T00:00:00Z" },
    "/api/bands/1/setlists/": [{ id: 1, name: setlistName, revision: 0 }],
    "/api/bands/1/setlists/1/": setlist,
    "/api/bands/1/setlists/1/texts/": { revision: 0, texts: [] },
  };
  await page.route((url) => url.pathname.startsWith("/api/"), (route) => {
    const daten = antworten[new URL(route.request().url()).pathname];
    return route.fulfill({
      status: daten === undefined ? 404 : 200,
      contentType: "application/json",
      body: JSON.stringify(daten ?? { detail: "Nicht gemockt." }),
    });
  });
  await page.routeWebSocket(/\/ws\/bands\//, (socket) => {
    const counters = { band: 0, personal: 0 };
    socket.send(JSON.stringify({ type: "ready", band: 1, connection: "e2e-verbindung", counters }));
    socket.onMessage((nachricht) => {
      if (typeof nachricht === "string" && JSON.parse(nachricht).type === "ping") {
        socket.send(JSON.stringify({ type: "pong", counters }));
      }
    });
  });
}

async function pruefeFeld(control: Locator, behaelter: Locator, volleBreite = false) {
  await expect(control).toBeVisible();
  const label = control.locator("xpath=ancestor::label[1]");
  const textUnten = await label.evaluate((element) => {
    const text = Array.from(element.childNodes).find(
      (knoten) => knoten.nodeType === Node.TEXT_NODE && knoten.textContent?.trim(),
    );
    if (!text) throw new Error("Labeltext fehlt");
    const bereich = document.createRange();
    bereich.selectNodeContents(text);
    return bereich.getBoundingClientRect().bottom;
  });
  const feldBox = (await control.boundingBox())!;
  const labelBox = (await label.boundingBox())!;
  expect(feldBox.height).toBeGreaterThanOrEqual(44);
  expect(feldBox.y).toBeGreaterThanOrEqual(textUnten - 1);
  expect(feldBox.width).toBeGreaterThanOrEqual(labelBox.width * 0.95);
  if (volleBreite) {
    expect(labelBox.width).toBeGreaterThanOrEqual((await behaelter.boundingBox())!.width * 0.8);
  }
}

test("Menüs und Setlist-Editor bleiben bei 360 bis 1280 Pixeln bedienbar", async ({ page }) => {
  await apiAntworten(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/setlists");
  await expect(page.getByRole("heading", { name: "Setlists", exact: true })).toBeVisible();

  const bandMenue = page.locator("details.band-menue");
  await bandMenue.locator("summary").click();
  await expect(bandMenue.getByText(/Angemeldet als E2E Test/)).toBeVisible();
  await page.locator("details.anlegen-menue summary").click();

  const editor = page.locator(".setlist-editor");
  const block = editor.locator(".setlist-block");
  const hinzufuegen = block.locator(".setlist-hinzufuegen");
  const sortierung = block.locator(".setlist-sortierung").first();
  const zeilenSortierung = block.locator(".setlist-eintraege .setlist-sortierung").first();
  const listenEintrag = page.locator(".setlist-liste li").first();
  const setlistWahl = listenEintrag.locator(".setlist-wahl");
  const buehneKnopf = listenEintrag.getByRole("button", { name: `Bühne aus ${setlistName} öffnen` });
  const loeschenKnopf = listenEintrag.getByRole("button", { name: `${setlistName} löschen` });
  await expect(setlistWahl).toHaveText(setlistName);
  await expect(buehneKnopf).toHaveText("Bühne öffnen");
  await expect(loeschenKnopf).toHaveText("Löschen");

  for (const breite of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width: breite, height: 900 });
    const seitenBreite = await page.evaluate(() =>
      Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    );
    expect(seitenBreite).toBeLessThanOrEqual(breite + 1);
    for (const text of [setlistWahl, editor.getByRole("heading", { name: setlistName })]) {
      expect(await text.evaluate((knoten) => knoten.scrollWidth - knoten.clientWidth)).toBeLessThanOrEqual(1);
    }
    const bandFeld = page.locator("label.bandwechsel select");
    expect((await bandFeld.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await pruefeFeld(page.getByLabel("Neue Setlist", { exact: true }), page.locator(".setlist-formular"), true);
    await pruefeFeld(editor.getByLabel("Setlist-Name", { exact: true }), editor.locator(".setlist-name"), true);
    await pruefeFeld(editor.getByLabel("Abschnitt 1", { exact: true }), block.locator("header"));
    await pruefeFeld(editor.getByRole("combobox", { name: "Song", exact: true }), hinzufuegen, breite <= 390);
    await pruefeFeld(
      editor.getByRole("textbox", { name: "Notiz für Abschnitt 1 (leer ergibt Pause)", exact: true }),
      hinzufuegen,
      breite <= 390,
    );
    for (const [name, text] of [
      ["Abschnitt 1 nach oben", "Nach oben"],
      ["Abschnitt 1 nach unten", "Nach unten"],
      ["Abschnitt 1 entfernen", "Entfernen"],
    ]) {
      await expect(sortierung.getByRole("button", { name, exact: true })).toHaveText(text);
    }
    await expect(sortierung.getByRole("button", { name: /hinzufügen|Song in Abschnitt|Eintrag in Abschnitt/i })).toHaveCount(0);
    await expect(hinzufuegen.locator(".setlist-sortierung")).toHaveCount(0);
    await expect(zeilenSortierung.getByRole("button", { name: `${songTitel} an Position 1 nach oben` })).toHaveText("Nach oben");
    await expect(zeilenSortierung.getByRole("button", { name: `${songTitel} an Position 1 entfernen` })).toHaveText("Entfernen");
    for (const knopf of [
      setlistWahl, buehneKnopf, loeschenKnopf,
      sortierung.getByRole("button", { name: "Abschnitt 1 entfernen", exact: true }),
      hinzufuegen.getByRole("button", { name: "Song in Abschnitt 1", exact: true }),
      hinzufuegen.getByRole("button", { name: "Eintrag in Abschnitt 1", exact: true }),
    ]) {
      await expect(knopf).toBeVisible();
      expect((await knopf.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    if (breite <= 390) {
      const wahlBox = (await setlistWahl.boundingBox())!;
      const buehneBox = (await buehneKnopf.boundingBox())!;
      const loeschenBox = (await loeschenKnopf.boundingBox())!;
      expect(wahlBox.width).toBeGreaterThanOrEqual((await listenEintrag.boundingBox())!.width * 0.8);
      expect(buehneBox.y).toBeGreaterThanOrEqual(wahlBox.y + wahlBox.height - 1);
      expect(Math.abs(buehneBox.y - loeschenBox.y)).toBeLessThanOrEqual(2);
    }
  }
});
