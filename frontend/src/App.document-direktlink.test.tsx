import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { anmerkungTestAdapter } from "./annotations/testhelfer";
import { erstelleTestAdapter } from "./bands/bands";
import { dokumentTestAdapter, FakePdfViewer, testDokument, testVersion } from "./documents/testhelfer";
import { KONFIGURATION, sitzungAdapter } from "./test-helfer";

beforeEach(() => {
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function bandsMitZwei() {
  return erstelleTestAdapter(
    [
      { id: "a", name: "Band A" },
      { id: "b", name: "Band B" },
    ],
    async (bandId) => ({
      bandId,
      songs: [{ id: 1, title: "Abrissbirne" }],
    }),
  );
}

describe("PDF-Direktlink", () => {
  it("wählt die Band aus der URL und lädt deren Dokument", async () => {
    window.history.replaceState({}, "", "/songs/b/1/pdf");
    const lade = vi.fn(async () => testDokument([testVersion(1)], 1));
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={bandsMitZwei()}
        dokumentAdapter={dokumentTestAdapter(testDokument(), undefined, { lade })}
        anmerkungAdapter={anmerkungTestAdapter()}
        dokumentViewer={FakePdfViewer}
      />,
    );
    expect(await screen.findByText("Abrissbirne: PDF")).toBeInTheDocument();
    await waitFor(() => expect(lade).toHaveBeenCalledWith("b", 1));
    expect(screen.getByLabelText("Band")).toHaveValue("b");
  });

  it("verlässt beim manuellen Bandwechsel den PDF-Pfad nach /songs", async () => {
    window.history.replaceState({}, "", "/songs/b/1/pdf");
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={bandsMitZwei()}
        dokumentAdapter={dokumentTestAdapter(testDokument([testVersion(1)], 1))}
        anmerkungAdapter={anmerkungTestAdapter()}
        dokumentViewer={FakePdfViewer}
      />,
    );
    fireEvent.change(await screen.findByLabelText("Band"), { target: { value: "a" } });
    await waitFor(() => expect(window.location.pathname).toBe("/songs"));
  });

  it("meldet eine nicht sichtbare Band im Direktlink", async () => {
    window.history.replaceState({}, "", "/songs/fremd/1/pdf");
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={bandsMitZwei()}
        dokumentAdapter={dokumentTestAdapter(testDokument([testVersion(1)], 1))}
        anmerkungAdapter={anmerkungTestAdapter()}
        dokumentViewer={FakePdfViewer}
      />,
    );
    expect(
      await screen.findByText("Diese Band ist für dich nicht sichtbar."),
    ).toBeInTheDocument();
  });
});
