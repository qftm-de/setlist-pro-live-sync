import { expect, test, type Locator, type Page } from "@playwright/test";
import { pdfBytes } from "../../scripts/lib/pdf.mjs";

const band = { id: 1, name: "Abstandsband mit außergewöhnlich langem Namen" };
const song = { id: 11, title: "Song für sichtbare Abstände", artist: "Testband", key: "C", bpm: 120, notes: "Notiz" };
const gig = {
  id: 41,
  title: "Auftritt für sichtbare Abstände",
  date: "2099-06-15",
  time: "20:00:00",
  location: "Stadthalle mit langem Namen",
  notes: "",
  setlist_id: null,
  setlist_name: null,
};
const pdf = pdfBytes({ seiten: [{ width: 595, height: 842, rotate: 0 }] });
const dokument = {
  id: 7,
  revision: 0,
  active_version_id: 101,
  versions: [{
    id: 101,
    number: 1,
    upload_id: "e2e-abstaende",
    original_name: "abstaende.pdf",
    byte_size: pdf.length,
    page_count: 1,
    sha256: "a".repeat(64),
    created_at: "2026-01-01T00:00:00Z",
  }],
  limits: { max_upload_bytes: 5_000_000, max_pages: 20 },
};
const sitzung = {
  id: 1, band_id: 1, state: "active", generation: 1, revision: 0,
  leader_user_id: 1, leader_connection_active: true, last_number: 0,
  current: { entry_uuid: "eintrag-1", page: null }, started_at: null, ended_at: null,
  actions: { can_control: true, can_handover: true, can_takeover: true, can_resume: true, can_end: true },
  members: [{ user_id: 1, display_name: "E2E Test" }, { user_id: 2, display_name: "Gast" }],
  sections: [{ uuid: "set-1", name: "Erstes Set", kind: "set", position: 1,
    entries: [{ uuid: "eintrag-1", position: 1, entry_type: "song", label: "", song, document: null }],
  }],
};
const antworten: Record<string, unknown> = {
  "/api/config/": { mode: "core", instance_name: "E2E-Abstände", community_url: null },
  "/api/session/": { username: "e2e", display_name: "E2E Test" },
  "/api/bands/": [band],
  "/api/bands/1/": { id: 1, name: band.name, songs: [song] },
  "/api/bands/1/setlists/": [],
  "/api/bands/1/gigs/": { upcoming: [gig], past: [] },
  "/api/bands/1/sync/": { counters: { band: 0, personal: 0 }, server_time: "2026-01-01T00:00:00Z" },
  "/api/bands/1/songs/11/document/": dokument,
  "/api/bands/1/songs/11/document/versions/101/annotations/": [],
  "/api/bands/1/stage-sessions/1/": sitzung,
};

async function mockApi(page: Page) {
  await page.route((url) => url.pathname.startsWith("/api/"), (route) => {
    const pfad = new URL(route.request().url()).pathname;
    if (pfad === "/api/bands/1/songs/11/document/versions/101/file/") {
      return route.fulfill({ status: 200, contentType: "application/pdf", body: pdf });
    }
    const daten = antworten[pfad];
    return route.fulfill({
      status: daten === undefined ? 404 : 200,
      contentType: "application/json",
      body: JSON.stringify(daten ?? { detail: "Nicht gemockt." }),
    });
  });
  await page.routeWebSocket(/\/ws\/bands\//, (socket) => {
    const counters = { band: 0, personal: 0 };
    socket.send(JSON.stringify({ type: "ready", band: 1, connection: "e2e-abstaende", counters }));
    socket.onMessage((nachricht) => {
      if (typeof nachricht === "string" && JSON.parse(nachricht).type === "ping") {
        socket.send(JSON.stringify({ type: "pong", counters }));
      }
    });
  });
}

async function oeffne(menue: Locator) {
  await expect(menue).toBeVisible();
  if (!(await menue.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await menue.locator("summary").click();
  }
}

interface Kasten {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
}

async function kaesten(bereich: Locator): Promise<Kasten[]> {
  const steuerung = bereich.locator(
    "button, a[href], summary, select, input:not([type='hidden']), textarea",
  );
  const ergebnis: Kasten[] = [];
  for (let index = 0; index < await steuerung.count(); index += 1) {
    const element = steuerung.nth(index);
    if (!(await element.isVisible())) {
      continue;
    }
    const box = await element.boundingBox();
    if (!box || box.width < 2 || box.height < 2) {
      continue;
    }
    const name = await element.evaluate((knoten) =>
      (knoten.textContent || knoten.getAttribute("aria-label") || knoten.tagName)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 40),
    );
    ergebnis.push({ ...box, name });
  }
  return ergebnis;
}

