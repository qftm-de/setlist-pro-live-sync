import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { parseRoute } from "../routing";
import { useAktiveBand } from "./useAktiveBand";

function baue(bands: Array<{ id: string; name: string }>, bandId: string) {
  const setBandId = vi.fn();
  renderHook(
    ({ liste, aktiv }) =>
      useAktiveBand(liste, parseRoute("/"), aktiv, setBandId, () => {}),
    { initialProps: { liste: bands, aktiv: bandId } },
  );
  return setBandId;
}

describe("useAktiveBand", () => {
  it("behält eine sichtbare aktive Band", () => {
    const setBandId = baue(
      [
        { id: "1", name: "Aktiv" },
        { id: "2", name: "Andere" },
      ],
      "1",
    );

    expect(setBandId).not.toHaveBeenCalled();
  });

  it("wählt nach dem Verlust der Mitgliedschaft eine sichtbare Band", () => {
    const setBandId = baue([{ id: "2", name: "Verbleibt" }], "1");

    expect(setBandId).toHaveBeenCalledWith("2");
  });

  it("setzt die aktive Band auf null ohne sichtbare Bands", () => {
    const setBandId = baue([], "1");

    expect(setBandId).toHaveBeenCalledWith(null);
  });
});
