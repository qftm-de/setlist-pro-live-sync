import type { PDFDocumentProxy } from "pdfjs-dist";
import { apiFetchDatei } from "../api/client";

export const VORRAT_GRENZE_BYTES = 128 * 1024 * 1024;

let workerGesetzt = false;

async function pdfjsLaden() {
  const pdfjs = await import("pdfjs-dist");
  if (!workerGesetzt) {
    const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = worker;
    workerGesetzt = true;
  }
  return pdfjs;
}

export async function oeffnePdf(bytes: ArrayBuffer): Promise<PDFDocumentProxy> {
  const pdfjs = await pdfjsLaden();
  const aufgabe = pdfjs.getDocument({
    data: new Uint8Array(bytes.slice(0)),
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdfjs/standard_fonts/",
    wasmUrl: "/pdfjs/wasm/",
  });
  try {
    return await aufgabe.promise;
  } catch (fehler) {
    await aufgabe.destroy().catch(() => undefined);
    throw fehler;
  }
}

export interface VorratStand {
  bereit: boolean;
  vorbereitet: number;
  gesamt: number;
  bytes: number;
  grenze: number;
  unvollstaendig: boolean;
  fehler: string[];
  uebersprungen: number[];
}

export interface VorratQuelle {
  versionId: number;
  byteSize: number;
  url: string;
}

export class PdfVorrat {
  private readonly dokumente = new Map<number, PDFDocumentProxy>();
  private readonly groessen = new Map<number, number>();
  private readonly grenze: number;

  constructor(grenze = VORRAT_GRENZE_BYTES) {
    this.grenze = grenze;
  }

  hat(versionId: number): boolean {
    return this.dokumente.has(versionId);
  }

  get(versionId: number): PDFDocumentProxy | null {
    return this.dokumente.get(versionId) ?? null;
  }

  bytes(): number {
    let summe = 0;
    for (const groesse of this.groessen.values()) {
      summe += groesse;
    }
    return summe;
  }

  async lade(quelle: VorratQuelle): Promise<PDFDocumentProxy> {
    const vorhanden = this.dokumente.get(quelle.versionId);
    if (vorhanden) {
      return vorhanden;
    }
    const bytes = await apiFetchDatei(quelle.url);
    const pdf = await oeffnePdf(bytes);
    this.dokumente.set(quelle.versionId, pdf);
    this.groessen.set(quelle.versionId, bytes.byteLength);
    // Seite 1 vorwärmen. Weitere Seiten holt PDF.js aus dem geladenen Dokument.
    await pdf.getPage(1).catch(() => undefined);
    return pdf;
  }

  async bereiteVor(
    quellen: VorratQuelle[],
    onStand: (stand: VorratStand) => void,
    abgebrochen: () => boolean = () => false,
  ): Promise<VorratStand> {
    const einzigartig = new Map<number, VorratQuelle>();
    for (const quelle of quellen) {
      if (!einzigartig.has(quelle.versionId)) {
        einzigartig.set(quelle.versionId, quelle);
      }
    }
    const fehler: string[] = [];
    const uebersprungen: number[] = [];
    let vorbereitet = 0;
    const stand = (): VorratStand => ({
      bereit:
        !abgebrochen() &&
        vorbereitet === einzigartig.size &&
        fehler.length === 0,
      vorbereitet,
      gesamt: einzigartig.size,
      bytes: this.bytes(),
      grenze: this.grenze,
      unvollstaendig: fehler.length > 0 || uebersprungen.length > 0,
      fehler,
      uebersprungen,
    });

    for (const quelle of einzigartig.values()) {
      if (abgebrochen()) {
        break;
      }
      if (this.hat(quelle.versionId)) {
        vorbereitet += 1;
        onStand(stand());
        continue;
      }
      if (this.bytes() + Math.max(quelle.byteSize, 0) > this.grenze) {
        uebersprungen.push(quelle.versionId);
        onStand(stand());
        continue;
      }
      try {
        await this.lade(quelle);
        vorbereitet += 1;
      } catch {
        fehler.push(
          `PDF-Version ${quelle.versionId} konnte nicht vorbereitet werden.`,
        );
      }
      onStand(stand());
    }
    if (abgebrochen()) {
      onStand({ ...stand(), bereit: false, unvollstaendig: true });
    }
    return stand();
  }

  async gibFrei(): Promise<void> {
    const dokumente = [...this.dokumente.values()];
    this.dokumente.clear();
    this.groessen.clear();
    await Promise.all(
      dokumente.map((dokument) => {
        const zerstoeren = (dokument as { destroy?: () => Promise<void> }).destroy;
        return zerstoeren ? zerstoeren.call(dokument).catch(() => undefined) : undefined;
      }),
    );
  }
}
