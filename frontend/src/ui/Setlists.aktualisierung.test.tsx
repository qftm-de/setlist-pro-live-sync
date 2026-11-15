import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { erstelleSetlistTestAdapter } from "../setlists/setlists";
import { Setlists } from "./Setlists";

const adapter = erstelleSetlistTestAdapter([
  { id: 1, name: "Hauptset", sections: [] },
]);

describe("Setlists", () => {
  it("markiert eine entfernte Setlist und sperrt das Speichern", async () => {
    const entfernbar = erstelleSetlistTestAdapter([
      { id: 1, name: "Hauptset", sections: [] },
    ]);
    const { rerender } = render(
      <Setlists bandId="a" songs={[]} adapter={entfernbar} />,
    );
    expect(
      await screen.findByRole("heading", { name: "Hauptset" }),
    ).toBeInTheDocument();
    await entfernbar.loescheSetlist("a", 1);
    rerender(
      <Setlists bandId="a" songs={[]} adapter={entfernbar} aktualisierung={1} />,
    );
    expect(
      await screen.findByText(
        "Diese Setlist wurde inzwischen gelöscht. Dein Entwurf bleibt erhalten.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Setlist speichern" }),
    ).toBeDisabled();
  });

  it("zeigt bei einer externen Änderung einen Hinweis und behält den Editor", async () => {
    const { rerender } = render(
      <Setlists bandId="a" songs={[]} adapter={adapter} />,
    );
    expect(
      await screen.findByRole("heading", { name: "Hauptset" }),
    ).toBeInTheDocument();

    rerender(
      <Setlists bandId="a" songs={[]} adapter={adapter} aktualisierung={1} />,
    );

    expect(
      await screen.findByText(
        "Diese Setlist wurde inzwischen geändert. Dein Entwurf bleibt erhalten.",
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Hauptset" }),
      ).toBeInTheDocument(),
    );
  });
});
