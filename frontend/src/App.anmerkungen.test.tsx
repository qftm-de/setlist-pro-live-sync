import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PageViewport } from "pdfjs-dist";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { PdfAnmerkungsEbene } from "./annotations/PdfAnmerkungsEbene";
import { ApiFehler } from "./api/client";
import { anmerkungTestAdapter, testAnmerkung } from "./annotations/testhelfer";
import { erstelleTestAdapter } from "./bands/bands";
import {
  dokumentTestAdapter,
  FakePdfViewerMitWerkzeug,
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

function app(
  anmerkungen = anmerkungTestAdapter(),
  dokument = testDokument([testVersion(1), testVersion(2)], 1),
) {
  return render(
    <App
      konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
      sessionAdapter={sitzungAdapter()}
      bandAdapter={erstelleTestAdapter([{ id: "a", name: "Band A" }], async (bandId) => ({
        bandId,
        songs: [{ id: 1, title: "Abrissbirne" }],
      }))}
      dokumentAdapter={dokumentTestAdapter(dokument)}
      anmerkungAdapter={anmerkungen}
      dokumentViewer={FakePdfViewerMitWerkzeug}
    />,
  );
}

describe("Anmerkungen", () => {
  it("zeigt Ebenen getrennt und blendet sie aus", async () => {
    const adapter = anmerkungTestAdapter([
      testAnmerkung({ id: 1, text: "Eigener Text" }),
      testAnmerkung({
        id: 2,
        text: "Bandtext",
        visibility: "band",
        can_edit: false,
        can_delete: true,
      }),
    ]);
    app(adapter);
    await screen.findByTestId("pdf-viewer");
    expect(await screen.findByText(/2 Anmerkungen/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Eigene persönliche Anmerkungen anzeigen"));
    expect(await screen.findByText(/1 Anmerkungen/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Bandweite Anmerkungen anzeigen"));
    expect(await screen.findByText(/0 Anmerkungen/)).toBeInTheDocument();
  });

  it("legt einen Marker an", async () => {
    const adapter = anmerkungTestAdapter();
    const erstelle = vi.spyOn(adapter, "erstelle");
    app(adapter);
    await screen.findByTestId("pdf-viewer");
    fireEvent.click(screen.getByRole("button", { name: "Marker zeichnen" }));
    fireEvent.click(screen.getByRole("button", { name: "Marker anlegen" }));
    await waitFor(() => expect(erstelle).toHaveBeenCalledTimes(1));
    expect(erstelle.mock.calls[0][3]).toMatchObject({
      kind: "marker",
      visibility: "private",
      color: "gelb",
      text: "",
      font_size: null,
    });
    expect(await screen.findByText(/1 Anmerkungen/)).toBeInTheDocument();
  });

  it("legt Text ohne Zeigegerät über die Schaltfläche an", async () => {
    const adapter = anmerkungTestAdapter();
    const erstelle = vi.spyOn(adapter, "erstelle");
    app(adapter);
    await screen.findByTestId("pdf-viewer");
    fireEvent.click(screen.getByRole("button", { name: "Neue Textanmerkung" }));
    fireEvent.change(await screen.findByLabelText("Text"), {
      target: { value: "Per Tastatur" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Anmerkung speichern" }));
    await waitFor(() => expect(erstelle).toHaveBeenCalledTimes(1));
    expect(erstelle.mock.calls[0][3]).toMatchObject({
      kind: "text",
      page_number: 1,
      text: "Per Tastatur",
      visibility: "private",
    });
  });

  it("platziert einen Text, teilt ihn und zeigt den Hinweis", async () => {
    const adapter = anmerkungTestAdapter();
    const erstelle = vi.spyOn(adapter, "erstelle");
    app(adapter);
    await screen.findByTestId("pdf-viewer");
    fireEvent.click(screen.getByRole("button", { name: "Text setzen" }));
    fireEvent.click(screen.getByRole("button", { name: "Text platzieren" }));
    expect(await screen.findByTestId("pdf-entwurf-vorschau")).toHaveTextContent(
      "Entwurf auf Seite 1",
    );
    fireEvent.change(await screen.findByLabelText("Text"), {
      target: { value: "Leiser im Refrain" },
    });
    fireEvent.change(screen.getByLabelText("Sichtbarkeit"), {
      target: { value: "band" },
    });
    expect(
      screen.getByText(/Alle aktuellen Bandmitglieder sehen diesen Inhalt/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Anmerkung speichern" }));
    await waitFor(() => expect(erstelle).toHaveBeenCalledTimes(1));
    expect(erstelle.mock.calls[0][3]).toMatchObject({
      kind: "text",
      visibility: "band",
      text: "Leiser im Refrain",
      page_number: 1,
    });
    expect(
      await screen.findByRole("button", { name: /Leiser im Refrain/ }),
    ).toBeInTheDocument();
  });

  it("bearbeitet eine eigene Anmerkung", async () => {
    const adapter = anmerkungTestAdapter([testAnmerkung()]);
    const aendere = vi.spyOn(adapter, "aendere");
    app(adapter);
    await screen.findByTestId("pdf-viewer");
    fireEvent.click(await screen.findByRole("button", { name: /Leiser/ }));
    fireEvent.change(screen.getByLabelText("Text"), {
      target: { value: "Lauter" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Anmerkung speichern" }));
    await waitFor(() => expect(aendere).toHaveBeenCalledTimes(1));
    expect(aendere.mock.calls[0][4]).toBe(0);
    expect(await screen.findByRole("button", { name: /Lauter/ })).toBeInTheDocument();
  });

  it("zeigt bandweite Fremdanmerkung nur lesend, Owner darf löschen", async () => {
    const band = testAnmerkung({
      id: 2,
      text: "Geteilt",
      visibility: "band",
      can_edit: false,
      can_delete: true,
    });
    const adapter = anmerkungTestAdapter([band]);
    const loesche = vi.spyOn(adapter, "loesche");
    app(adapter);
    await screen.findByTestId("pdf-viewer");
    fireEvent.click(await screen.findByRole("button", { name: /Geteilt/ }));
    expect(screen.getByLabelText("Anmerkung lesen")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Anmerkung speichern" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Anmerkung löschen" }));
    fireEvent.click(screen.getByRole("button", { name: "Löschen bestätigen" }));
    await waitFor(() => expect(loesche).toHaveBeenCalledWith("a", 1, 1, 2, 0));
  });

  it("behält den Entwurf bei Konflikt und bietet Serverstand an", async () => {
    const adapter = anmerkungTestAdapter([testAnmerkung()], {
      aendere: vi.fn().mockRejectedValue(new ApiFehler(409, "conflict")),
    });
    app(adapter);
    await screen.findByTestId("pdf-viewer");
    fireEvent.click(await screen.findByRole("button", { name: /Leiser/ }));
    fireEvent.change(screen.getByLabelText("Text"), {
      target: { value: "Mein Entwurf" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Anmerkung speichern" }));
    expect(
      await screen.findByText(/Der Stand wurde inzwischen geändert/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Text")).toHaveValue("Mein Entwurf");
    expect(
      screen.getByRole("button", { name: "Serverstand neu laden" }),
    ).toBeInTheDocument();
  });

  it("schützt den Entwurf vor Versionswechsel und verwirft ihn bewusst", async () => {
    app();
    await screen.findByTestId("pdf-viewer");
    fireEvent.click(screen.getByRole("button", { name: "Text setzen" }));
    fireEvent.click(screen.getByRole("button", { name: "Text platzieren" }));
    fireEvent.click(await screen.findByRole("button", { name: "Version 2 ansehen" }));
    expect(
      await screen.findByRole("dialog", { name: "Ungespeicherter Entwurf" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Wechsel abbrechen" }));
    expect(
      screen.queryByRole("dialog", { name: "Ungespeicherter Entwurf" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Version 1 ansehen", pressed: true }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Version 2 ansehen" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Entwurf verwerfen und wechseln" }),
    );
    expect(
      await screen.findByRole("button", { name: "Version 2 ansehen", pressed: true }),
    ).toBeInTheDocument();
  });

  it("schützt den Entwurf vor Navigation und Seitenwechsel", async () => {
    app();
    await screen.findByTestId("pdf-viewer");
    fireEvent.click(screen.getByRole("button", { name: "Text setzen" }));
    fireEvent.click(screen.getByRole("button", { name: "Text platzieren" }));
    fireEvent.click(screen.getByRole("link", { name: "Setlists" }));
    expect(
      await screen.findByRole("dialog", { name: "Ungespeicherter Entwurf" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/songs/a/1/pdf");
    fireEvent.click(screen.getByRole("button", { name: "Wechsel abbrechen" }));

    fireEvent.click(screen.getByRole("button", { name: "Nächste Seite versuchen" }));
    expect(
      await screen.findByRole("dialog", { name: "Ungespeicherter Entwurf" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Entwurf verwerfen und wechseln" }),
    );
    expect(
      screen.queryByRole("dialog", { name: "Ungespeicherter Entwurf" }),
    ).not.toBeInTheDocument();
  });

  it("fängt Browser-Zurück bei offenem Entwurf ab", async () => {
    app();
    await screen.findByTestId("pdf-viewer");
    fireEvent.click(screen.getByRole("button", { name: "Neue Textanmerkung" }));
    fireEvent.change(await screen.findByLabelText("Text"), {
      target: { value: "Nicht verlieren" },
    });
    const vorher = window.location.pathname;
    window.history.pushState({}, "", "/setlists");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(
      await screen.findByRole("dialog", { name: "Ungespeicherter Entwurf" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe(vorher);
    fireEvent.click(
      screen.getByRole("button", { name: "Entwurf verwerfen und wechseln" }),
    );
    await waitFor(() => expect(window.location.pathname).toBe("/setlists"));
  });

  it("leitet bei 401 beim Laden der Anmerkungen zur Anmeldung", async () => {
    const adapter = anmerkungTestAdapter([], {
      lade: vi.fn().mockRejectedValue(new ApiFehler(401, "unauthenticated")),
    });
    app(adapter);
    expect(await screen.findByText("Anmeldung erforderlich")).toBeInTheDocument();
  });

  it("zeichnet im Werkzeugmodus über vorhandenen Anmerkungen und wählt sie nicht aus", () => {
    const onMarkierung = vi.fn();
    const onTextPlatzieren = vi.fn();
    const onAuswahl = vi.fn();
    const vp = {
      width: 200,
      height: 400,
      scale: 1,
      convertToPdfPoint: (x: number, y: number) => [x, y],
      convertToViewportPoint: (x: number, y: number) => [x, y],
    } as unknown as PageViewport;

    render(
      <PdfAnmerkungsEbene
        annotationen={[testAnmerkung({ id: 7, text: "Vorhanden" })]}
        basis={vp}
        aktuell={vp}
        breite={200}
        hoehe={400}
        werkzeug="marker"
        ausgewaehlteId={null}
        entwurf={{ x: 0.25, y: 0.5, width: 0.28, height: 0.07 }}
        onMarkierung={onMarkierung}
        onTextPlatzieren={onTextPlatzieren}
        onAuswahl={onAuswahl}
      />,
    );

    expect(screen.getByTestId("pdf-anmerkung-vorschau")).toBeInTheDocument();
    vi.spyOn(screen.getByTestId("pdf-ebene"), "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, right: 200, bottom: 400, width: 200, height: 400, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect);
    vi.stubGlobal("PointerEvent", MouseEvent);
    const vorhandene = screen.getByRole("button", { name: "Textanmerkung 7" });
    fireEvent.pointerDown(vorhandene, { clientX: 20, clientY: 20 });
    fireEvent.pointerUp(vorhandene, { clientX: 40, clientY: 40 });
    fireEvent.click(vorhandene);
    expect(onMarkierung).toHaveBeenCalledTimes(1);
    expect(onAuswahl).not.toHaveBeenCalled();
    expect(onTextPlatzieren).not.toHaveBeenCalled();
  });
});
