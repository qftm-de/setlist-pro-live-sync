import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { erstelleTestAdapter } from "./bands/bands";
import { erstelleSetlistTestAdapter } from "./setlists/setlists";
import { KONFIGURATION, sitzungAdapter } from "./test-helfer";

beforeEach(() => {
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Setlist-Direktlink", () => {
  it("öffnet eine Setlist per Direktlink", async () => {
    window.history.replaceState({}, "", "/setlists/a/2");
    const ladeSetlist = vi.fn(async (_bandId: string, setlistId: number) => ({
      id: setlistId,
      name: setlistId === 2 ? "Zweite" : "Erste",
      sections: [],
    }));
    const setlistAdapter = erstelleSetlistTestAdapter(
      [
        { id: 1, name: "Erste", sections: [] },
        { id: 2, name: "Zweite", sections: [] },
      ],
      { ladeSetlist },
    );
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={erstelleTestAdapter([{ id: "a", name: "Band A" }], async (bandId) => ({
          bandId,
          songs: [],
        }))}
        setlistAdapter={setlistAdapter}
      />,
    );
    expect(
      await screen.findByRole("button", { name: "Zweite", pressed: true }),
    ).toBeInTheDocument();
    await waitFor(() => expect(ladeSetlist).toHaveBeenCalledWith("a", 2));
  });

  it("meldet eine fehlende Setlist im Direktlink ohne Ausweichen", async () => {
    window.history.replaceState({}, "", "/setlists/a/9");
    const ladeSetlist = vi.fn(async (_bandId: string, setlistId: number) => ({
      id: setlistId,
      name: "Erste",
      sections: [],
    }));
    const setlistAdapter = erstelleSetlistTestAdapter(
      [
        { id: 1, name: "Erste", sections: [] },
        { id: 2, name: "Zweite", sections: [] },
      ],
      { ladeSetlist },
    );
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={erstelleTestAdapter([{ id: "a", name: "Band A" }], async (bandId) => ({
          bandId,
          songs: [],
        }))}
        setlistAdapter={setlistAdapter}
      />,
    );
    expect(
      await screen.findByText("Diese Setlist existiert nicht."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Erste" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(ladeSetlist).not.toHaveBeenCalled();
  });

  it("meldet eine fehlende Band im Direktlink", async () => {
    window.history.replaceState({}, "", "/setlists/zzz/2");
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={erstelleTestAdapter([{ id: "a", name: "Band A" }], async (bandId) => ({
          bandId,
          songs: [],
        }))}
        setlistAdapter={erstelleSetlistTestAdapter([])}
      />,
    );
    expect(
      await screen.findByText("Diese Band ist für dich nicht sichtbar."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Setlists" })).not.toBeInTheDocument();
  });

  it("kehrt aus dem Direktlink mit Zurück zur Startansicht", async () => {
    window.history.replaceState({}, "", "/setlists/a/2");
    const setlistAdapter = erstelleSetlistTestAdapter([
      { id: 2, name: "Zweite", sections: [] },
    ]);
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={erstelleTestAdapter([{ id: "a", name: "Band A" }], async (bandId) => ({
          bandId,
          songs: [],
        }))}
        setlistAdapter={setlistAdapter}
      />,
    );
    expect(
      await screen.findByRole("button", { name: "Zweite", pressed: true }),
    ).toBeInTheDocument();

    act(() => {
      window.history.replaceState({}, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(await screen.findByRole("heading", { name: "Songs" })).toBeInTheDocument();
  });

  it("navigiert beim Bandwechsel aus dem Direktlink auf /setlists", async () => {
    window.history.replaceState({}, "", "/setlists/a/2");
    const ladeSetlist = vi.fn(async (bandId: string, setlistId: number) => ({
      id: setlistId,
      name:
        bandId === "a"
          ? setlistId === 2
            ? "A-Zweite"
            : "A-Erste"
          : "B-Erste",
      sections: [],
    }));
    const setlistAdapter = erstelleSetlistTestAdapter([], {
      ladeSetlists: async (bandId) =>
        bandId === "a"
          ? [
              { id: 1, name: "A-Erste" },
              { id: 2, name: "A-Zweite" },
            ]
          : [{ id: 10, name: "B-Erste" }],
      ladeSetlist,
    });
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={erstelleTestAdapter(
          [
            { id: "a", name: "Band A" },
            { id: "b", name: "Band B" },
          ],
          async (bandId) => ({ bandId, songs: [] }),
        )}
        setlistAdapter={setlistAdapter}
      />,
    );
    expect(
      await screen.findByRole("button", { name: "A-Zweite", pressed: true }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Band"), { target: { value: "b" } });
    expect(window.location.pathname).toBe("/setlists");
    expect(
      await screen.findByRole("button", { name: "B-Erste", pressed: true }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "A-Zweite" }),
    ).not.toBeInTheDocument();
  });

  it("erhält den Entwurf beim Reiterklick aus dem Direktlink", async () => {
    window.history.replaceState({}, "", "/setlists/a/2");
    const setlistAdapter = erstelleSetlistTestAdapter([
      { id: 2, name: "Zweite", sections: [] },
    ]);
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={erstelleTestAdapter([{ id: "a", name: "Band A" }], async (bandId) => ({
          bandId,
          songs: [],
        }))}
        setlistAdapter={setlistAdapter}
      />,
    );
    expect(
      await screen.findByRole("button", { name: "Zweite", pressed: true }),
    ).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Set hinzufügen" }));
    expect(screen.getByRole("status")).toHaveAttribute("data-zustand", "entwurf");

    fireEvent.click(screen.getByRole("link", { name: "Setlists" }));
    expect(window.location.pathname).toBe("/setlists");
    expect(screen.getByRole("status")).toHaveAttribute("data-zustand", "entwurf");
    expect(screen.getByRole("button", { name: "Zweite" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("meldet eine fehlerhaft kodierte Band-URL ohne Absturz", async () => {
    window.history.replaceState({}, "", "/setlists/%E0%A4%A/2");
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={erstelleTestAdapter([{ id: "a", name: "Band A" }], async (bandId) => ({
          bandId,
          songs: [],
        }))}
        setlistAdapter={erstelleSetlistTestAdapter([])}
      />,
    );
    expect(
      await screen.findByText("Diese Band ist für dich nicht sichtbar."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Songs" })).toBeInTheDocument();
  });
});
