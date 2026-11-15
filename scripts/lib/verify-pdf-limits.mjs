/** Prüft aktive und deaktivierte PDF-Limits über nginx und API. */
import { randomUUID } from "node:crypto";

import { pdfBytes, pdfBytesMitGroesse } from "./pdf.mjs";

async function songAnlegen(erste, bandId, titel) {
  const antwort = await erste.ruf(`/api/bands/${bandId}/songs/`, {
    methode: "POST",
    koerper: { title: titel },
  });
  if (antwort.status !== 201) {
    throw new Error(`${titel} anlegen scheitert`);
  }
  return antwort.daten.id;
}

export async function pruefeAktivesLimit({
  erste,
  bandId,
  pruefe,
  starteStack,
}) {
  const grenze = 262144;
  starteStack({ PDF_MAX_UPLOAD_BYTES: String(grenze), PDF_MAX_PAGES: "0" });
  const songId = await songAnlegen(erste, bandId, "PDF-Grenze");
  const pfad = `/api/bands/${bandId}/songs/${songId}/document/versions/`;

  const genau = pdfBytesMitGroesse(grenze);
  const amLimit = await erste.datei(pfad, genau, { uploadId: randomUUID() });
  pruefe(
    amLimit.status === 201 && amLimit.daten?.byte_size === grenze,
    "Datei exakt am Limit erreicht die API nicht",
  );

  const einsMehr = pdfBytesMitGroesse(grenze + 1);
  const ueberApi = await erste.datei(pfad, einsMehr, { uploadId: randomUUID() });
  pruefe(
    ueberApi.status === 413 && ueberApi.daten?.detail === "Die Datei ist zu groß.",
    "API lehnt ein Byte über dem Limit nicht mit 413 ab",
  );

  const formular = new FormData();
  formular.set(
    "file",
    new Blob([Buffer.alloc(grenze + 65536 + 1, 0x25)], {
      type: "application/pdf",
    }),
    "proxy-zu-gross.pdf",
  );
  formular.set("upload_id", randomUUID());
  const ueberProxy = await erste.roh(pfad, { methode: "POST", koerper: formular });
  pruefe(
    ueberProxy.status === 413 &&
      !(ueberProxy.headers.get("content-type") || "").includes("application/json"),
    "Proxy lehnt Limit plus 65.537 Byte nicht mit 413 ab",
  );
}

export async function pruefeOhneLimit({ erste, bandId, pruefe, starteStack }) {
  starteStack();
  const songId = await songAnlegen(erste, bandId, "PDF-ohne-Limit");
  const grossePdf = pdfBytes({
    seiten: Array.from({ length: 120 }, () => ({
      width: 595,
      height: 842,
      rotate: 0,
    })),
    fuellung: 200000,
  });
  const antwort = await erste.datei(
    `/api/bands/${bandId}/songs/${songId}/document/versions/`,
    grossePdf,
    { uploadId: randomUUID(), name: "ohne-limit.pdf" },
  );
  pruefe(
    antwort.status === 201 && antwort.daten?.byte_size > 20 * 1024 * 1024,
    "Limit 0 lässt großen Upload nicht durch beide Schichten",
  );
}
