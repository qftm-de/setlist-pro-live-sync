import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PdfViewerProps } from "../documents/PdfViewer";
import { AnmerkungsBereich } from "./AnmerkungsBereich";
import { anmerkungTestAdapter, testAnmerkung } from "./testhelfer";

function TestViewer({
  gesperrt = false,
  onGeometrie,
  onAnmerkungAuswahl,
  onBevorSeiteWechsel,
}: PdfViewerProps) {
  return (
    <div data-testid="test-viewer" data-gesperrt={String(gesperrt)}>
      <button type="button" onClick={() => onAnmerkungAuswahl?.(1)}>
        Erste wählen
      </button>
      <button type="button" onClick={() => onAnmerkungAuswahl?.(2)}>
        Zweite wählen
      </button>
      <button
        type="button"
        onClick={() =>
          onGeometrie?.(1, { x: 0.4, y: 0.4, width: 0.2, height: 0.1 })
        }
      >
        Ziehen simulieren
      </button>
      <button type="button" onClick={() => onBevorSeiteWechsel?.(2)}>
        Seite wechseln
      </button>
    </div>
  );
}

describe("EntwurfsDialog sperrt das PDF", () => {
  it("legt eine modale Überlagerung über das PDF und blockiert Geometrieänderungen", async () => {
    const adapter = anmerkungTestAdapter([
      testAnmerkung({ id: 1, text: "Alt" }),
      testAnmerkung({ id: 2, text: "Zweit" }),
    ]);
    render(
      <AnmerkungsBereich
        bandId="a"
        songId={1}
        versionId={1}
        seiten={2}
        daten={new ArrayBuffer(8)}
        titel="Test.pdf"
        Viewer={TestViewer}
        adapter={adapter}
      />,
    );

    await screen.findByRole("button", { name: /Alt/ });
    fireEvent.click(screen.getByRole("button", { name: "Erste wählen" }));
    fireEvent.change(await screen.findByLabelText("Text"), {
      target: { value: "Bearbeitet" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Seite wechseln" }));

    const dialog = await screen.findByRole("dialog", { name: "Ungespeicherter Entwurf" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(screen.getByTestId("entwurfs-dialog-ueberlagerung")).toBeInTheDocument();
    expect(screen.getByTestId("test-viewer")).toHaveAttribute("data-gesperrt", "true");

    fireEvent.click(screen.getByRole("button", { name: "Ziehen simulieren" }));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(
      screen.queryByRole("dialog", { name: "Ungespeicherter Entwurf" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("test-viewer")).toHaveAttribute("data-gesperrt", "false");
    expect(screen.getByLabelText("Text")).toHaveValue("Bearbeitet");
  });

  it("zeigt einen Validierungsfehler im Dialog und lässt den Wechsel abbrechen", async () => {
    const adapter = anmerkungTestAdapter([
      testAnmerkung({ id: 1, text: "Alt" }),
      testAnmerkung({ id: 2, text: "Zweit" }),
    ]);
    render(
      <AnmerkungsBereich
        bandId="a"
        songId={1}
        versionId={1}
        seiten={2}
        daten={new ArrayBuffer(8)}
        titel="Test.pdf"
        Viewer={TestViewer}
        adapter={adapter}
      />,
    );

    await screen.findByRole("button", { name: /Alt/ });
    fireEvent.click(screen.getByRole("button", { name: "Erste wählen" }));
    fireEvent.change(await screen.findByLabelText("Text"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Seite wechseln" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Ungespeicherter Entwurf",
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Entwurf speichern und wechseln" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Bitte einen Text eintragen.",
    );
    expect(
      screen.getByRole("dialog", { name: "Ungespeicherter Entwurf" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "Ungespeicherter Entwurf" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Text")).toHaveValue("   ");
  });
});
