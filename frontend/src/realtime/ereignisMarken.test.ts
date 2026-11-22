import { describe, expect, it } from "vitest";
import { ladeMarke } from "./ereignisMarken";

describe("ladeMarke", () => {
  it("lädt Auftritte nur bei Auftrittsereignissen neu", () => {
    expect(ladeMarke("gig.created")).toBe("gig");
    expect(ladeMarke("gig.updated")).toBe("gig");
    expect(ladeMarke("gig.deleted")).toBe("gig");
  });

  it("lädt die Bandverwaltung nur bei Bandereignissen neu", () => {
    expect(ladeMarke("band.updated")).toBe("band");
    expect(ladeMarke("band.members.updated")).toBe("band");
    expect(ladeMarke("band.invitations.updated")).toBe("band");
  });

  it("lädt Auftritte bei Setlist-Umbenennung und -Löschung neu", () => {
    expect(ladeMarke("setlist.updated")).toBe("gig");
    expect(ladeMarke("setlist.deleted")).toBe("gig");
  });

  it("ignoriert Text-, Inhalts- und Song-Ereignisse", () => {
    expect(ladeMarke("text.updated")).toBeNull();
    expect(ladeMarke("setlist.content")).toBeNull();
    expect(ladeMarke("song.updated")).toBeNull();
    expect(ladeMarke("annotation.created")).toBeNull();
  });
});
