import { describe, expect, it } from "vitest";
import {
  aktuellesZiel,
  naechsterSongTitel,
  seitenAnzeige,
  songEintraege,
  weiter,
  zurueck,
  zielFuerEintrag,
} from "./navigation";
import type { StageSitzung } from "./stage";

function eintrag(uuid: string, typ: "song" | "pause", seiten: number | null, titel: string) {
  return {
    uuid,
    position: 1,
    entry_type: typ,
    label: titel,
    song:
      typ === "song"
        ? { id: 1, title: titel, artist: "", key: "", bpm: null, notes: "" }
        : null,
    document: seiten
      ? { version_id: 1, page_count: seiten, byte_size: 100, sha256: "x" }
      : null,
  };
}

const sitzung: StageSitzung = {
  id: 1,
  band_id: 1,
  state: "active",
  generation: 1,
  revision: 0,
  leader_user_id: 1,
  leader_connection_active: true,
  last_number: 0,
  current: { entry_uuid: "a1", page: 1 },
  started_at: null,
  ended_at: null,
  actions: {
    can_control: true,
    can_handover: true,
    can_takeover: false,
    can_resume: false,
    can_end: true,
  },
  sections: [
    {
      uuid: "s1",
      name: "Set",
      kind: "set",
      position: 1,
      entries: [
        eintrag("a1", "song", 3, "A"),
        eintrag("p1", "pause", null, "Ansage"),
        eintrag("b1", "song", null, "B"),
        eintrag("a2", "song", 3, "A"),
      ],
    },
  ],
  members: [],
};

describe("Bühnennavigation", () => {
  it("blättert durch Seiten und Songs ohne Umlauf", () => {
    expect(songEintraege(sitzung).map((eintrag) => eintrag.uuid)).toEqual([
      "a1",
      "b1",
      "a2",
    ]);
    expect(aktuellesZiel(sitzung)).toEqual({ entryUuid: "a1", page: 1 });

    const a2 = weiter(sitzung, { entryUuid: "a1", page: 1 });
    expect(a2).toEqual({ entryUuid: "a1", page: 2 });
    const a3 = weiter(sitzung, a2!);
    expect(a3).toEqual({ entryUuid: "a1", page: 3 });
    const b = weiter(sitzung, a3!);
    expect(b).toEqual({ entryUuid: "b1", page: null });
    const zweiteA = weiter(sitzung, b!);
    expect(zweiteA).toEqual({ entryUuid: "a2", page: 1 });
    expect(weiter(sitzung, { entryUuid: "a2", page: 3 })).toBeNull();
  });

  it("geht rückwärts über Songgrenzen auf die letzte Seite", () => {
    expect(zurueck(sitzung, { entryUuid: "a2", page: 1 })).toEqual({
      entryUuid: "b1",
      page: null,
    });
    expect(zurueck(sitzung, { entryUuid: "b1", page: null })).toEqual({
      entryUuid: "a1",
      page: 3,
    });
    expect(zurueck(sitzung, { entryUuid: "a1", page: 1 })).toBeNull();
  });

  it("wählt direkte Songs auf Seite 1 und überspringt Pausen", () => {
    const b = songEintraege(sitzung)[1];
    expect(zielFuerEintrag(b)).toEqual({ entryUuid: "b1", page: null });
    expect(seitenAnzeige(sitzung, { entryUuid: "a1", page: 2 })).toEqual({
      seite: 2,
      gesamt: 3,
    });
    expect(seitenAnzeige(sitzung, { entryUuid: "b1", page: null })).toBeNull();
    expect(naechsterSongTitel(sitzung, { entryUuid: "a1", page: 1 })).toBe("B");
    expect(naechsterSongTitel(sitzung, { entryUuid: "a2", page: 1 })).toBeNull();
  });
});
