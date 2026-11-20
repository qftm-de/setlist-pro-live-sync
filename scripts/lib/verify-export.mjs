/**
 * HTTP-Smoke für den Bandexport (R16). Prüft ZIP-Inhalt, Manifest und
 * PDF-Bytes über nginx. Nutzt die angemeldeten Sitzungen aus verify-kern.mjs.
 */
import { randomUUID } from "node:crypto";
import zlib from "node:zlib";

import { pdfBytes } from "./pdf.mjs";
import { Sitzung } from "./verify-session.mjs";

function eocdPosition(puffer) {
  const unten = Math.max(0, puffer.length - 65557);
  for (let pos = puffer.length - 22; pos >= unten; pos -= 1) {
    if (puffer.readUInt32LE(pos) === 0x06054b50) {
      return pos;
    }
  }
  throw new Error("ZIP-Zentralverzeichnis fehlt.");
}

function leseZip(puffer) {
  const start = puffer.readUInt32LE(eocdPosition(puffer) + 16);
  const anzahl = puffer.readUInt16LE(eocdPosition(puffer) + 10);
  const dateien = new Map();
  let pos = start;
  for (let index = 0; index < anzahl; index += 1) {
    if (puffer.readUInt32LE(pos) !== 0x02014b50) {
      throw new Error("ZIP-Eintrag ist beschädigt.");
    }
    const methode = puffer.readUInt16LE(pos + 10);
    const groesse = puffer.readUInt32LE(pos + 20);
    const nameLaenge = puffer.readUInt16LE(pos + 28);
    const extraLaenge = puffer.readUInt16LE(pos + 30);
    const kommentarLaenge = puffer.readUInt16LE(pos + 32);
    const lokal = puffer.readUInt32LE(pos + 42);
    const name = puffer.toString("utf8", pos + 46, pos + 46 + nameLaenge);
    const lokalName = puffer.readUInt16LE(lokal + 26);
    const lokalExtra = puffer.readUInt16LE(lokal + 28);
    const datenStart = lokal + 30 + lokalName + lokalExtra;
    const roh = puffer.subarray(datenStart, datenStart + groesse);
    dateien.set(name, methode === 0 ? roh : zlib.inflateRawSync(roh));
    pos += 46 + nameLaenge + extraLaenge + kommentarLaenge;
  }
  return dateien;
}

function anlage(versionId, sichtbarkeit, text) {
  return {
    uuid: randomUUID(),
    page_number: 1,
    kind: "text",
    visibility: sichtbarkeit,
    geometry: { x: 0.1, y: 0.1, width: 0.2, height: 0.05 },
    color: "gelb",
    text,
    font_size: 0.0225,
  };
}

