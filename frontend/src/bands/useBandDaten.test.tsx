import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { erstelleTestAdapter, type BandDaten, type Song } from "./bands";
import { useBandDaten } from "./useBandDaten";

function verzögert<T>() {
  let aufloesen!: (wert: T) => void;
  const promise = new Promise<T>((resolve) => {
    aufloesen = resolve;
  });
  return { promise, aufloesen };
}

function song(titel: string): Song {
  return { id: 1, title: titel };
}

describe("useBandDaten", () => {
  it("verwirft eine späte Antwort der alten Band", async () => {
    const a = verzögert<BandDaten>();
    const b = verzögert<BandDaten>();
    const adapter = erstelleTestAdapter(
      [
        { id: "a", name: "Band A" },
        { id: "b", name: "Band B" },
      ],
      (bandId) => (bandId === "a" ? a.promise : b.promise),
    );
    const { result, rerender } = renderHook(({ bandId }) => useBandDaten(adapter, bandId), {
      initialProps: { bandId: "a" },
    });
    expect(result.current.status).toBe("laedt");

    rerender({ bandId: "b" });
    expect(result.current.status).toBe("laedt");

    await act(async () => {
      b.aufloesen({ bandId: "b", songs: [song("Song B")] });
    });
    expect(result.current).toMatchObject({
      status: "fertig",
      daten: { bandId: "b", songs: [song("Song B")] },
    });

    await act(async () => {
      a.aufloesen({ bandId: "a", songs: [song("Song A")] });
    });
    expect(result.current).toMatchObject({
      status: "fertig",
      daten: { bandId: "b", songs: [song("Song B")] },
    });
  });

  it("zeigt nach dem Wechsel sofort Ladezustand statt alter Daten", async () => {
    const adapter = erstelleTestAdapter(
      [
        { id: "a", name: "Band A" },
        { id: "b", name: "Band B" },
      ],
      async (bandId) => ({ bandId, songs: bandId === "a" ? [song("Song A")] : [] }),
    );
    const { result, rerender } = renderHook(({ bandId }) => useBandDaten(adapter, bandId), {
      initialProps: { bandId: "a" },
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.status).toBe("fertig");

    rerender({ bandId: "b" });
    expect(result.current.status).toBe("laedt");
  });
});
