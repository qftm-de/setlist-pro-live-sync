import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { erstelleTestAdapter } from "./bands/bands";
import { erstelleSetlistTestAdapter } from "./setlists/setlists";
import { bandAdapterMitSongs, KONFIGURATION, sitzungAdapter, song } from "./test-helfer";

beforeEach(() => {
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("legt eine Setlist an und speichert Songs darin", async () => {
    const speichern = vi.fn(async () => ({ id: 1, name: "Hauptset", sections: [] }));
    const setlistAdapter = erstelleSetlistTestAdapter([], { speichereInhalt: speichern });
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={erstelleTestAdapter([{ id: "a", name: "Band A" }], async (bandId) => ({
          bandId,
          songs: [song("Abrissbirne")],
        }))}
        setlistAdapter={setlistAdapter}
      />,
    );
    await screen.findByText("Abrissbirne");
    fireEvent.click(screen.getByRole("link", { name: "Setlists" }));
    expect(
      await screen.findByText("Noch keine Setlist. Lege die erste an."),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Neue Setlist"), {
      target: { value: "Hauptset" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Setlist anlegen" }));
    fireEvent.click(await screen.findByRole("button", { name: "Set hinzufügen" }));
    fireEvent.click(screen.getByRole("button", { name: "Song in Abschnitt 1" }));
    expect(
      await screen.findByRole("button", { name: "Abrissbirne an Position 1 entfernen" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Setlist speichern" }));
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect(speichern).toHaveBeenCalledWith("a", 1, [
      {
        name: "Set",
        kind: "set",
        entries: [{ entry_type: "song", song_id: 1, duration_seconds: null }],
      },
    ]);
  });

  it("zeigt Setlists nicht auf der Startseite", async () => {
    const setlistAdapter = erstelleSetlistTestAdapter([]);
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
    expect(await screen.findByRole("heading", { name: "Songs" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Setlist anlegen" })).not.toBeInTheDocument();
  });

  it("zeigt einen neuen Song auch in der Setlist-Auswahl", async () => {
    const adapter = bandAdapterMitSongs([]);
    const setlistAdapter = erstelleSetlistTestAdapter([]);
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={adapter}
        setlistAdapter={setlistAdapter}
      />,
    );
    fireEvent.change(await screen.findByLabelText("Titel"), {
      target: { value: "Abrissbirne" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Song hinzufügen" }));
    expect(await screen.findByText("Gespeichert")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Setlists" }));
    fireEvent.change(await screen.findByLabelText("Neue Setlist"), {
      target: { value: "Hauptset" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Setlist anlegen" }));
    fireEvent.click(await screen.findByRole("button", { name: "Set hinzufügen" }));
    expect(
      await screen.findByRole("option", { name: "Abrissbirne" }),
    ).toBeInTheDocument();
  });

  it("sperrt den Anlegeknopf der Setlist während des Requests", async () => {
    const lauf = new Promise<void>((resolve) => setTimeout(resolve, 0)).then(() => undefined);
    const setlistAdapter = erstelleSetlistTestAdapter([], {
      erstelleSetlist: async (_bandId, name) => {
        await lauf;
        return { id: 1, name, sections: [] };
      },
    });
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={bandAdapterMitSongs([])}
        setlistAdapter={setlistAdapter}
      />,
    );
    fireEvent.click(await screen.findByRole("link", { name: "Setlists" }));
    fireEvent.change(await screen.findByLabelText("Neue Setlist"), {
      target: { value: "Hauptset" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Setlist anlegen" }));
    expect(screen.getByRole("button", { name: "Legt an …" })).toBeDisabled();
  });

  it("sperrt den Löschenknopf während des Requests", async () => {
    const setlistAdapter = erstelleSetlistTestAdapter(
      [{ id: 1, name: "Hauptset", sections: [] }],
      {
        loescheSetlist: () => new Promise<void>(() => {}),
      },
    );
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={bandAdapterMitSongs([])}
        setlistAdapter={setlistAdapter}
      />,
    );
    fireEvent.click(await screen.findByRole("link", { name: "Setlists" }));
    const knopf = await screen.findByRole("button", { name: "Hauptset löschen" });
    fireEvent.click(knopf);
    expect(screen.getByRole("button", { name: "Hauptset löschen" })).toBeDisabled();
  });

  it("sperrt die Bearbeitung während des Speicherns", async () => {
    const setlistAdapter = erstelleSetlistTestAdapter(
      [{ id: 1, name: "Hauptset", sections: [] }],
      {
        speichereInhalt: () => new Promise(() => {}),
      },
    );
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={bandAdapterMitSongs([])}
        setlistAdapter={setlistAdapter}
      />,
    );
    fireEvent.click(await screen.findByRole("link", { name: "Setlists" }));
    fireEvent.click(await screen.findByRole("button", { name: "Setlist speichern" }));
    expect(await screen.findByRole("button", { name: "Set hinzufügen" })).toBeDisabled();
  });
});
