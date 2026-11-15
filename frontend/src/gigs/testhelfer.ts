import { fireEvent, screen } from "@testing-library/react";
import { vi } from "vitest";
import { erstelleTestAdapter } from "../bands/bands";
import { erstelleSetlistTestAdapter } from "../setlists/setlists";
import { KONFIGURATION, sitzungAdapter } from "../test-helfer";
import type { Gig, GigAdapter, GigGruppen } from "./gigs";

export function gig(zusatz: Partial<Gig> = {}): Gig {
  return {
    id: 1,
    title: "Sommerfest",
    date: "2026-06-20",
    time: "20:00:00",
    location: "Hof",
    notes: "",
    setlist_id: null,
    setlist_name: null,
    ...zusatz,
  };
}

export function gruppen(overrides: Partial<GigGruppen> = {}): GigGruppen {
  return { upcoming: [], past: [], ...overrides };
}

export function appOptionen(gigAdapter: GigAdapter) {
  return {
    konfigurationLaden: vi.fn().mockResolvedValue(KONFIGURATION),
    sessionAdapter: sitzungAdapter(),
    bandAdapter: erstelleTestAdapter(
      [{ id: "a", name: "Band A" }],
      async (bandId) => ({ bandId, songs: [] }),
    ),
    setlistAdapter: erstelleSetlistTestAdapter([]),
    gigAdapter,
  };
}

export async function zuAuftritten() {
  fireEvent.click(await screen.findByRole("link", { name: "Auftritte" }));
}
