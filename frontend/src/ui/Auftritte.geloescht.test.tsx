import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { erstelleGigTestAdapter } from "../gigs/gigs";
import { gig } from "../gigs/testhelfer";
import { erstelleSetlistTestAdapter } from "../setlists/setlists";
import { Auftritte } from "./Auftritte";

describe("Auftritte", () => {
  it("markiert einen entfernten Auftritt und behält den Entwurf", async () => {
    const adapter = erstelleGigTestAdapter([gig()], "2026-06-15");
    const { rerender } = render(
      <Auftritte
        bandId="a"
        adapter={adapter}
        setlistAdapter={erstelleSetlistTestAdapter([])}
        onNavigieren={() => undefined}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Sommerfest ändern" }));
    fireEvent.change(screen.getByLabelText("Titel (ändern)"), {
      target: { value: "Mein Entwurf" },
    });
    await adapter.loescheGig("a", 1);

    rerender(
      <Auftritte
        bandId="a"
        adapter={adapter}
        setlistAdapter={erstelleSetlistTestAdapter([])}
        onNavigieren={() => undefined}
        aktualisierung={1}
      />,
    );

    expect(
      await screen.findByText(
        "Dieser Auftritt wurde inzwischen gelöscht. Dein Entwurf bleibt erhalten.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Titel (ändern)")).toHaveValue("Mein Entwurf");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Änderung speichern" }),
      ).toBeDisabled(),
    );
  });

  it("behält einen entfernten vergangenen Auftritt in seiner Gruppe", async () => {
    const adapter = erstelleGigTestAdapter(
      [gig({ id: 2, title: "Alt", date: "2026-06-01" })],
      "2026-06-15",
    );
    const { rerender } = render(
      <Auftritte
        bandId="a"
        adapter={adapter}
        setlistAdapter={erstelleSetlistTestAdapter([])}
        onNavigieren={() => undefined}
      />,
    );
    const gruppe = (
      await screen.findByRole("heading", { name: "Vergangene Auftritte" })
    ).closest(".auftritt-gruppe") as HTMLElement;
    fireEvent.click(within(gruppe).getByRole("button", { name: "Alt ändern" }));
    const offen = (
      await screen.findByRole("heading", { name: "In Bearbeitung" })
    ).closest(".auftritt-gruppe") as HTMLElement;
    fireEvent.change(within(offen).getByLabelText("Titel (ändern)"), {
      target: { value: "Alter Entwurf" },
    });
    await adapter.loescheGig("a", 2);

    rerender(
      <Auftritte
        bandId="a"
        adapter={adapter}
        setlistAdapter={erstelleSetlistTestAdapter([])}
        onNavigieren={() => undefined}
        aktualisierung={1}
      />,
    );

    expect(
      await within(offen).findByText(
        "Dieser Auftritt wurde inzwischen gelöscht. Dein Entwurf bleibt erhalten.",
      ),
    ).toBeInTheDocument();
    expect(within(offen).getByLabelText("Titel (ändern)")).toHaveValue(
      "Alter Entwurf",
    );
  });

  it("behält den Entwurf, wenn der Auftritt die Gruppe wechselt", async () => {
    const adapter = erstelleGigTestAdapter(
      [gig({ id: 2, title: "Alt", date: "2026-06-01" })],
      "2026-06-15",
    );
    const { rerender } = render(
      <Auftritte
        bandId="a"
        adapter={adapter}
        setlistAdapter={erstelleSetlistTestAdapter([])}
        onNavigieren={() => undefined}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Alt ändern" }));
    fireEvent.change(screen.getByLabelText("Titel (ändern)"), {
      target: { value: "Bleibt offen" },
    });
    await adapter.aendereGig("a", 2, { date: "2026-07-01" });

    rerender(
      <Auftritte
        bandId="a"
        adapter={adapter}
        setlistAdapter={erstelleSetlistTestAdapter([])}
        onNavigieren={() => undefined}
        aktualisierung={1}
      />,
    );

    expect(screen.getByLabelText("Titel (ändern)")).toHaveValue("Bleibt offen");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
