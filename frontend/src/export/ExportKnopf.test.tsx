import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExportKnopf } from "./ExportKnopf";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ExportKnopf", () => {
  it("zeigt einen Netzwerkfehler und räumt ihn beim Bandwechsel ab", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("kaputt");
      }),
    );
    const { rerender } = render(<ExportKnopf bandId="1" />);

    fireEvent.click(screen.getByRole("button", { name: "Band exportieren" }));

    const fehler = await screen.findByRole("alert");
    expect(fehler).toHaveTextContent("Keine Verbindung zum Server.");

    rerender(<ExportKnopf bandId="2" />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Band exportieren" })).toBeEnabled();
  });
});