export async function pruefeExport({ erste, zweite, bandId, basis, pruefe }) {
  const exportPfad = `/api/bands/${bandId}/export/`;
  pruefe((await new Sitzung(basis).ruf(exportPfad)).status === 401, "Export ohne Anmeldung ist nicht 401");
  pruefe((await zweite.ruf(exportPfad)).status === 404, "Fremde Band exportiert");

  const songs = `/api/bands/${bandId}/songs/`;
  const song = await erste.ruf(songs, {
    methode: "POST",
    koerper: { title: "Export-Smoke" },
  });
  pruefe(song.status === 201, "Export-Testsong anlegen scheitert");
  const songId = song.daten.id;
  const uploadPfad = `/api/bands/${bandId}/songs/${songId}/document/versions/`;
  const erstePdf = pdfBytes({ seiten: [{ width: 595, height: 842 }] });
  const zweitePdf = pdfBytes({ seiten: [{ width: 595, height: 842 }, { width: 595, height: 842 }] });
  const version1 = await erste.datei(uploadPfad, erstePdf, { uploadId: randomUUID() });
  const version2 = await erste.datei(uploadPfad, zweitePdf, { uploadId: randomUUID() });
  pruefe(version1.status === 201 && version2.status === 201, "PDF für den Export hochladen scheitert");

  const setlist = await erste.ruf(`/api/bands/${bandId}/setlists/`, {
    methode: "POST",
    koerper: { name: "Export-Set" },
  });
  pruefe(setlist.status === 201, "Export-Setlist anlegen scheitert");
  const setlistId = setlist.daten.id;
  const inhalt = await erste.ruf(`/api/bands/${bandId}/setlists/${setlistId}/content/`, {
    methode: "PUT",
    koerper: {
      revision: setlist.daten.revision,
      sections: [
        {
          name: "Export-Abschnitt",
          kind: "set",
          entries: [{ entry_type: "song", song_id: songId }],
        },
      ],
    },
  });
  pruefe(inhalt.status === 200, "Export-Setlist speichern scheitert");

  const gig = await erste.ruf(`/api/bands/${bandId}/gigs/`, {
    methode: "POST",
    koerper: {
      title: "Export-Auftritt",
      date: "2099-01-02",
      setlist_id: setlistId,
    },
  });
  pruefe(gig.status === 201, "Export-Auftritt anlegen scheitert");

  const anmerkungen = `/api/bands/${bandId}/songs/${songId}/document/versions/${version1.daten.id}/annotations/`;
  const privat = await erste.ruf(anmerkungen, {
    methode: "POST",
    koerper: anlage(version1.daten.id, "private", "Export privat"),
  });
  const bandweit = await erste.ruf(anmerkungen, {
    methode: "POST",
    koerper: anlage(version1.daten.id, "band", "Export bandweit"),
  });
  pruefe(privat.status === 201 && bandweit.status === 201, "Anmerkungen für den Export anlegen scheitert");

  const antwort = await erste.roh(exportPfad, {
    kopf: { Accept: "application/zip" },
  });
  pruefe(antwort.status === 200, `Export antwortet nicht 200 (${antwort.status})`);
  pruefe(
    (antwort.headers.get("content-type") || "").startsWith("application/zip"),
    "Export hat keinen ZIP-Typ",
  );
  pruefe(
    (antwort.headers.get("content-disposition") || "").includes("attachment"),
    "Export ist kein Anhang",
  );

  const dateien = leseZip(antwort.bytes);
  pruefe(dateien.has("manifest.json"), "Manifest fehlt im ZIP");
  const manifest = JSON.parse(dateien.get("manifest.json").toString("utf8"));
  pruefe(manifest.band?.id === bandId, "Manifest nennt die falsche Band");

  const exportSong = manifest.songs?.find((eintrag) => eintrag.id === songId);
  pruefe(exportSong, "Manifest enthält den Song nicht");
  pruefe(
    exportSong.document?.versions?.length === 2,
    "Manifest enthält nicht beide PDF-Versionen",
  );
  const pfad1 = `pdfs/${songId}/v001-partitur.pdf`;
  const pfad2 = `pdfs/${songId}/v002-partitur.pdf`;
  pruefe(dateien.has(pfad1) && dateien.has(pfad2), "PDF-Pfade fehlen im ZIP");
  pruefe(Buffer.compare(dateien.get(pfad1), erstePdf) === 0, "Erste PDF weicht im ZIP ab");
  pruefe(Buffer.compare(dateien.get(pfad2), zweitePdf) === 0, "Zweite PDF weicht im ZIP ab");

  const exportSetlist = manifest.setlists?.find((eintrag) => eintrag.id === setlistId);
  pruefe(exportSetlist?.text?.name === "Export-Set", "Setlist fehlt im Manifest");
  pruefe(
    exportSetlist.sections?.[0]?.entries?.[0]?.song_id === songId,
    "Setlist-Eintrag fehlt im Manifest",
  );
  pruefe(
    manifest.gigs?.some((eintrag) => eintrag.title === "Export-Auftritt"),
    "Auftritt fehlt im Manifest",
  );
  const exportAnmerkungen = manifest.annotations || [];
  pruefe(
    exportAnmerkungen.some((eintrag) => eintrag.uuid === privat.daten?.uuid),
    "Eigene persönliche Anmerkung fehlt im Export",
  );
  pruefe(
    exportAnmerkungen.some((eintrag) => eintrag.uuid === bandweit.daten?.uuid),
    "Bandweite Anmerkung fehlt im Export",
  );
  return { songId, setlistId, versionId: version1.daten.id };
}
