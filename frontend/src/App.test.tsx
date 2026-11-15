import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { ApiFehler } from "./api/client";
import { erstelleTestAdapter, type Band, type BandDaten } from "./bands/bands";
import { erstelleSetlistTestAdapter } from "./setlists/setlists";
import type { SessionAdapter } from "./session/session";
import { KONFIGURATION, sitzungAdapter, song, verzögert } from "./test-helfer";

beforeEach(() => {
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("zeigt ohne Session keine geschützten Inhalte", async () => {
    const bands = vi.fn();
    const adapter = erstelleTestAdapter([], async () => ({ bandId: "a", songs: [] }), {
      ladeBands: bands,
    });
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter(false)}
        bandAdapter={adapter}
      />,
    );
    expect(await screen.findByText("Anmeldung erforderlich")).toBeInTheDocument();
    expect(screen.getByLabelText("Passwort")).toBeInTheDocument();
    expect(screen.queryByLabelText("Band")).not.toBeInTheDocument();
    expect(screen.queryByText(/Angemeldet als/)).not.toBeInTheDocument();
    expect(bands).not.toHaveBeenCalled();
  });

  it("meldet sich an und lädt danach die Bands", async () => {
    let angemeldet = false;
    const adapter: SessionAdapter = {
      ladeSitzung: async () => ({ angemeldet, benutzername: "anna" }),
      anmelden: async (benutzer, passwort) => {
        expect(benutzer).toBe("anna");
        expect(passwort).toBe("geheim");
        angemeldet = true;
        return { angemeldet: true, benutzername: "anna" };
      },
      abmelden: async () => {
        angemeldet = false;
      },
    };
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={adapter}
        bandAdapter={erstelleTestAdapter([{ id: "a", name: "Band A" }], async () => ({
          bandId: "a",
          songs: [],
        }))}
      />,
    );
    fireEvent.change(await screen.findByLabelText("Benutzername"), {
      target: { value: "anna" },
    });
    fireEvent.change(screen.getByLabelText("Passwort"), { target: { value: "geheim" } });
    fireEvent.click(screen.getByRole("button", { name: "Anmelden" }));

    expect(await screen.findByLabelText("Band")).toBeInTheDocument();
    expect(screen.getByText(/Angemeldet als anna/)).toBeInTheDocument();
  });

  it("zeigt die Anmeldung bei falschen Zugangsdaten erneut", async () => {
    const adapter: SessionAdapter = {
      ladeSitzung: async () => ({ angemeldet: false }),
      anmelden: async () => {
        throw new ApiFehler(400, "bad_request");
      },
      abmelden: async () => {},
    };
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={adapter}
      />,
    );
    fireEvent.change(await screen.findByLabelText("Benutzername"), {
      target: { value: "anna" },
    });
    fireEvent.change(screen.getByLabelText("Passwort"), { target: { value: "falsch" } });
    fireEvent.click(screen.getByRole("button", { name: "Anmelden" }));
    expect(
      await screen.findByText("Die Anfrage wurde abgelehnt. Bitte Eingaben prüfen."),
    ).toBeInTheDocument();
  });

  it("lädt vor einem Klick keine Hub-Ressourcen", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue({
          ...KONFIGURATION,
          communityUrl: "https://community.example",
        })}
        sessionAdapter={sitzungAdapter(false)}
      />,
    );
    const link = await screen.findByRole("link", { name: "Community" });
    expect(link).toHaveAttribute("href", "https://community.example");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("zeigt einen wiederholbaren Serverfehler ohne interne Details", async () => {
    const laden = vi.fn().mockRejectedValue(new ApiFehler(500, "server"));
    render(<App konfigurationLaden={laden} />);
    expect(
      await screen.findByText("Serverfehler. Bitte erneut versuchen."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    await waitFor(() => expect(laden).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("Traceback")).not.toBeInTheDocument();
  });

  it("zeigt fehlende Berechtigung bei 403", async () => {
    const adapter = erstelleTestAdapter([{ id: "a", name: "Band A" }], async () => {
      throw new ApiFehler(403, "forbidden");
    });
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={adapter}
      />,
    );
    expect(await screen.findByText("Fehlende Berechtigung.")).toBeInTheDocument();
  });

  it("kennzeichnet einen noch fehlenden Bereich statt eines Eingabefehlers", async () => {
    const adapter = erstelleTestAdapter([{ id: "a", name: "Band A" }], async () => {
      throw new ApiFehler(404, "not_found");
    });
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={adapter}
      />,
    );
    expect(await screen.findByText("Bereich noch nicht verfügbar.")).toBeInTheDocument();
  });

  it("aktualisiert die Ansicht bei der Zurück-Taste", async () => {
    const adapter = erstelleTestAdapter([{ id: "a", name: "Band A" }], async (bandId) => ({
      bandId,
      songs: [song("Song A")],
    }));
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={adapter}
      />,
    );
    expect(await screen.findByText("Song A")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Songs" }));
    expect(screen.getByText("Bereich /songs")).toBeInTheDocument();

    act(() => {
      window.history.replaceState({}, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByText("Bereich /")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("zeigt Verbindungsverlust getrennt vom Serverfehler", async () => {
    const adapter = erstelleTestAdapter([{ id: "a", name: "Band A" }], async () => {
      throw new ApiFehler(0, "network");
    });
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={adapter}
      />,
    );
    expect(await screen.findByText("Keine Verbindung zum Server.")).toBeInTheDocument();
  });

  it("führt bei 401 in den Anmeldezustand", async () => {
    const adapter = erstelleTestAdapter([{ id: "a", name: "Band A" }], async () => {
      throw new ApiFehler(401, "unauthenticated");
    });
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={adapter}
      />,
    );
    expect(await screen.findByText("Anmeldung erforderlich")).toBeInTheDocument();
  });

  it("wechselt Bands ohne alte Daten und ohne späte Antwort", async () => {
    const b = verzögert<BandDaten>();
    const adapter = erstelleTestAdapter(
      [
        { id: "a", name: "Band A" },
        { id: "b", name: "Band B" },
      ],
      async (bandId) => {
        if (bandId === "a") {
          return { bandId: "a", songs: [song("Song A")] };
        }
        return b.promise;
      },
    );
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={adapter}
      />,
    );
    expect(await screen.findByText("Song A")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Band"), { target: { value: "b" } });
    expect(screen.queryByText("Song A")).not.toBeInTheDocument();

    await act(async () => {
      b.aufloesen({ bandId: "b", songs: [song("Song B", { id: 2 })] });
    });
    expect(await screen.findByText("Song B")).toBeInTheDocument();
    expect(screen.queryByText("Song A")).not.toBeInTheDocument();
  });

  it("legt eine Band an und zeigt sie als Auswahl", async () => {
    const liste: Band[] = [];
    const adapter = erstelleTestAdapter([], async (bandId) => ({ bandId, songs: [] }), {
      ladeBands: async () => liste,
      erstelleBand: async (name) => {
        const neu = { id: "neu", name };
        liste.push(neu);
        return neu;
      },
    });
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={adapter}
      />,
    );
    fireEvent.change(await screen.findByLabelText("Bandname"), {
      target: { value: "Neue Band" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Anlegen" }));
    expect(await screen.findByRole("option", { name: "Neue Band" })).toBeInTheDocument();
  });

  it("hält die Notizfelder je Abschnitt getrennt", async () => {
    const setlistAdapter = erstelleSetlistTestAdapter([]);
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
    fireEvent.change(await screen.findByLabelText("Neue Setlist"), {
      target: { value: "Hauptset" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Setlist anlegen" }));
    fireEvent.click(await screen.findByRole("button", { name: "Set hinzufügen" }));
    fireEvent.click(screen.getByRole("button", { name: "Set hinzufügen" }));

    const erstesFeld = screen.getByLabelText("Notiz für Abschnitt 1 (leer ergibt Pause)");
    const zweitesFeld = screen.getByLabelText("Notiz für Abschnitt 2 (leer ergibt Pause)");
    fireEvent.change(erstesFeld, { target: { value: "Capo 2" } });
    expect(erstesFeld).toHaveValue("Capo 2");
    expect(zweitesFeld).toHaveValue("");
  });
});
