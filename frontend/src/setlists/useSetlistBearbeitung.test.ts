import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { textSchluessel } from "../collaboration/texte";
import type { Setlist, SetlistAdapter } from "./setlists";
import { useSetlistBearbeitung } from "./useSetlistBearbeitung";

const initial: Setlist = {
  id: 1,
  uuid: "s1",
  name: "Set",
  revision: 0,
  sections: [],
};
const saved: Setlist = {
  id: 1,
  uuid: "s1",
  name: "Set",
  revision: 1,
  sections: [
    {
      id: 2,
      uuid: "new-section",
      name: "Neu",
      kind: "set",
      position: 1,
      entries: [],
    },
  ],
};
const sectionStand = {
  object_type: "section" as const,
  object_uuid: "new-section",
  field: "name" as const,
  epoch: 0,
  revision: 0,
  state: "",
};

function adapterMit(ladeTexte: SetlistAdapter["ladeTexte"]): SetlistAdapter {
  return {
    ladeSetlists: async () => [],
    erstelleSetlist: async () => initial,
    ladeSetlist: async () => saved,
    speichereInhalt: async () => saved,
    loescheSetlist: async () => undefined,
    ladeTexte,
  };
}

describe("useSetlistBearbeitung", () => {
  it("lädt die Textstände nach dem Speichern neu", async () => {
    const ladeTexte = vi
      .fn<NonNullable<SetlistAdapter["ladeTexte"]>>()
      .mockResolvedValueOnce({ revision: 0, texts: [] })
      .mockResolvedValue({ revision: 1, texts: [sectionStand] });
    const adapter = adapterMit(ladeTexte);
    const { result } = renderHook(() =>
      useSetlistBearbeitung({
        bandId: "b1",
        setlist: initial,
        songs: [],
        adapter,
        verbunden: true,
        textEreignisse: {},
      }),
    );
    await waitFor(() => expect(ladeTexte).toHaveBeenCalledTimes(1));
    act(() => result.current.blockHinzufuegen("set"));
    await act(async () => {
      await result.current.speichern();
    });
    await waitFor(() => expect(ladeTexte).toHaveBeenCalledTimes(2));
    expect(
      result.current.texte[
        textSchluessel("section", "new-section", "name")
      ],
    ).toBeDefined();
  });

  it("verwirft eine überholte Ladeantwort", async () => {
    let ersterAufloeser!: (wert: {
      revision: number;
      texts: typeof sectionStand[];
    }) => void;
    const ladeTexte = vi
      .fn<NonNullable<SetlistAdapter["ladeTexte"]>>()
      .mockImplementationOnce(
        () =>
          new Promise((res) => {
            ersterAufloeser = res;
          }),
      )
      .mockResolvedValue({ revision: 1, texts: [sectionStand] });
    const adapter = adapterMit(ladeTexte);
    const { result } = renderHook(() =>
      useSetlistBearbeitung({
        bandId: "b1",
        setlist: initial,
        songs: [],
        adapter,
        verbunden: true,
        textEreignisse: {},
      }),
    );
    await waitFor(() => expect(ladeTexte).toHaveBeenCalledTimes(1));
    act(() => result.current.blockHinzufuegen("set"));
    await act(async () => {
      await result.current.speichern();
    });
    await waitFor(() => expect(ladeTexte).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        result.current.texte[
          textSchluessel("section", "new-section", "name")
        ],
      ).toBeDefined(),
    );
    await act(async () => {
      ersterAufloeser({ revision: 0, texts: [] });
    });
    expect(
      result.current.texte[
        textSchluessel("section", "new-section", "name")
      ],
    ).toBeDefined();
  });

  it("macht einen Fehler beim Laden der Textstände sichtbar", async () => {
    const ladeTexte = vi
      .fn<NonNullable<SetlistAdapter["ladeTexte"]>>()
      .mockRejectedValue(new Error("offline"));
    const adapter = adapterMit(ladeTexte);
    const { result } = renderHook(() =>
      useSetlistBearbeitung({
        bandId: "b1",
        setlist: initial,
        songs: [],
        adapter,
        verbunden: true,
        textEreignisse: {},
      }),
    );
    await waitFor(() => expect(ladeTexte).toHaveBeenCalled());
    await waitFor(() => expect(result.current.textFehler).not.toBeNull());
  });
});