async function abstaende(bereich: Locator, name: string, minimum = 8): Promise<string[]> {
  const boxen = await kaesten(bereich);
  const verstoesse: string[] = [];
  for (let links = 0; links < boxen.length; links += 1) {
    for (let rechts = links + 1; rechts < boxen.length; rechts += 1) {
      const a = boxen[links];
      const b = boxen[rechts];
      const ueberlappungX =
        Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const ueberlappungY =
        Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      let luecke: number | null = null;
      let richtung = "";
      if (ueberlappungY > 0 && ueberlappungX <= 0) {
        luecke = -ueberlappungX;
        richtung = "horizontal";
      } else if (ueberlappungX > 0 && ueberlappungY <= 0) {
        luecke = -ueberlappungY;
        richtung = "vertikal";
      } else if (ueberlappungX > 0 && ueberlappungY > 0) {
        luecke = -Math.min(ueberlappungX, ueberlappungY);
        richtung = "überlappt";
      }
      if (luecke !== null && luecke < minimum - 0.25) {
        verstoesse.push(
          `${name}: ${richtung} ${luecke.toFixed(1)}px zwischen "${a.name}" und "${b.name}"`,
        );
      }
    }
  }
  return verstoesse;
}

async function gestapelt(oben: Locator, unten: Locator, name: string, minimum = 12) {
  const a = (await oben.boundingBox())!;
  const b = (await unten.boundingBox())!;
  const oberer = a.y <= b.y ? a : b;
  const unterer = a.y <= b.y ? b : a;
  const luecke = unterer.y - (oberer.y + oberer.height);
  return luecke < minimum - 0.25
    ? `${name}: gestapelt ${luecke.toFixed(1)}px`
    : null;
}

const breiten = [360, 390, 768, 1280] as const;

test("PDF-Ansicht hält Abstände in offenen Menüs", async ({ page }) => {
  await mockApi(page);
  await page.goto("/songs/1/11/pdf");
  await expect(page.getByText("Seite 1 von 1")).toBeVisible({ timeout: 30_000 });

  const werkzeuge = page.locator(".pdf-werkzeuge");
  const ansicht = werkzeuge.locator("details");
  const anmerkungsMenue = page.locator("details.werkzeug-menue");
  const versionen = page.locator("details.dokument-verwaltung");
  const upload = page.locator(".dokument > details").last();
  for (const breite of breiten) {
    await page.setViewportSize({ width: breite, height: 900 });
    expect.soft(await abstaende(page.locator(".inhalt"), "Geschlossene PDF-Menüs")).toEqual([]);
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({ path: test.info().outputPath("pdf-menues-geschlossen.png"), fullPage: true });
  await oeffne(ansicht);
  await oeffne(anmerkungsMenue);
  await oeffne(versionen);
  await oeffne(upload);

  for (const breite of breiten) {
    await page.setViewportSize({ width: breite, height: 900 });
    const verstoesse = [
      ...(await abstaende(werkzeuge, "PDF-Werkzeuge")),
      ...(await abstaende(anmerkungsMenue, "Anmerkungswerkzeug")),
      ...(await abstaende(versionen, "Versionsmenü")),
      ...(await abstaende(upload, "Upload-Menü")),
      await gestapelt(versionen, upload, "Versionen -> Upload"),
      await gestapelt(upload, page.locator("details.band-menue"), "Upload -> Bandmenü"),
    ].filter((eintrag): eintrag is string => eintrag !== null);
    expect.soft(verstoesse, `PDF bei ${breite}px`).toEqual([]);
    if (breite === 390) {
      await page.screenshot({ path: test.info().outputPath("pdf-menues-offen.png"), fullPage: true });
    }
  }
});

test("Song-Menü hält Abstände", async ({ page }) => {
  await mockApi(page);
  await page.goto("/songs");
  await expect(page.getByRole("heading", { name: "Songs", exact: true })).toBeVisible();
  const zeile = page.locator(".songzeile").first();
  await oeffne(zeile.locator("details.zeilen-menue"));

  for (const breite of breiten) {
    await page.setViewportSize({ width: breite, height: 900 });
    expect.soft(await abstaende(zeile, "Song-Zeile"), `Song bei ${breite}px`).toEqual([]);
  }
  await zeile.getByRole("button", { name: `${song.title} ändern`, exact: true }).click();
  const formular = zeile.locator("form.songbearbeiten");
  await expect(formular).toBeVisible();
  for (const breite of breiten) {
    await page.setViewportSize({ width: breite, height: 900 });
    expect.soft(await abstaende(formular, "Song-Bearbeitung"), `Song bei ${breite}px`).toEqual([]);
  }
});

test("Auftritt-Bearbeitungsformular hält Abstände", async ({ page }) => {
  await mockApi(page);
  await page.goto("/gigs");
  await expect(page.getByRole("heading", { name: "Auftritte", exact: true })).toBeVisible();
  await page.getByRole("button", { name: `${gig.title} ändern` }).click();
  const formular = page.locator(".auftritt-zeile form.auftritt-formular");
  await expect(formular).toBeVisible();

  for (const breite of breiten) {
    await page.setViewportSize({ width: breite, height: 900 });
    expect.soft(await abstaende(formular, "Auftritt-Formular"), `Auftritt bei ${breite}px`).toEqual([]);
  }
});

test("Bühnensteuerung hält auch beim Umbruch Abstand", async ({ page }) => {
  await mockApi(page);
  await page.goto("/stage/1/1");
  await expect(page.locator(".buehne-fuss")).toBeVisible();
  for (const breite of breiten) {
    await page.setViewportSize({ width: breite, height: 900 });
    for (const gruppe of [".buehne-fuss", ".buehne-aktionen", ".buehne-uebersicht"]) {
      expect.soft(await abstaende(page.locator(gruppe), gruppe), `Bühne bei ${breite}px`).toEqual([]);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(breite + 1);
  }
});
