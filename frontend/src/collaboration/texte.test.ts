import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  base64AusBytes,
  bytesAusBase64,
  deltaUpdate,
  dokumentAusStand,
  setzeText,
  textAusDokument,
  wendeUpdateAn,
  zustandsVektor,
} from "./texte";

describe("CRDT-Texte", () => {
  it("kodiert Zustände verlustfrei als base64", () => {
    const roh = new Uint8Array([0, 1, 2, 250, 255]);
    expect(bytesAusBase64(base64AusBytes(roh))).toEqual(roh);
  });

  it("setzt Text mit minimalem Unterschied", () => {
    const doc = dokumentAusStand(null, "Hallo");
    setzeText(doc, "Hallo Welt");
    expect(textAusDokument(doc)).toBe("Hallo Welt");
    setzeText(doc, "Hallo");
    expect(textAusDokument(doc)).toBe("Hallo");
  });

  it("führt gleichzeitige Änderungen derselben Epoche zusammen", () => {
    const basis = new Y.Doc();
    basis.getText("t").insert(0, "Text");
    const voll = Y.encodeStateAsUpdate(basis);
    const sv = zustandsVektor(basis);
    const kopie = () => {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, voll);
      return doc;
    };

    const links = kopie();
    links.clientID = 1001;
    links.getText("t").insert(0, "Links ");
    const rechts = kopie();
    rechts.clientID = 2002;
    rechts.getText("t").insert(4, " Rechts");

    const ziel = kopie();
    wendeUpdateAn(ziel, base64AusBytes(deltaUpdate(links, sv)));
    wendeUpdateAn(ziel, base64AusBytes(deltaUpdate(rechts, sv)));
    const text = textAusDokument(ziel);
    expect(text).toContain("Links");
    expect(text).toContain("Rechts");
    expect(text).toContain("Text");
  });
});
