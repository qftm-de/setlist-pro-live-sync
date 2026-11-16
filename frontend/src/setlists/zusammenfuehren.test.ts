import { describe, expect, it } from "vitest";
import { bloeckeZusammenfuehren, mergeBasis } from "./zusammenfuehren";
import type { Block } from "./inhalt";

function zeile(schluessel: string, uuid: string | undefined, titel: string) {
  return { schluessel, uuid, art: "notiz" as const, titel };
}

function block(name: string, zeilen: ReturnType<typeof zeile>[]): Block {
  return { schluessel: "a1", uuid: "a1", name, kind: "set", zeilen };
}

const server = [block("Set", [zeile("e1", "e1", "alt"), zeile("e2", "e2", "fremd")])];
const lokal = [block("Set neu", [zeile("e1", "e1", "eigene"), zeile("neu", undefined, "neu")])];

describe("Setlist-Zusammenführung", () => {
  it("behält ohne Basis fremde Einträge und ergänzt eigene", () => {
    const gemischt = bloeckeZusammenfuehren(server, lokal);
    expect(gemischt[0].name).toBe("Set neu");
    expect(gemischt[0].zeilen.map((eintrag) => eintrag.titel)).toEqual([
      "eigene",
      "fremd",
      "neu",
    ]);
  });

  it("holt lokal gelöschte Einträge nicht zurück", () => {
    const gemischt = bloeckeZusammenfuehren(server, lokal, mergeBasis(server));
    expect(gemischt[0].zeilen.map((eintrag) => eintrag.titel)).toEqual([
      "eigene",
      "neu",
    ]);
  });

  it("lässt serverseitig gelöschte Einträge entfallen", () => {
    const basis = mergeBasis(server);
    const ohneE2 = [block("Set", [zeile("e1", "e1", "alt")])];
    const gemischt = bloeckeZusammenfuehren(ohneE2, server, basis);
    expect(gemischt[0].zeilen.map((eintrag) => eintrag.titel)).toEqual([
      "alt",
    ]);
  });
});
