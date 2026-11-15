/**
 * HTTP- und Browser-Smoke für Anmerkungen (R12). Nutzt die Sitzungen aus
 * verify-kern.mjs. Fehlende Browser sind ein Fehler, kein Skip.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { pdfBytes } from "./pdf.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function anlage(werte = {}) {
  return {
    uuid: randomUUID(),
    page_number: 1,
    kind: "text",
    visibility: "private",
    geometry: { x: 0.1, y: 0.1, width: 0.2, height: 0.05 },
    color: "gelb",
    text: "Leiser spielen",
    font_size: 0.0225,
    ...werte,
  };
}

async function browserPruefen({
  basis,
  bandId,
  songId,
  ersteVersionId,
  zweiteVersionId,
  benutzer,
  passwort,
}) {
  const frontend = path.join(root, "frontend");
  if (!fs.existsSync(path.join(frontend, "node_modules", "@playwright", "test"))) {
    throw new Error("Playwright fehlt. Im Frontend npm ci ausführen.");
  }
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const lauf = spawnSync(
    npx,
    ["playwright", "test", "e2e/annotations.spec.ts", "--reporter=line"],
    {
      cwd: frontend,
      env: {
        ...process.env,
        E2E_BASIS: basis,
        E2E_BENUTZER: benutzer,
        E2E_PASSWORT: passwort,
        E2E_BAND_ID: String(bandId),
        E2E_SONG_ID: String(songId),
        E2E_VERSION_1: String(ersteVersionId),
        E2E_VERSION_2: String(zweiteVersionId),
      },
      encoding: "utf8",
      timeout: 300_000,
    },
  );
  if ((lauf.status ?? 1) !== 0) {
    throw new Error(`Browser-Smoke Anmerkungen rot:\n${lauf.stdout || ""}${lauf.stderr || ""}`);
  }
}

export async function pruefeAnmerkungen({
  erste,
  zweite,
  bandId,
  pruefe,
  basis,
  benutzer,
  passwort,
}) {
  const songs = `/api/bands/${bandId}/songs/`;
  const song = await erste.ruf(songs, {
    methode: "POST",
    koerper: { title: "Anmerkungs-Smoke" },
  });
  pruefe(song.status === 201, "Anmerkungs-Testsong anlegen scheitert");
  const songId = song.daten.id;
  const uploadPfad = `/api/bands/${bandId}/songs/${songId}/document/versions/`;
  const version = await erste.datei(uploadPfad, pdfBytes(), { uploadId: randomUUID() });
  pruefe(version.status === 201, "PDF für Anmerkungen hochladen scheitert");
  const versionId = version.daten.id;
  const anmerkungen = `/api/bands/${bandId}/songs/${songId}/document/versions/${versionId}/annotations/`;
  const detail = (id) => `${anmerkungen}${id}/`;

  const angelegt = await erste.ruf(anmerkungen, {
    methode: "POST",
    koerper: anlage(),
  });
  pruefe(angelegt.status === 201, "Anmerkung anlegen scheitert");
  pruefe(angelegt.daten?.can_edit === true && angelegt.daten?.can_delete === true, "Autorrechte fehlen");
  const annotationId = angelegt.daten.id;

  pruefe((await zweite.ruf(anmerkungen)).status === 404, "Fremde Band sieht Anmerkungen");
  pruefe((await zweite.ruf(detail(annotationId))).status === 404, "Fremde persönliche ID ist sichtbar");

  const geteilt = await erste.ruf(detail(annotationId), {
    methode: "PATCH",
    koerper: { revision: 0, visibility: "band", text: "Geteilter Text" },
  });
  pruefe(geteilt.status === 200, "Teilen antwortet nicht 200");
  pruefe(geteilt.daten?.visibility === "band" && geteilt.daten?.revision === 1, "Teilen scheitert");
  pruefe((await zweite.ruf(anmerkungen)).status === 404, "Nichtmitglied sieht bandweite Anmerkung");

  const konflikt = await erste.ruf(detail(annotationId), {
    methode: "PATCH",
    koerper: { revision: 0, text: "Veraltet" },
  });
  pruefe(konflikt.status === 409, "Veraltete Revision ist nicht 409");
  const ohneRevision = await erste.ruf(detail(annotationId), {
    methode: "PATCH",
    koerper: { text: "Ohne Revision" },
  });
  pruefe(ohneRevision.status === 400, "PATCH ohne Revision ist nicht 400");
  pruefe(
    (await erste.ruf(detail(annotationId), { methode: "DELETE" })).status === 400,
    "DELETE ohne Revision ist nicht 400",
  );
  pruefe(
    (await erste.ruf(`${detail(annotationId)}?revision=0`, { methode: "DELETE" })).status === 409,
    "DELETE mit alter Revision ist nicht 409",
  );

  const kennung = randomUUID();
  const erst = await erste.ruf(anmerkungen, {
    methode: "POST",
    koerper: anlage({ uuid: kennung, text: "UUID-Text" }),
  });
  const gleich = await erste.ruf(anmerkungen, {
    methode: "POST",
    koerper: anlage({ uuid: kennung, text: "UUID-Text" }),
  });
  const anders = await erste.ruf(anmerkungen, {
    methode: "POST",
    koerper: anlage({ uuid: kennung, text: "Anderer Text" }),
  });
  pruefe(erst.status === 201 && gleich.status === 200, "UUID-Wiederholung ist nicht idempotent");
  pruefe(anders.status === 409, "Abweichende UUID-Daten sind nicht 409");

  for (const [name, werte] of Object.entries({
    seite: { page_number: 0 },
    geometrie: { geometry: { x: 0.9, y: 0.9, width: 0.3, height: 0.3 } },
    markertext: { kind: "marker", text: "Text", font_size: null },
    schrift: { font_size: 0.02 },
    farbe: { color: "rot" },
    autor: { author: 1 },
    version: { document_version: 1 },
    leer: { text: "   " },
  })) {
    const antwort = await erste.ruf(anmerkungen, { methode: "POST", koerper: anlage(werte) });
    pruefe(antwort.status === 400, `Ungültige Anlage ${name} ist nicht 400`);
  }
  const grenze = await erste.ruf(anmerkungen, {
    methode: "POST",
    koerper: anlage({ text: "x".repeat(2000), geometry: { x: 0, y: 0, width: 1, height: 1 } }),
  });
  pruefe(grenze.status === 201, "Grenzwerte für Text und Geometrie werden abgelehnt");
  const zuLang = await erste.ruf(anmerkungen, {
    methode: "POST",
    koerper: anlage({ text: "x".repeat(2001) }),
  });
  pruefe(zuLang.status === 400, "2.001 Zeichen werden akzeptiert");

  const zweiteVersion = await erste.datei(uploadPfad, pdfBytes({ seiten: [{ width: 400, height: 600 }] }), {
    uploadId: randomUUID(),
  });
  const neueVersionAnmerkungen = `/api/bands/${bandId}/songs/${songId}/document/versions/${zweiteVersion.daten.id}/annotations/`;
  pruefe(
    (await erste.ruf(neueVersionAnmerkungen)).daten?.length === 0,
    "Neue PDF-Version übernimmt Anmerkungen",
  );

  const banddetail = await erste.ruf(`/api/bands/${bandId}/`);
  pruefe(
    !JSON.stringify(banddetail.daten).includes("Leiser spielen"),
    "Banddetail enthält Anmerkungstext",
  );

  const browserSong = await erste.ruf(songs, {
    methode: "POST",
    koerper: { title: "Anmerkungs-Browser" },
  });
  const browserUpload = `/api/bands/${bandId}/songs/${browserSong.daten.id}/document/versions/`;
  const v1 = await erste.datei(browserUpload, pdfBytes(), { uploadId: randomUUID() });
  const v2 = await erste.datei(browserUpload, pdfBytes({ seiten: [{ width: 400, height: 600 }] }), {
    uploadId: randomUUID(),
  });
  pruefe(v1.status === 201 && v2.status === 201, "Browser-Versionen anlegen scheitert");

  await browserPruefen({
    basis,
    bandId,
    songId: browserSong.daten.id,
    ersteVersionId: v1.daten.id,
    zweiteVersionId: v2.daten.id,
    benutzer,
    passwort,
  });
}
