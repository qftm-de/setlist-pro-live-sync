import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FakePdfViewerMitWerkzeug } from "../documents/testhelfer";
import type { AnmerkungAdapter } from "./annotations";
import { AnmerkungsBereich } from "./AnmerkungsBereich";
import { anmerkungTestAdapter, testAnmerkung } from "./testhelfer";

function bereich(adapter: AnmerkungAdapter, aktualisierung = 0) {
  return (
    <AnmerkungsBereich
      bandId="a"
      songId={1}
      versionId={1}
      seiten={1}
      daten={new ArrayBuffer(4)}
      titel="Test"
      Viewer={FakePdfViewerMitWerkzeug}
      adapter={adapter}
      aktualisierung={aktualisierung}
    />
  );
}

describe("AnmerkungsBereich", () => {
  it("behält beim Speichern die Revision aus dem geöffneten Formular", async () => {
    let aufrufe = 0;
    const adapter = anmerkungTestAdapter([testAnmerkung({ id: 1 })], {
      async lade() {
        aufrufe += 1;
        return [testAnmerkung({ id: 1, revision: aufrufe === 1 ? 0 : 1 })];
      },
    });
    const aendere = vi.spyOn(adapter, "aendere");
    const { rerender } = render(bereich(adapter));
    fireEvent.click(await screen.findByRole("button", { name: /Leiser/ }));
    fireEvent.change(screen.getByLabelText("Text"), {
      target: { value: "Mein Entwurf" },
    });

    rerender(bereich(adapter, 1));
    await waitFor(() => expect(aufrufe).toBe(2));
    fireEvent.click(screen.getByRole("button", { name: "Anmerkung speichern" }));

    await waitFor(() => expect(aendere).toHaveBeenCalled());
    expect(aendere.mock.calls[0][4]).toBe(0);
  });

  it("markiert eine entfernte bandweite Anmerkung auch im Lesemodus", async () => {
    let aufrufe = 0;
    const adapter = anmerkungTestAdapter(
      [testAnmerkung({ id: 1, can_edit: false, can_delete: true })],
      {
        async lade() {
          aufrufe += 1;
          return aufrufe === 1
            ? [testAnmerkung({ id: 1, can_edit: false, can_delete: true })]
            : [];
        },
      },
    );
    const { rerender } = render(bereich(adapter));
    fireEvent.click(await screen.findByRole("button", { name: /Leiser/ }));
    expect(screen.getByText("Bandweite Anmerkung")).toBeInTheDocument();

    rerender(bereich(adapter, 1));

    expect(
      await screen.findByText(
        "Diese Anmerkung wurde inzwischen gelöscht. Dein Entwurf bleibt erhalten.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Anmerkung löschen" }),
    ).not.toBeInTheDocument();
  });

  it("markiert eine entfernte Anmerkung und behält den Entwurf", async () => {
    let aufrufe = 0;
    const adapter = anmerkungTestAdapter([testAnmerkung({ id: 1 })], {
      async lade() {
        aufrufe += 1;
        return aufrufe === 1 ? [testAnmerkung({ id: 1 })] : [];
      },
    });
    const { rerender } = render(bereich(adapter));
    fireEvent.click(await screen.findByRole("button", { name: /Leiser/ }));
    fireEvent.change(screen.getByLabelText("Text"), {
      target: { value: "Bleibt stehen" },
    });

    rerender(bereich(adapter, 1));

    expect(
      await screen.findByText(
        "Diese Anmerkung wurde inzwischen gelöscht. Dein Entwurf bleibt erhalten.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Text")).toHaveValue("Bleibt stehen");
    expect(
      screen.getByRole("button", { name: "Anmerkung speichern" }),
    ).toBeDisabled();
  });
});
