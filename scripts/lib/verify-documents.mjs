/**
 * HTTP- und Browser-Smoke für Song-PDFs (R11). Nutzt die Sitzungen aus
 * verify-kern.mjs. Fehlende Browser sind ein Fehler, kein Skip.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { pdfBytes } from "./pdf.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function browserPruefen({ basis, bandId, songId, zweiteBandId, benutzer, passwort }) {
  const frontend = path.join(root, "frontend");
  if (!fs.existsSync(path.join(frontend, "node_modules", "@playwright", "test"))) {
    throw new Error("Playwright fehlt. Im Frontend npm ci und npx playwright install chromium ausführen.");
  }
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const lauf = spawnSync(
    npx,
    ["playwright", "test", "e2e/documents.spec.ts", "--reporter=line"],
    {
      cwd: frontend,
      env: {
        ...process.env,
        E2E_BASIS: basis,
        E2E_BENUTZER: benutzer,
        E2E_PASSWORT: passwort,
        E2E_BAND_ID: String(bandId),
        E2E_ZWEITE_BAND_ID: String(zweiteBandId),
        E2E_SONG_ID: String(songId),
      },
      encoding: "utf8",
      timeout: 300_000,
    },
  );
  if ((lauf.status ?? 1) !== 0) {
    throw new Error(`Browser-Smoke rot:\n${lauf.stdout || ""}${lauf.stderr || ""}`);
  }
}

export async function pruefeDokumente({
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
    koerper: { title: "PDF-Smoke" },
  });
  pruefe(song.status === 201, "PDF-Testsong anlegen scheitert");
  const songId = song.daten.id;
  const basisPfad = `/api/bands/${bandId}/songs/${songId}/document/`;
  const uploadPfad = `${basisPfad}versions/`;

  const pdf = pdfBytes();
  const uploadId = randomUUID();
  const ersteVersion = await erste.datei(uploadPfad, pdf, { uploadId });
  pruefe(ersteVersion.status === 201, "PDF-Upload scheitert");
  pruefe(ersteVersion.daten?.number === 1, "Erste Version hat nicht Nummer 1");

  const wiederholt = await erste.datei(uploadPfad, pdf, { uploadId });
  pruefe(
    wiederholt.status === 200 && wiederholt.daten?.id === ersteVersion.daten.id,
    "Gleiche Upload-UUID liefert nicht dieselbe Version",
  );
  const abweichend = await erste.datei(uploadPfad, pdfBytes({ seiten: [{ width: 300, height: 400 }] }), {
    uploadId,
  });
  pruefe(abweichend.status === 409, "Gleiche UUID mit anderen Bytes ist nicht 409");

  const leer = await erste.ruf(basisPfad);
  pruefe(leer.status === 200 && leer.daten?.active_version_id === null, "Erster Upload aktiviert die Version still");
  pruefe(leer.daten?.versions?.length === 1, "Doppelte UUID erzeugt eine zweite Version");
  pruefe(typeof leer.daten?.limits?.max_pages === "number", "Dokumentmetadaten nennen die Grenzen nicht");
  pruefe(!JSON.stringify(leer.daten).includes("file_key"), "Metadaten nennen den Dateischlüssel");

  const aktiviert = await erste.ruf(basisPfad, {
    methode: "PATCH",
    koerper: { revision: 0, active_version_id: ersteVersion.daten.id },
  });
  pruefe(
    aktiviert.status === 200 && aktiviert.daten?.active_version_id === ersteVersion.daten.id,
    "Aktivierung scheitert",
  );
  pruefe(
    (await erste.ruf(basisPfad, {
      methode: "PATCH",
      koerper: { revision: 0, active_version_id: ersteVersion.daten.id },
    })).status === 409,
    "Veraltete Revision wird nicht abgelehnt",
  );
  pruefe(
    (await erste.ruf(basisPfad, { methode: "PATCH", koerper: { active_version_id: ersteVersion.daten.id } }))
      .status === 400,
    "Aktivierung ohne Revision ist nicht 400",
  );

  const zweiteVersion = await erste.datei(uploadPfad, pdfBytes({ seiten: [{ width: 400, height: 500 }] }), {
    uploadId: randomUUID(),
  });
  pruefe(zweiteVersion.status === 201 && zweiteVersion.daten?.number === 2, "Zweiter Upload scheitert");
  pruefe(
    (await erste.ruf(basisPfad)).daten?.active_version_id === ersteVersion.daten.id,
    "Weiterer Upload ändert die aktive Auswahl",
  );

  const abgleich = await erste.ruf(`${uploadPfad}?upload_id=${uploadId}`);
  pruefe(
    abgleich.status === 200 &&
      abgleich.daten?.length === 1 &&
      abgleich.daten[0].id === ersteVersion.daten.id,
    "Upload-Abgleich findet die Version nicht",
  );

  const dateiPfad = `${uploadPfad}${ersteVersion.daten.id}/file/`;
  const voll = await erste.roh(dateiPfad);
  pruefe(voll.status === 200 && Buffer.compare(voll.bytes, pdf) === 0, "Originalbytes weichen ab");
  pruefe(voll.headers.get("content-type") === "application/pdf", "Datei ist nicht application/pdf");
  pruefe(
    (voll.headers.get("x-content-type-options") || "").includes("nosniff"),
    "nosniff fehlt",
  );
  pruefe(voll.headers.get("cache-control") === "private, no-store", "Cache-Control fehlt");
  pruefe(voll.headers.get("accept-ranges") === "bytes", "Accept-Ranges fehlt");

  const bereich = await erste.roh(dateiPfad, { kopf: { Range: "bytes=10-49" } });
  pruefe(
    bereich.status === 206 &&
      Buffer.compare(bereich.bytes, pdf.subarray(10, 50)) === 0 &&
      bereich.headers.get("content-range") === `bytes 10-49/${pdf.length}`,
    "Geschlossener Byte-Bereich ist falsch",
  );
  const suffix = await erste.roh(dateiPfad, { kopf: { Range: "bytes=-20" } });
  pruefe(
    suffix.status === 206 && Buffer.compare(suffix.bytes, pdf.subarray(pdf.length - 20)) === 0,
    "Suffix-Bereich ist falsch",
  );
  const offen = await erste.roh(dateiPfad, { kopf: { Range: "bytes=100-" } });
  pruefe(
    offen.status === 206 && Buffer.compare(offen.bytes, pdf.subarray(100)) === 0,
    "Offener Byte-Bereich ist falsch",
  );
  for (const kopf of ["bytes=99999999-", "bytes=0-1,3-4", "bytes=abc"]) {
    const fehler = await erste.roh(dateiPfad, { kopf: { Range: kopf } });
    pruefe(
      fehler.status === 416 &&
        fehler.headers.get("content-range") === `bytes */${pdf.length}`,
      `Ungültiger Bereich ${kopf} ist nicht 416`,
    );
  }

  const download = await erste.roh(`${dateiPfad}?download=1`);
  pruefe(
    download.headers.get("content-disposition")?.includes("attachment") === true,
    "Download ist kein Attachment",
  );

  pruefe((await zweite.roh(dateiPfad)).status === 404, "Fremdes Konto liest die Datei");
  pruefe(
    (await zweite.ruf(basisPfad)).status === 404,
    "Fremdes Konto liest Dokumentmetadaten",
  );
  pruefe(
    (await fetch(`${basis}${dateiPfad}`, { redirect: "manual" })).status === 401,
    "Anonymer Dateizugriff ist nicht 401",
  );
  const ohneTokenFormular = new FormData();
  ohneTokenFormular.set("upload_id", randomUUID());
  const ohneToken = await erste.roh(uploadPfad, {
    methode: "POST",
    koerper: ohneTokenFormular,
  });
  pruefe(ohneToken.status === 403, `Upload ohne CSRF-Token ist nicht 403 (${ohneToken.status})`);

  const ungueltig = await erste.datei(uploadPfad, Buffer.from("keine pdf"), {
    uploadId: randomUUID(),
  });
  pruefe(ungueltig.status === 400, "Ungültige Datei wird akzeptiert");
  pruefe(
    (await erste.ruf(basisPfad)).daten?.versions?.length === 2,
    "Abgelehnter Upload hinterlässt eine Version",
  );

  const loeschversuch = await erste.ruf(`${songs}${songId}/`, { methode: "DELETE" });
  pruefe(
    loeschversuch.status === 400 &&
      loeschversuch.daten?.detail ===
        "Song hat PDF-Versionen und kann nicht gelöscht werden.",
    "Song mit PDF lässt sich löschen oder Meldung fehlt",
  );
  pruefe((await erste.ruf(`${songs}${songId}/`)).status === 200, "Song fehlt nach abgewiesener Löschung");

  const browserSong = await erste.ruf(songs, {
    methode: "POST",
    koerper: { title: "PDF-Browser" },
  });
  pruefe(browserSong.status === 201, "Browser-Testsong anlegen scheitert");
  const zweiteBand = await erste.ruf("/api/bands/", {
    methode: "POST",
    koerper: { name: "Zweite PDF-Band" },
  });
  pruefe(zweiteBand.status === 201, "Zweite Testband anlegen scheitert");

  await browserPruefen({
    basis,
    bandId,
    songId: browserSong.daten.id,
    zweiteBandId: zweiteBand.daten.id,
    benutzer,
    passwort,
  });
}
