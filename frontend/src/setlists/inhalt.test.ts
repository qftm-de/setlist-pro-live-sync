import { describe, expect, it } from "vitest";
import {
  bloeckeAusSetlist,
  eingabeAusBloecken,
  verschiebe,
  type Block,
} from "./inhalt";
import type { Setlist } from "./setlists";

const SETLIST: Setlist = {
  id: 7,
  name: "Hauptset",
  sections: [
    {
      id: 1,
      name: "Set 1",
      kind: "set",
      position: 1,
      entries: [
        {
          id: 11,
          position: 1,
          entry_type: "song",
          song: { id: 3, title: "Abrissbirne" },
          label: "",
          duration_seconds: 210,
        },
        {
          id: 12,
          position: 2,
          entry_type: "pause",
          song: null,
          label: "Pause",
          duration_seconds: null,
        },
      ],
    },
  ],
};

describe("Setlist-Inhalt", () => {
  it("liest Abschnitte und Einträge in Blöcke", () => {
    const bloecke = bloeckeAusSetlist(SETLIST);
    expect(bloecke).toHaveLength(1);
    expect(bloecke[0]).toMatchObject({ name: "Set 1", kind: "set" });
    expect(bloecke[0].zeilen.map((zeile) => zeile.titel)).toEqual([
      "Abrissbirne",
      "Pause",
    ]);
    expect(bloecke[0].zeilen[0].songId).toBe(3);
    expect(bloecke[0].zeilen[0].dauer).toBe(210);
    expect(bloecke[0].zeilen[1].songId).toBeUndefined();
  });

  it("baut aus Blöcken wieder die Eingabe", () => {
    const eingabe = eingabeAusBloecken(bloeckeAusSetlist(SETLIST));
    expect(eingabe).toEqual([
      {
        name: "Set 1",
        kind: "set",
        entries: [
          { entry_type: "song", song_id: 3, duration_seconds: 210 },
          { entry_type: "pause", label: "Pause", duration_seconds: null },
        ],
      },
    ]);
  });

  it("erhält die Reihenfolge beim Verschieben", () => {
    const bloecke: Block[] = bloeckeAusSetlist(SETLIST);
    const zeilen = verschiebe(bloecke[0].zeilen, 1, 0);
    expect(zeilen.map((zeile) => zeile.titel)).toEqual(["Pause", "Abrissbirne"]);
    expect(verschiebe(zeilen, 0, 5)).toBe(zeilen);
    expect(verschiebe(zeilen, 0, 0)).toBe(zeilen);
  });
});
