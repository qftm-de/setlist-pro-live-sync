import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { ApiFehler } from "./api/client";
import { erstelleTestAdapter, type BandDaten } from "./bands/bands";

const KONFIGURATION = {
  mode: "core" as const,
  instanceName: "Testinstanz",
  communityUrl: null,
};

function verzögert<T>() {
  let aufloesen!: (wert: T) => void;
  const promise = new Promise<T>((resolve) => {
    aufloesen = resolve;
  });
  return { promise, aufloesen };
}

beforeEach(() => {
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("zeigt ohne Session keine geschützten Inhalte", async () => {
    const bands = vi.fn();
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={{ ladeSitzung: async () => ({ angemeldet: false }) }}
        bandAdapter={{ ladeBands: bands, ladeBandDaten: vi.fn() }}
      />,
    );
    expect(await screen.findByText("Anmeldung erforderlich")).toBeInTheDocument();
    expect(screen.queryByLabelText("Band")).not.toBeInTheDocument();
    expect(screen.queryByText(/Angemeldet als/)).not.toBeInTheDocument();
    expect(bands).not.toHaveBeenCalled();
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
        sessionAdapter={{ ladeSitzung: async () => ({ angemeldet: false }) }}
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
    const adapter = erstelleTestAdapter(
      [{ id: "a", name: "Band A" }],
      async () => {
        throw new ApiFehler(403, "forbidden");
      },
    );
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={{ ladeSitzung: async () => ({ angemeldet: true, benutzername: "anna" }) }}
        bandAdapter={adapter}
      />,
    );
    expect(await screen.findByText("Fehlende Berechtigung.")).toBeInTheDocument();
  });

  it("kennzeichnet einen noch fehlenden Bereich statt eines Eingabefehlers", async () => {
    const adapter = erstelleTestAdapter(
      [{ id: "a", name: "Band A" }],
      async () => {
        throw new ApiFehler(404, "not_found");
      },
    );
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={{ ladeSitzung: async () => ({ angemeldet: true, benutzername: "anna" }) }}
        bandAdapter={adapter}
      />,
    );
    expect(await screen.findByText("Bereich noch nicht verfügbar.")).toBeInTheDocument();
  });

  it("aktualisiert die Ansicht bei der Zurück-Taste", async () => {
    const adapter = erstelleTestAdapter(
      [{ id: "a", name: "Band A" }],
      async (bandId) => ({ bandId, songs: ["Song A"] }),
    );
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={{ ladeSitzung: async () => ({ angemeldet: true, benutzername: "anna" }) }}
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
    const adapter = erstelleTestAdapter(
      [{ id: "a", name: "Band A" }],
      async () => {
        throw new ApiFehler(0, "network");
      },
    );
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={{ ladeSitzung: async () => ({ angemeldet: true, benutzername: "anna" }) }}
        bandAdapter={adapter}
      />,
    );
    expect(await screen.findByText("Keine Verbindung zum Server.")).toBeInTheDocument();
  });

  it("führt bei 401 in den Anmeldezustand", async () => {
    const adapter = erstelleTestAdapter(
      [{ id: "a", name: "Band A" }],
      async () => {
        throw new ApiFehler(401, "unauthenticated");
      },
    );
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={{ ladeSitzung: async () => ({ angemeldet: true, benutzername: "anna" }) }}
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
          return { bandId: "a", songs: ["Song A"] };
        }
        return b.promise;
      },
    );
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={{ ladeSitzung: async () => ({ angemeldet: true, benutzername: "anna" }) }}
        bandAdapter={adapter}
      />,
    );
    expect(await screen.findByText("Song A")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Band"), { target: { value: "b" } });
    expect(screen.queryByText("Song A")).not.toBeInTheDocument();

    await act(async () => {
      b.aufloesen({ bandId: "b", songs: ["Song B"] });
    });
    expect(await screen.findByText("Song B")).toBeInTheDocument();
    expect(screen.queryByText("Song A")).not.toBeInTheDocument();
  });
});
