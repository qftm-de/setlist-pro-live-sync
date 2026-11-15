import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { anmerkungTestAdapter } from "./annotations/testhelfer";
import { ApiFehler } from "./api/client";
import { erstelleTestAdapter } from "./bands/bands";
import {
  dokumentTestAdapter,
  FakePdfViewer,
  testDokument,
  testVersion,
} from "./documents/testhelfer";
import { KONFIGURATION, sitzungAdapter } from "./test-helfer";

beforeEach(() => {
  window.history.replaceState({}, "", "/songs/a/1/pdf");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function app(adapter = dokumentTestAdapter(testDokument([testVersion(1)], 1))) {
  return render(
    <App
      konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
      sessionAdapter={sitzungAdapter()}
      bandAdapter={erstelleTestAdapter([{ id: "a", name: "Band A" }], async (bandId) => ({
        bandId,
        songs: [{ id: 1, title: "Abrissbirne" }],
      }))}
      dokumentAdapter={adapter}
      anmerkungAdapter={anmerkungTestAdapter()}
      dokumentViewer={FakePdfViewer}
    />,
  );
}

describe("Song-PDF", () => {
  it("öffnet die aktive Version per Direktlink und rendert die Seite", async () => {
    app();
    expect(await screen.findByText("Abrissbirne: PDF")).toBeInTheDocument();
    expect(await screen.findByTestId("pdf-viewer")).toHaveTextContent("PDF-Seite mit 4 Bytes");
    expect(screen.getByRole("button", { name: "Version 1 ist aktiv" })).toBeDisabled();
    expect(screen.getByText(/Originaldownload enthält keine Anmerkungen/)).toBeInTheDocument();
  });

  it("zeigt den Leerzustand und lädt eine neue Version hoch, ohne sie zu aktivieren", async () => {
    const adapter = dokumentTestAdapter(testDokument([]));
    app(adapter);
    expect(
      await screen.findByText("Für diesen Song ist noch keine PDF hinterlegt."),
    ).toBeInTheDocument();
    const datei = new File(["%PDF-1.7"], "partitur.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("PDF-Datei"), { target: { files: [datei] } });
    fireEvent.click(screen.getByRole("button", { name: "PDF hochladen" }));
    expect(
      await screen.findByText(/Version 1 gespeichert. Die aktive Version wurde nicht automatisch geändert./),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Als aktive Version wählen" }),
    ).toBeInTheDocument();
  });

  it("aktiviert eine neue Version erst über den separaten Schritt", async () => {
    const adapter = dokumentTestAdapter(testDokument([]));
    const aktiviere = vi.spyOn(adapter, "aktiviere");
    app(adapter);
    const datei = new File(["%PDF-1.7"], "partitur.pdf", { type: "application/pdf" });
    fireEvent.change(await screen.findByLabelText("PDF-Datei"), {
      target: { files: [datei] },
    });
    fireEvent.click(screen.getByRole("button", { name: "PDF hochladen" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Als aktive Version wählen" }),
    );
    await waitFor(() => expect(aktiviere).toHaveBeenCalledWith("a", 1, 0, 1));
    expect(
      await screen.findByRole("button", { name: "Version 1 ist aktiv" }),
    ).toBeInTheDocument();
  });

  it("wechselt die Ansicht zwischen Versionen, ohne die aktive Auswahl zu ändern", async () => {
    const adapter = dokumentTestAdapter(
      testDokument([testVersion(1), testVersion(2)], 1),
    );
    app(adapter);
    fireEvent.click(await screen.findByRole("button", { name: "Version 2 ansehen" }));
    expect(
      await screen.findByRole("button", { name: "Version 2 ansehen", pressed: true }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Version 1 ist aktiv" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Version 2 aktivieren" }),
    ).toBeInTheDocument();
  });

  it("meldet eine unbekannte Direktversion sichtbar und zeigt eine verfügbare", async () => {
    window.history.replaceState({}, "", "/songs/a/1/pdf/versions/99");
    app(dokumentTestAdapter(testDokument([testVersion(1)], 1)));
    expect(
      await screen.findByText(
        "Diese Version existiert nicht. Es wird eine verfügbare Version angezeigt.",
      ),
    ).toBeInTheDocument();
    expect(await screen.findByTestId("pdf-viewer")).toBeInTheDocument();
  });

  it("führt einen 401 beim Dokument zurück zur Anmeldung", async () => {
    const adapter = dokumentTestAdapter(testDokument([testVersion(1)], 1), undefined, {
      lade: vi.fn().mockRejectedValue(new ApiFehler(401, "unauthenticated")),
    });
    app(adapter);
    expect(await screen.findByText("Anmeldung erforderlich")).toBeInTheDocument();
  });

  it("meldet einen gelöschten Song sichtbar", async () => {
    const adapter = dokumentTestAdapter(testDokument([testVersion(1)], 1), undefined, {
      lade: vi.fn().mockRejectedValue(new ApiFehler(404, "not_found")),
    });
    app(adapter);
    expect(
      await screen.findByText("Dieser Song oder sein Dokument ist nicht sichtbar."),
    ).toBeInTheDocument();
  });

  it("behält den Upload-Entwurf bei unklarem Ausgang und gleicht nur ab", async () => {
    const hochladen = vi.fn().mockRejectedValue(new ApiFehler(0, "network"));
    const ladeUpload = vi.fn().mockResolvedValue([]);
    const adapter = dokumentTestAdapter(testDokument([]), undefined, {
      hochladen,
      ladeUpload,
    });
    app(adapter);
    const datei = new File(["%PDF-1.7"], "partitur.pdf", { type: "application/pdf" });
    fireEvent.change(await screen.findByLabelText("PDF-Datei"), {
      target: { files: [datei] },
    });
    fireEvent.click(screen.getByRole("button", { name: "PDF hochladen" }));
    expect(await screen.findByText(/Der Upload ist unklar/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Upload abgleichen" }));
    await waitFor(() => expect(ladeUpload).toHaveBeenCalledTimes(1));
    expect(hochladen).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText(/Noch keine Version gefunden/),
    ).toBeInTheDocument();
  });
});
