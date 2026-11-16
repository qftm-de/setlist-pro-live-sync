import * as Y from "yjs";

export function docAusUpdate(update: Uint8Array): Y.Doc {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, update);
  return doc;
}

/** Vergleicht den vollen lokalen Stand mit dem bestätigten Serverstand. */
export function hatLokaleAenderungen(
  doc: Y.Doc,
  bestaetigt: Uint8Array | null,
): boolean {
  if (!bestaetigt) {
    return true;
  }
  const aktuell = Y.encodeStateAsUpdate(doc);
  if (aktuell.length !== bestaetigt.length) {
    return true;
  }
  for (let index = 0; index < aktuell.length; index += 1) {
    if (aktuell[index] !== bestaetigt[index]) {
      return true;
    }
  }
  return false;
}
