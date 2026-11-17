import * as Y from "yjs";

export function docAusUpdate(update: Uint8Array): Y.Doc {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, update);
  return doc;
}

/**
 * Prüft, ob das Dokument Text enthält, den der bestätigte Stand nicht kennt.
 * Verglichen wird der Inhalt, nicht kodierte Bytes: yjs im Browser und Yrs auf
 * dem Server dürfen dasselbe Dokument unterschiedlich kodieren, und gleicher
 * Inhalt darf keinen weiteren Sendevorgang auslösen.
 */
export function hatLokaleAenderungen(
  doc: Y.Doc,
  bestaetigt: Uint8Array | null,
): boolean {
  if (!bestaetigt) {
    return true;
  }
  const bestaetigtText = docAusUpdate(bestaetigt).getText("t").toString();
  return doc.getText("t").toString() !== bestaetigtText;
}
