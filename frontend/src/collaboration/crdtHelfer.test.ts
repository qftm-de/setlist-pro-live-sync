import * as Y from "yjs";
import { describe, expect, it } from "vitest";

import { hatLokaleAenderungen } from "./crdtHelfer";

function text(doc: Y.Doc): Y.Text {
  return doc.getText("t");
}

describe("hatLokaleAenderungen", () => {
  it("meldet keinen Unterschied, wenn der bestätigte Stand aktuell ist", () => {
    const doc = new Y.Doc();
    text(doc).insert(0, "Hallo");

    expect(hatLokaleAenderungen(doc, Y.encodeStateAsUpdate(doc))).toBe(false);
  });

  it("meldet lokale Änderungen nach dem bestätigten Stand", () => {
    const doc = new Y.Doc();
    text(doc).insert(0, "Hallo");
    const bestaetigt = Y.encodeStateAsUpdate(doc);
    text(doc).insert(5, " Welt");

    expect(hatLokaleAenderungen(doc, bestaetigt)).toBe(true);
  });

  it("meldet keinen Unterschied, wenn der bestätigte Stand die Änderung schon trägt", () => {
    const fern = new Y.Doc();
    text(fern).insert(0, "Hallo");
    const doc = new Y.Doc();
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(fern));

    expect(
      hatLokaleAenderungen(doc, Y.encodeStateAsUpdate(fern)),
    ).toBe(false);
  });
});
