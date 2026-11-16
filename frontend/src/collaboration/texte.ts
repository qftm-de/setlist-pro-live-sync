import * as Y from "yjs";

export interface TextStand {
  object_type: "setlist" | "section" | "entry" | "annotation";
  object_uuid: string;
  field: "name" | "label" | "text";
  epoch: number;
  revision: number;
  state: string;
}

export interface TextAntwort {
  text: string;
  epoch: number;
  revision: number;
  update: string;
}

export function bytesAusBase64(wert: string): Uint8Array {
  const roh = atob(wert);
  const bytes = new Uint8Array(roh.length);
  for (let i = 0; i < roh.length; i += 1) {
    bytes[i] = roh.charCodeAt(i);
  }
  return bytes;
}

export function base64AusBytes(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) {
    text += String.fromCharCode(byte);
  }
  return btoa(text);
}

export function dokumentAusStand(stand?: TextStand | null, wert = ""): Y.Doc {
  const doc = new Y.Doc();
  if (stand?.state) {
    try {
      Y.applyUpdate(doc, bytesAusBase64(stand.state));
    } catch {
      doc.getText("t").insert(0, wert);
    }
  } else {
    doc.getText("t").insert(0, wert);
  }
  return doc;
}

export function textAusDokument(doc: Y.Doc): string {
  return doc.getText("t").toString();
}

/** Setzt den Text mit einem minimalen Unterschied. Erhält fremde Änderungen. */
export function setzeText(doc: Y.Doc, neu: string): void {
  const text = doc.getText("t");
  const alt = text.toString();
  if (alt === neu) {
    return;
  }
  let start = 0;
  const kurz = Math.min(alt.length, neu.length);
  while (start < kurz && alt[start] === neu[start]) {
    start += 1;
  }
  let endeAlt = alt.length;
  let endeNeu = neu.length;
  while (
    endeAlt > start &&
    endeNeu > start &&
    alt[endeAlt - 1] === neu[endeNeu - 1]
  ) {
    endeAlt -= 1;
    endeNeu -= 1;
  }
  if (endeAlt > start) {
    text.delete(start, endeAlt - start);
  }
  if (endeNeu > start) {
    text.insert(start, neu.slice(start, endeNeu));
  }
}

export function deltaUpdate(doc: Y.Doc, stand: Uint8Array): Uint8Array {
  return Y.encodeStateAsUpdate(doc, stand);
}

export function zustandsVektor(doc: Y.Doc): Uint8Array {
  return Y.encodeStateVector(doc);
}

export function wendeUpdateAn(doc: Y.Doc, update: string): void {
  Y.applyUpdate(doc, bytesAusBase64(update));
}

export function textSchluessel(typ: string, uuid: string, feld: string): string {
  return `${typ}:${uuid}:${feld}`;
}

export interface TextEreignis {
  object_uuid: string;
  field: string;
  update: string;
  epoch: number;
}
