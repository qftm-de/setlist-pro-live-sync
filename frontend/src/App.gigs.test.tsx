import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { erstelleGigTestAdapter } from "./gigs/gigs";
import { appOptionen, gig, zuAuftritten } from "./gigs/testhelfer";
import { erstelleSetlistTestAdapter } from "./setlists/setlists";

beforeEach(() => {
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Auftritte", () => {
  it("zeigt kommende und vergangene Auftritte getrennt", async () => {
    const adapter = erstelleGigTestAdapter([
      gig({ id: 1, title: "Sommerfest", date: "2026-06-20", time: "20:00:00" }),
      gig({ id: 2, title: "Winterball", date: "2026-12-01", time: null }),
      gig({ id: 3, title: "Rückblick", date: "2026-01-10", time: "18:00:00" }),
    ]);
    render(<App {...appOptionen(adapter)} />);
    await zuAuftritten();

    expect(
      await screen.findByRole("heading", { name: "Kommende Auftritte" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Vergangene Auftritte" }),
    ).toBeInTheDocument();
    expect(screen.getByText("20.06.2026")).toBeInTheDocument();
    expect(screen.getByText("20:00")).toBeInTheDocument();
    expect(screen.getByText("Winterball")).toBeInTheDocument();
    expect(screen.getByText("Rückblick")).toBeInTheDocument();
    expect(screen.queryByText("Keine kommenden Auftritte.")).not.toBeInTheDocument();
  });

  it("zeigt leere Gruppen als Leerzustand", async () => {
    render(<App {...appOptionen(erstelleGigTestAdapter([]))} />);
    await zuAuftritten();
    expect(await screen.findByText("Keine kommenden Auftritte.")).toBeInTheDocument();
    expect(screen.getByText("Keine vergangenen Auftritte.")).toBeInTheDocument();
  });

  it("legt einen Auftritt mit allen Feldern und Setlist an", async () => {
    const adapter = erstelleGigTestAdapter([], "2026-06-15");
    const erstellen = vi.spyOn(adapter, "erstelleGig");
    const setlistAdapter = erstelleSetlistTestAdapter([
      { id: 2, name: "Hauptset", sections: [] },
    ]);
    render(
      <App {...appOptionen(adapter)} setlistAdapter={setlistAdapter} />,
    );
    await zuAuftritten();
    await screen.findByText("Keine kommenden Auftritte.");

    fireEvent.change(screen.getByLabelText("Titel"), {
      target: { value: "Sommerfest" },
    });
    fireEvent.change(screen.getByLabelText("Datum"), {
      target: { value: "2026-06-20" },
    });
    fireEvent.change(screen.getByLabelText("Uhrzeit"), {
      target: { value: "20:30" },
    });
    fireEvent.change(screen.getByLabelText("Ort"), { target: { value: "Hof" } });
    fireEvent.change(screen.getByLabelText("Notiz"), {
      target: { value: "Open Air" },
    });
    fireEvent.change(screen.getByLabelText("Setlist"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Auftritt anlegen" }));

    await waitFor(() => expect(erstellen).toHaveBeenCalledTimes(1));
    expect(erstellen).toHaveBeenCalledWith("a", {
      title: "Sommerfest",
      date: "2026-06-20",
      time: "20:30:00",
      location: "Hof",
      notes: "Open Air",
      setlist_id: 2,
    });
    expect(await screen.findByText("Gespeichert")).toBeInTheDocument();
    expect(screen.getByText("Sommerfest")).toBeInTheDocument();
    expect(screen.getByText("Hof")).toBeInTheDocument();
  });

  it("bietet ohne Setlists nur Ohne Setlist an und legt mit null an", async () => {
    const adapter = erstelleGigTestAdapter([], "2026-06-15");
    const erstellen = vi.spyOn(adapter, "erstelleGig");
    render(
      <App
        {...appOptionen(adapter)}
        setlistAdapter={erstelleSetlistTestAdapter([])}
      />,
    );
    await zuAuftritten();
    await screen.findByText("Keine kommenden Auftritte.");

    const auswahl = screen.getByLabelText("Setlist");
    await waitFor(() =>
      expect(within(auswahl).getAllByRole("option")).toHaveLength(1),
    );
    expect(within(auswahl).getByRole("option", { name: "Ohne Setlist" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Titel"), {
      target: { value: "Ohne Verknüpfung" },
    });
    fireEvent.change(screen.getByLabelText("Datum"), {
      target: { value: "2026-06-21" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Auftritt anlegen" }));

    await waitFor(() => expect(erstellen).toHaveBeenCalledTimes(1));
    expect(erstellen.mock.calls[0][1].setlist_id).toBeNull();
  });

  it("bearbeitet einen Auftritt vorbefüllt", async () => {
    const adapter = erstelleGigTestAdapter([
      gig({ id: 7, title: "Alt", time: "19:00:00", setlist_id: 2, setlist_name: "Hauptset" }),
    ]);
    const aendern = vi.spyOn(adapter, "aendereGig");
    render(
      <App
        {...appOptionen(adapter)}
        setlistAdapter={erstelleSetlistTestAdapter([
          { id: 2, name: "Hauptset", sections: [] },
        ])}
      />,
    );
    await zuAuftritten();
    fireEvent.click(await screen.findByRole("button", { name: "Alt ändern" }));

    expect(screen.getByLabelText("Titel (ändern)")).toHaveValue("Alt");
    expect(screen.getByLabelText("Uhrzeit (ändern)")).toHaveValue("19:00");
    expect(screen.getByLabelText("Setlist (ändern)")).toHaveValue("2");

    fireEvent.change(screen.getByLabelText("Titel (ändern)"), {
      target: { value: "Neu" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Änderung speichern" }));

    await waitFor(() => expect(aendern).toHaveBeenCalledTimes(1));
    expect(aendern.mock.calls[0][2]).toMatchObject({
      title: "Neu",
      time: "19:00:00",
      setlist_id: 2,
    });
    expect(await screen.findByText("Neu")).toBeInTheDocument();
  });

  it("löscht erst nach Bestätigung und lässt Abbrechen wirken", async () => {
    const adapter = erstelleGigTestAdapter([gig({ id: 3, title: "Termin" })]);
    const loeschen = vi.spyOn(adapter, "loescheGig");
    render(<App {...appOptionen(adapter)} />);
    await zuAuftritten();

    fireEvent.click(await screen.findByRole("button", { name: "Termin löschen" }));
    expect(screen.getByText("Wirklich löschen?")).toBeInTheDocument();
    expect(loeschen).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Löschen abbrechen" }));
    expect(screen.queryByText("Wirklich löschen?")).not.toBeInTheDocument();
    expect(screen.getByText("Termin")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Termin löschen" }));
    fireEvent.click(screen.getByRole("button", { name: "Löschen bestätigen" }));
    await waitFor(() => expect(loeschen).toHaveBeenCalledWith("a", 3));
    expect(await screen.findByText("Keine kommenden Auftritte.")).toBeInTheDocument();
  });

  it("öffnet die verknüpfte Setlist über den Direktpfad", async () => {
    const adapter = erstelleGigTestAdapter([
      gig({
        id: 1,
        title: "Sommerfest",
        setlist_id: 2,
        setlist_name: "Hauptset",
      }),
    ]);
    const ladeSetlist = vi.fn(async (_bandId: string, setlistId: number) => ({
      id: setlistId,
      name: "Hauptset",
      sections: [],
    }));
    const setlistAdapter = erstelleSetlistTestAdapter(
      [{ id: 2, name: "Hauptset", sections: [] }],
      { ladeSetlist },
    );
    render(
      <App {...appOptionen(adapter)} setlistAdapter={setlistAdapter} />,
    );
    await zuAuftritten();
    fireEvent.click(await screen.findByRole("link", { name: "Hauptset" }));

    expect(window.location.pathname).toBe("/setlists/a/2");
    expect(
      await screen.findByRole("button", { name: "Hauptset", pressed: true }),
    ).toBeInTheDocument();
    await waitFor(() => expect(ladeSetlist).toHaveBeenCalledWith("a", 2));
  });
});
