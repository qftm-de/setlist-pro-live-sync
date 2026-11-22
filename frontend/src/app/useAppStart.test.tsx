import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiFehler } from "../api/client";
import { useAppStart } from "./useAppStart";
import { erstelleTestAdapter, type Band } from "../bands/bands";
import { KONFIGURATION, sitzungAdapter, verzögert } from "../test-helfer";

const BAND_A: Band = { id: "a", name: "Band A" };
const BAND_B: Band = { id: "b", name: "Band B" };

function starte(ladeBands: () => Promise<Band[]>) {
  const konfigurationLaden = vi.fn().mockResolvedValue(KONFIGURATION);
  const sessionAdapter = sitzungAdapter();
  const bandAdapter = erstelleTestAdapter(
    [BAND_A],
    async (bandId) => ({ bandId, songs: [] }),
    { ladeBands },
  );
  return renderHook(() =>
    useAppStart(konfigurationLaden, sessionAdapter, bandAdapter),
  );
}

describe("useAppStart", () => {
  it("ignoriert eine ältere Bandliste nach einem neueren Abruf", async () => {
    const alt = verzögert<Band[]>();
    const ladeBands = vi
      .fn<() => Promise<Band[]>>()
      .mockResolvedValueOnce([BAND_A])
      .mockReturnValueOnce(alt.promise)
      .mockResolvedValueOnce([]);
    const { result } = starte(ladeBands);

    await waitFor(() => expect(result.current.bands.status).toBe("fertig"));

    let alterLauf: Promise<{ angewendet: boolean }> | undefined;
    let frischerLauf: Promise<{ angewendet: boolean }> | undefined;
    act(() => {
      alterLauf = result.current.bandsNeuLaden();
      frischerLauf = result.current.bandsNeuLaden();
    });
    await act(async () => {
      await frischerLauf;
    });
    expect(result.current.bands).toEqual({ status: "fertig", bands: [] });

    await act(async () => {
      alt.aufloesen([BAND_A]);
      await alterLauf;
    });
    expect(result.current.bands).toEqual({ status: "fertig", bands: [] });
  });

  it("ignoriert einen späten Fehler des Startabrufs nach einem neueren Beitritt", async () => {
    for (const fehler of [
      new Error("Netzwerkfehler"),
      new ApiFehler(401, "unauthenticated", "Nicht angemeldet"),
    ]) {
      const startAbruf = verzögert<Band[]>();
      const ladeBands = vi
        .fn<() => Promise<Band[]>>()
        .mockReturnValueOnce(startAbruf.promise)
        .mockResolvedValueOnce([BAND_B]);
      const { result } = starte(ladeBands);

      await waitFor(() => expect(ladeBands).toHaveBeenCalledTimes(1));

      await act(async () => {
        await result.current.einladungAngenommen(BAND_B.id);
      });
      expect(result.current.bands).toEqual({ status: "fertig", bands: [BAND_B] });
      expect(result.current.bandId).toBe(BAND_B.id);

      await act(async () => {
        startAbruf.ablehnen(fehler);
        await Promise.resolve();
      });
      expect(result.current.sitzung.status).toBe("angemeldet");
      expect(result.current.bands).toEqual({ status: "fertig", bands: [BAND_B] });
    }
  });

  it("ignoriert eine verspätete Start-Sitzungsabfrage nach einem Einladungsbeitritt", async () => {
    for (const ausgang of [
      { art: "anonym" as const },
      { art: "fehler" as const },
      { art: "angemeldet" as const },
    ]) {
      const startSitzung = verzögert<{ angemeldet: boolean; benutzername?: string }>();
      const ladeSitzung = vi
        .fn()
        .mockReturnValueOnce(startSitzung.promise)
        .mockResolvedValueOnce({ angemeldet: true, benutzername: "neu" });
      const ladeBands = vi.fn().mockResolvedValue([BAND_A, BAND_B]);
      const konfigurationLaden = vi.fn().mockResolvedValue(KONFIGURATION);
      const sessionAdapter = {
        ...sitzungAdapter(),
        ladeSitzung,
      };
      const bandAdapter = erstelleTestAdapter(
        [BAND_A, BAND_B],
        async (bandId) => ({ bandId, songs: [] }),
        { ladeBands },
      );
      const { result } = renderHook(() =>
        useAppStart(konfigurationLaden, sessionAdapter, bandAdapter),
      );

      await waitFor(() => expect(ladeSitzung).toHaveBeenCalledTimes(1));

      await act(async () => {
        await result.current.einladungAngenommen(BAND_B.id);
      });
      expect(result.current.sitzung).toEqual({ status: "angemeldet", benutzername: "neu" });
      expect(result.current.bandId).toBe(BAND_B.id);

      await act(async () => {
        if (ausgang.art === "anonym") {
          startSitzung.aufloesen({ angemeldet: false });
        } else if (ausgang.art === "fehler") {
          startSitzung.ablehnen(new Error("Start-Sitzungsfehler"));
        } else {
          startSitzung.aufloesen({ angemeldet: true, benutzername: "alt" });
        }
        await Promise.resolve();
      });

      expect(result.current.sitzung).toEqual({ status: "angemeldet", benutzername: "neu" });
      expect(result.current.bandId).toBe(BAND_B.id);
      expect(ladeBands).toHaveBeenCalledTimes(1);
    }
  });

  it("behält die Zielband eines Einladungsbeitritts trotz gleichzeitigem Hintergrundabruf", async () => {
    const beitrittAbruf = verzögert<Band[]>();
    const hintergrundAbruf = verzögert<Band[]>();
    const ladeBands = vi
      .fn<() => Promise<Band[]>>()
      .mockResolvedValueOnce([BAND_A])
      .mockReturnValueOnce(beitrittAbruf.promise)
      .mockReturnValueOnce(hintergrundAbruf.promise);
    const { result } = starte(ladeBands);

    await waitFor(() => expect(result.current.bandId).toBe(BAND_A.id));

    let beitritt: Promise<void> | undefined;
    let hintergrund: Promise<{ angewendet: boolean }> | undefined;
    await act(async () => {
      beitritt = result.current.einladungAngenommen(BAND_B.id);
      await Promise.resolve();
      hintergrund = result.current.bandsNeuLaden();
    });

    await act(async () => {
      beitrittAbruf.aufloesen([BAND_A, BAND_B]);
      await beitritt;
    });
    await act(async () => {
      hintergrundAbruf.aufloesen([BAND_A, BAND_B]);
      await hintergrund;
    });

    expect(result.current.bandId).toBe(BAND_B.id);
    expect(result.current.bands).toEqual({ status: "fertig", bands: [BAND_A, BAND_B] });
  });
});
