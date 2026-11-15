import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { ApiFehler } from "./api/client";
import { erstelleTestAdapter } from "./bands/bands";
import { bandAdapterMitSongs, KONFIGURATION, sitzungAdapter, song } from "./test-helfer";

beforeEach(() => {
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("zeigt den Speicherzustand am Songformular", async () => {
    const adapter = bandAdapterMitSongs([]);
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={adapter}
      />,
    );
    fireEvent.change(await screen.findByLabelText("Titel"), {
      target: { value: "Abrissbirne" },
    });
    expect(screen.getByRole("status")).toHaveAttribute("data-zustand", "entwurf");
    fireEvent.click(screen.getByRole("button", { name: "Song hinzufügen" }));
    expect(await screen.findByText("Gespeichert")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("data-zustand", "gespeichert");
  });

  it("legt einen Song an und zeigt ihn ohne Neuladen", async () => {
    const adapter = bandAdapterMitSongs([]);
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={adapter}
      />,
    );
    expect(await screen.findByText("Keine Songs in dieser Band.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Titel"), { target: { value: "Abrissbirne" } });
    fireEvent.change(screen.getByLabelText("BPM"), { target: { value: "128" } });
    fireEvent.change(screen.getByLabelText("Notiz"), {
      target: { value: "Capo 2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Song hinzufügen" }));
    expect(await screen.findByText("Abrissbirne")).toBeInTheDocument();
    expect(screen.getByText("128 BPM")).toBeInTheDocument();
    expect(screen.getByText("Capo 2")).toBeInTheDocument();
  });

  it("führt bei abgelaufener Session im Songformular zur Anmeldung", async () => {
    const adapter = erstelleTestAdapter(
      [{ id: "a", name: "Band A" }],
      async (bandId) => ({ bandId, songs: [] }),
      {
        erstelleSong: async () => {
          throw new ApiFehler(401, "unauthenticated");
        },
      },
    );
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={adapter}
      />,
    );
    fireEvent.change(await screen.findByLabelText("Titel"), {
      target: { value: "Abrissbirne" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Song hinzufügen" }));
    expect(await screen.findByText("Anmeldung erforderlich")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Song hinzufügen" })).not.toBeInTheDocument();
  });

  it("ändert einen Song ohne Neuladen", async () => {
    const adapter = bandAdapterMitSongs([song("Abrissbirne", { id: 1 })]);
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={adapter}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Abrissbirne ändern" }));
    fireEvent.change(screen.getByLabelText("Titel (ändern)"), {
      target: { value: "Abrissbirne (neu)" },
    });
    fireEvent.change(screen.getByLabelText("BPM (ändern)"), { target: { value: "120" } });
    fireEvent.click(screen.getByRole("button", { name: "Änderung speichern" }));
    expect(await screen.findByText("Abrissbirne (neu)")).toBeInTheDocument();
    expect(screen.getByText("120 BPM")).toBeInTheDocument();
  });

  it("zeigt einen abgelehnten Song als Fehler am Formular", async () => {
    const adapter = erstelleTestAdapter(
      [{ id: "a", name: "Band A" }],
      async (bandId) => ({ bandId, songs: [] }),
      {
        erstelleSong: async () => {
          throw new ApiFehler(400, "bad_request");
        },
      },
    );
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={adapter}
      />,
    );
    fireEvent.change(await screen.findByLabelText("Titel"), {
      target: { value: "Abrissbirne" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Song hinzufügen" }));
    expect(
      await screen.findByText("Die Anfrage wurde abgelehnt. Bitte Eingaben prüfen."),
    ).toBeInTheDocument();
  });

  it("behält Eingaben beim Löschen eines Songs", async () => {
    const adapter = bandAdapterMitSongs([song("Erster", { id: 1 })]);
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={adapter}
      />,
    );
    fireEvent.change(await screen.findByLabelText("Titel"), {
      target: { value: "Neuer Titel" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Erster löschen" }));
    await waitFor(() => expect(screen.queryByText("Erster")).not.toBeInTheDocument());
    expect(screen.getByLabelText("Titel")).toHaveValue("Neuer Titel");
  });

  it("behält die Ansicht, wenn das Nachladen scheitert", async () => {
    let aufrufe = 0;
    const songs = [song("Erster", { id: 1 })];
    const adapter = erstelleTestAdapter(
      [{ id: "a", name: "Band A" }],
      async (bandId) => {
        aufrufe += 1;
        if (aufrufe > 1) {
          throw new ApiFehler(500, "server");
        }
        return { bandId, songs };
      },
      {
        loescheSong: async () => {},
      },
    );
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={adapter}
      />,
    );
    fireEvent.change(await screen.findByLabelText("Titel"), {
      target: { value: "Neuer Titel" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Erster löschen" }));

    await waitFor(() => expect(aufrufe).toBe(2));
    expect(screen.getByRole("heading", { name: "Songs" })).toBeInTheDocument();
    expect(screen.getByLabelText("Titel")).toHaveValue("Neuer Titel");
  });
});
