import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { erstelleTestAdapter, type Band } from "./bands";
import { EinladungenBereich } from "./EinladungenBereich";
import {
  EINLADUNG_TEST,
  OWNER_TEST,
  erstelleVerwaltungTestAdapter,
} from "./verwaltung.testhelfer";
import { KONFIGURATION, sitzungAdapter, song, verzögert } from "../test-helfer";

const BAND_A: Band = { id: "a", name: "Band A", role: "owner", can_manage: true };
const BAND_B: Band = { id: "b", name: "Neue Band", role: "owner", can_manage: true };

afterEach(() => {
  window.history.pushState({}, "", "/");
  vi.restoreAllMocks();
});

describe("Band anlegen und später Einladungsbeitritt", () => {
  it("erzeugt bei fehlgeschlagenem Listenabruf nach Bandanlage keine zweite Band", async () => {
    window.history.pushState({}, "", "/band");
    const erstelleBand = vi.fn().mockResolvedValue(BAND_B);
    const ladeBands = vi
      .fn<() => Promise<Band[]>>()
      .mockResolvedValueOnce([BAND_A])
      .mockRejectedValueOnce(new Error("Listenfehler"))
      .mockResolvedValueOnce([BAND_A, BAND_B]);
    const bandAdapter = erstelleTestAdapter(
      [BAND_A],
      async (bandId) => ({
        bandId,
        songs: [],
        band: bandId === "a" ? BAND_A : BAND_B,
      }),
      { ladeBands, erstelleBand },
    );
    const verwaltung = erstelleVerwaltungTestAdapter({
      ladeMitglieder: async () => OWNER_TEST,
      ladeEinladungen: async () => [],
    });
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={bandAdapter}
        verwaltungAdapter={verwaltung}
      />,
    );

    const feld = await screen.findByLabelText("Bandname");
    fireEvent.change(feld, { target: { value: "Neue Band" } });
    fireEvent.click(screen.getByRole("button", { name: "Anlegen" }));

    expect(
      await screen.findByText(/Band „Neue Band“ wurde angelegt/),
    ).toBeInTheDocument();
    expect(erstelleBand).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", { name: "Bandliste erneut laden" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Neue Band" }),
    ).toBeInTheDocument();
    expect(erstelleBand).toHaveBeenCalledTimes(1);
    expect(ladeBands).toHaveBeenCalledTimes(3);
  });

  it("überschreibt eine neue Navigation bei verzögertem Einladungs-POST nicht", async () => {
    window.history.pushState({}, "", "/einladung/token-abc");
    const beitritt = verzögert<{ band: { id: string; name: string }; joined: boolean }>();
    const ladeBands = vi
      .fn<() => Promise<Band[]>>()
      .mockResolvedValueOnce([BAND_A])
      .mockResolvedValueOnce([BAND_A, BAND_B]);
    const bandAdapter = erstelleTestAdapter(
      [BAND_A],
      async (bandId) => ({
        bandId,
        songs: [
          song(bandId === "a" ? "Song aus Band A" : "Song aus Band B", {
            id: bandId === "a" ? 1 : 2,
          }),
        ],
        band: bandId === "a" ? BAND_A : BAND_B,
      }),
      { ladeBands },
    );
    const verwaltung = erstelleVerwaltungTestAdapter({
      pruefeEinladung: async () => ({
        band_name: "Neue Band",
        expires_at: "2026-11-24T12:00:00+00:00",
        authenticated: true,
        already_member: false,
      }),
      akzeptiereEinladung: vi.fn(() => beitritt.promise),
    });
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={bandAdapter}
        verwaltungAdapter={verwaltung}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Band beitreten" }));
    fireEvent.click(screen.getByRole("link", { name: "Songs" }));
    expect(await screen.findByText("Song aus Band A")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/songs");

    await act(async () => {
      beitritt.aufloesen({ band: { id: "b", name: "Neue Band" }, joined: true });
      await Promise.resolve();
    });

    await waitFor(() => expect(ladeBands).toHaveBeenCalledTimes(2));
    expect(window.location.pathname).toBe("/songs");
    expect(screen.getByRole("heading", { name: "Band A" })).toBeInTheDocument();
    expect(screen.getByText("Song aus Band A")).toBeInTheDocument();
    expect(screen.queryByText("Song aus Band B")).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Neue Band" })).toBeInTheDocument();
  });

  it("überschreibt aktive Band und Navigation bei verzögertem Listenabruf nach Beitritt nicht", async () => {
    window.history.pushState({}, "", "/einladung/token-abc");
    const folgeListe = verzögert<Band[]>();
    const ladeBands = vi
      .fn<() => Promise<Band[]>>()
      .mockResolvedValueOnce([BAND_A])
      .mockReturnValueOnce(folgeListe.promise);
    const bandAdapter = erstelleTestAdapter(
      [BAND_A],
      async (bandId) => ({
        bandId,
        songs: [
          song(bandId === "a" ? "Song aus Band A" : "Song aus Band B", {
            id: bandId === "a" ? 1 : 2,
          }),
        ],
        band: bandId === "a" ? BAND_A : BAND_B,
      }),
      { ladeBands },
    );
    const verwaltung = erstelleVerwaltungTestAdapter({
      pruefeEinladung: async () => ({
        band_name: "Neue Band",
        expires_at: "2026-11-24T12:00:00+00:00",
        authenticated: true,
        already_member: false,
      }),
      akzeptiereEinladung: vi.fn().mockResolvedValue({
        band: { id: "b", name: "Neue Band" },
        joined: true,
      }),
    });
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={bandAdapter}
        verwaltungAdapter={verwaltung}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Band beitreten" }));
    await waitFor(() => expect(ladeBands).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("link", { name: "Songs" }));
    expect(await screen.findByText("Song aus Band A")).toBeInTheDocument();

    await act(async () => {
      folgeListe.aufloesen([BAND_A, BAND_B]);
      await Promise.resolve();
    });

    expect(window.location.pathname).toBe("/songs");
    expect(screen.getByRole("heading", { name: "Band A" })).toBeInTheDocument();
    expect(screen.getByText("Song aus Band A")).toBeInTheDocument();
    expect(screen.queryByText("Song aus Band B")).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Neue Band" })).toBeInTheDocument();
  });

  it("sperrt den Widerrufsknopf während des Aufrufs und leert den Einmal-Link", async () => {
    const widerruf = verzögert<typeof EINLADUNG_TEST>();
    const onWiderrufen = vi.fn(() => widerruf.promise);
    const erstellt = {
      ...EINLADUNG_TEST,
      token: "geheimtoken-123",
      invite_path: "/einladung/geheimtoken-123",
    };
    render(
      <EinladungenBereich
        einladungen={[EINLADUNG_TEST]}
        onErstellen={vi.fn().mockResolvedValue(erstellt)}
        onWiderrufen={onWiderrufen}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "48-Stunden-Link erstellen" }),
    );
    expect(
      await screen.findByText(/Link einmalig kopieren/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Widerrufen" }));
    fireEvent.click(screen.getByRole("button", { name: "Ja, widerrufen" }));
    expect(screen.getByRole("button", { name: "Widerruft …" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Abbrechen" })).toBeDisabled();

    await act(async () => {
      widerruf.aufloesen({ ...EINLADUNG_TEST, status: "revoked" });
      await Promise.resolve();
    });

    expect(screen.queryByText(/Link einmalig kopieren/)).not.toBeInTheDocument();
    expect(onWiderrufen).toHaveBeenCalledTimes(1);
  });
});
