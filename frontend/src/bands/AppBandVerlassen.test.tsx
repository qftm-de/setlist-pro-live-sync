import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { erstelleTestAdapter, type Band } from "./bands";
import {
  MITGLIED_TEST,
  erstelleVerwaltungTestAdapter,
} from "./verwaltung.testhelfer";
import { KONFIGURATION, sitzungAdapter, song, verzögert } from "../test-helfer";

const BAND_A: Band = { id: "a", name: "Verlassene Band", role: "member", can_manage: false };
const BAND_B: Band = { id: "b", name: "Neue Band", role: "member", can_manage: false };
const BAND_C: Band = { id: "c", name: "Dritte Band", role: "member", can_manage: false };

afterEach(() => {
  window.history.pushState({}, "", "/");
  vi.restoreAllMocks();
});

describe("App Band-Austritt und Einladungsbeitritt", () => {
  it("räumt eine verlassene Band sofort, auch wenn das Nachladen der Bandliste scheitert", async () => {
    window.history.pushState({}, "", "/band");
    const ladeBands = vi
      .fn<() => Promise<Band[]>>()
      .mockResolvedValueOnce([BAND_A])
      .mockRejectedValueOnce(new Error("Listenfehler"));
    const bandAdapter = erstelleTestAdapter(
      [BAND_A],
      async (bandId) => ({
        bandId,
        songs: [song("Alter Bandsong")],
        band: BAND_A,
      }),
      { ladeBands },
    );
    const verwaltung = erstelleVerwaltungTestAdapter({
      ladeMitglieder: async () => MITGLIED_TEST,
      entferneMitglied: vi.fn().mockResolvedValue(undefined),
    });
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={bandAdapter}
        verwaltungAdapter={verwaltung}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Austreten" }));
    fireEvent.click(screen.getByRole("button", { name: "Ja, austreten" }));

    await waitFor(() =>
      expect(screen.queryByText("Alter Bandsong")).not.toBeInTheDocument(),
    );
    expect(screen.queryByText("Verlassene Band")).not.toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unerwartete Antwort des Servers.",
    );
  });

  it("behält die neue Band nach Einladungsbeitritt trotz spätem Fehler des Startabrufs", async () => {
    window.history.pushState({}, "", "/einladung/token-abc");
    const startListe = verzögert<Band[]>();
    const ladeBands = vi
      .fn<() => Promise<Band[]>>()
      .mockReturnValueOnce(startListe.promise)
      .mockResolvedValueOnce([BAND_B]);
    const bandAdapter = erstelleTestAdapter(
      [BAND_B],
      async (bandId) => ({ bandId, songs: [song("Neuer Bandsong")], band: BAND_B }),
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

    fireEvent.click(
      await screen.findByRole("button", { name: "Band beitreten" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Neue Band" }),
    ).toBeInTheDocument();

    await act(async () => {
      startListe.ablehnen(new Error("Alter Startfehler"));
      await Promise.resolve();
    });

    expect(
      screen.getByRole("heading", { name: "Neue Band" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Unerwartete Antwort des Servers/),
    ).not.toBeInTheDocument();
  });

  it("lässt eine inzwischen gewählte Band bei verspäteter Austrittsantwort aktiv", async () => {
    window.history.pushState({}, "", "/band");
    const austritt = verzögert<void>();
    const ladeBands = vi
      .fn<() => Promise<Band[]>>()
      .mockResolvedValueOnce([BAND_A, BAND_B])
      .mockResolvedValueOnce([BAND_B]);
    const bandAdapter = erstelleTestAdapter(
      [BAND_A, BAND_B],
      async (bandId) => ({
        bandId,
        songs: [song(bandId === "a" ? "Song A" : "Song B")],
        band: bandId === "a" ? BAND_A : BAND_B,
      }),
      { ladeBands },
    );
    const verwaltung = erstelleVerwaltungTestAdapter({
      ladeMitglieder: async () => MITGLIED_TEST,
      entferneMitglied: vi.fn(() => austritt.promise),
    });
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={bandAdapter}
        verwaltungAdapter={verwaltung}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Austreten" }));
    fireEvent.click(screen.getByRole("button", { name: "Ja, austreten" }));

    fireEvent.change(screen.getByLabelText("Band"), { target: { value: "b" } });
    expect(
      await screen.findByRole("heading", { name: "Neue Band" }),
    ).toBeInTheDocument();

    await act(async () => {
      austritt.aufloesen(undefined);
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(
        screen.queryByRole("option", { name: "Verlassene Band" }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("heading", { name: "Neue Band" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/band");
  });

  it("zeigt eine verlassene Band nach fehlgeschlagenem Listenabruf beim Bandwechsel nicht wieder an", async () => {
    window.history.pushState({}, "", "/band");
    const ladeBands = vi
      .fn<() => Promise<Band[]>>()
      .mockResolvedValueOnce([BAND_A, BAND_B, BAND_C])
      .mockRejectedValueOnce(new Error("Listenfehler"));
    const bandAdapter = erstelleTestAdapter(
      [BAND_A, BAND_B, BAND_C],
      async (bandId) => ({
        bandId,
        songs: [],
        band: bandId === "a" ? BAND_A : bandId === "b" ? BAND_B : BAND_C,
      }),
      { ladeBands },
    );
    const verwaltung = erstelleVerwaltungTestAdapter({
      ladeMitglieder: async () => MITGLIED_TEST,
      entferneMitglied: vi.fn().mockResolvedValue(undefined),
    });
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={bandAdapter}
        verwaltungAdapter={verwaltung}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Austreten" }));
    fireEvent.click(screen.getByRole("button", { name: "Ja, austreten" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("option", { name: "Verlassene Band" }),
      ).not.toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText("Band"), { target: { value: "c" } });
    expect(
      await screen.findByRole("heading", { name: "Dritte Band" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Verlassene Band" }),
    ).not.toBeInTheDocument();
  });
});
