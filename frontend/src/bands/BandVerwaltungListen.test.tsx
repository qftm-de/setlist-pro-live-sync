import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiFehler } from "../api/client";
import { BandVerwaltung } from "./BandVerwaltung";
import {
  EINLADUNG_TEST,
  OWNER_TEST,
  erstelleVerwaltungTestAdapter,
} from "./verwaltung.testhelfer";
import type { Band } from "./bands";
import type { Einladung } from "./verwaltung";
import { verzögert } from "../test-helfer";

const BAND: Band = {
  id: "1",
  name: "Die Band",
  genre: "Rock",
  location: "Proberaum",
  description: "Text",
  internal_notes: "Intern",
  role: "owner",
  can_manage: true,
};

function baue(vorgaben: Parameters<typeof erstelleVerwaltungTestAdapter>[0] = {}) {
  return erstelleVerwaltungTestAdapter(vorgaben);
}

describe("BandVerwaltung Listen", () => {
  it("zeigt den einmaligen Token auch bei fehlgeschlagener Liste", async () => {
    let abrufe = 0;
    const verwaltung = baue({
      ladeMitglieder: async () => OWNER_TEST,
      ladeEinladungen: async () => {
        abrufe += 1;
        if (abrufe > 1) {
          throw new ApiFehler(0, "network");
        }
        return [];
      },
      erstelleEinladung: vi.fn().mockResolvedValue(EINLADUNG_TEST),
    });
    const { rerender } = render(
      <BandVerwaltung
        band={BAND}
        verwaltung={verwaltung}
        aktualisierung={0}
        onBandGeaendert={() => {}}
        onBandVerlassen={() => {}}
        onBandAnlegen={async () => {}}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "48-Stunden-Link erstellen" }),
    );
    const feld = await screen.findByLabelText("Link");
    expect((feld as HTMLInputElement).value).toContain("/einladung/test-token");

    rerender(
      <BandVerwaltung
        band={BAND}
        verwaltung={verwaltung}
        aktualisierung={1}
        onBandGeaendert={() => {}}
        onBandVerlassen={() => {}}
        onBandAnlegen={async () => {}}
      />,
    );
    expect(await screen.findByText("Keine Verbindung zum Server.")).toBeInTheDocument();
    expect((screen.getByLabelText("Link") as HTMLInputElement).value).toContain(
      "/einladung/test-token",
    );
  });

  it("lädt bei einem Echtzeit-Ereignis die Mitglieder neu", async () => {
    const ladeMitglieder = vi.fn().mockResolvedValue(OWNER_TEST);
    const verwaltung = baue({
      ladeMitglieder,
      ladeEinladungen: async () => [],
    });
    const { rerender } = render(
      <BandVerwaltung
        band={BAND}
        verwaltung={verwaltung}
        aktualisierung={0}
        onBandGeaendert={() => {}}
        onBandVerlassen={() => {}}
        onBandAnlegen={async () => {}}
      />,
    );
    await waitFor(() => expect(ladeMitglieder).toHaveBeenCalledTimes(1));
    rerender(
      <BandVerwaltung
        band={BAND}
        verwaltung={verwaltung}
        aktualisierung={2}
        onBandGeaendert={() => {}}
        onBandVerlassen={() => {}}
        onBandAnlegen={async () => {}}
      />,
    );
    await waitFor(() => expect(ladeMitglieder).toHaveBeenCalledTimes(2));
  });


  it("zeigt Mitglieder auch bei fehlgeschlagener Einladungsliste", async () => {
    const verwaltung = baue({
      ladeMitglieder: async () => OWNER_TEST,
      ladeEinladungen: async () => {
        throw new ApiFehler(0, "network");
      },
    });
    render(
      <BandVerwaltung
        band={BAND}
        verwaltung={verwaltung}
        aktualisierung={0}
        onBandGeaendert={() => {}}
        onBandVerlassen={() => {}}
        onBandAnlegen={async () => {}}
      />,
    );

    expect(await screen.findByText("Owner Olaf")).toBeInTheDocument();
    expect(
      await screen.findByText("Keine Verbindung zum Server."),
    ).toBeInTheDocument();
  });

  it("behält die Mitgliederliste beim Hintergrundabgleich", async () => {
    let aufloesen: ((liste: typeof OWNER_TEST) => void) | undefined;
    const ladeMitglieder = vi
      .fn()
      .mockResolvedValueOnce(OWNER_TEST)
      .mockImplementationOnce(
        () =>
          new Promise<typeof OWNER_TEST>((fertig) => {
            aufloesen = fertig;
          }),
      );
    const verwaltung = baue({
      ladeMitglieder,
      ladeEinladungen: async () => [],
    });
    const { rerender } = render(
      <BandVerwaltung
        band={BAND}
        verwaltung={verwaltung}
        aktualisierung={0}
        onBandGeaendert={() => {}}
        onBandVerlassen={() => {}}
        onBandAnlegen={async () => {}}
      />,
    );
    expect(await screen.findByText("Owner Olaf")).toBeInTheDocument();

    rerender(
      <BandVerwaltung
        band={BAND}
        verwaltung={verwaltung}
        aktualisierung={1}
        onBandGeaendert={() => {}}
        onBandVerlassen={() => {}}
        onBandAnlegen={async () => {}}
      />,
    );

    expect(screen.getByText("Owner Olaf")).toBeInTheDocument();
    await act(async () => {
      aufloesen?.(OWNER_TEST);
    });
  });

  it("lädt die Einladungsliste nach dem Erstellen nicht erneut", async () => {
    const ladeEinladungen = vi.fn().mockResolvedValue([]);
    const verwaltung = baue({
      ladeMitglieder: async () => OWNER_TEST,
      ladeEinladungen,
      erstelleEinladung: vi.fn().mockResolvedValue(EINLADUNG_TEST),
    });
    render(
      <BandVerwaltung
        band={BAND}
        verwaltung={verwaltung}
        aktualisierung={0}
        onBandGeaendert={() => {}}
        onBandVerlassen={() => {}}
        onBandAnlegen={async () => {}}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "48-Stunden-Link erstellen" }),
    );
    expect(await screen.findByLabelText("Link")).toBeInTheDocument();
    expect(ladeEinladungen).toHaveBeenCalledTimes(1);
  });

  it("überschreibt eine neu erstellte Einladung nicht mit einem älteren Listenabruf", async () => {
    const ersterAbruf = verzögert<Einladung[]>();
    const verwaltung = baue({
      ladeMitglieder: async () => OWNER_TEST,
      ladeEinladungen: vi.fn(() => ersterAbruf.promise),
      erstelleEinladung: vi.fn().mockResolvedValue(EINLADUNG_TEST),
    });
    render(
      <BandVerwaltung
        band={BAND}
        verwaltung={verwaltung}
        aktualisierung={0}
        onBandGeaendert={() => {}}
        onBandVerlassen={() => {}}
        onBandAnlegen={async () => {}}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "48-Stunden-Link erstellen" }),
    );
    expect(await screen.findByText("Probe")).toBeInTheDocument();

    await act(async () => {
      ersterAbruf.aufloesen([]);
      await Promise.resolve();
    });
    expect(screen.getByText("Probe")).toBeInTheDocument();
  });

  it("schließt die Löschbestätigung nach bestätigtem Entfernen auch bei fehlgeschlagenem Nachladen", async () => {
    const mitglieder = [
      OWNER_TEST[0],
      { ...OWNER_TEST[1], can_remove: true },
    ];
    const entferneMitglied = vi.fn().mockResolvedValue(undefined);
    const ladeMitglieder = vi
      .fn()
      .mockResolvedValueOnce(mitglieder)
      .mockRejectedValueOnce(new ApiFehler(0, "network"));
    const verwaltung = baue({
      ladeMitglieder,
      ladeEinladungen: async () => [],
      entferneMitglied,
    });
    render(
      <BandVerwaltung
        band={BAND}
        verwaltung={verwaltung}
        aktualisierung={0}
        onBandGeaendert={() => {}}
        onBandVerlassen={() => {}}
        onBandAnlegen={async () => {}}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Entfernen" }));
    fireEvent.click(screen.getByRole("button", { name: "Ja, entfernen" }));

    expect(await screen.findByText("Keine Verbindung zum Server.")).toBeInTheDocument();
    expect(screen.queryByText("Mitglied Mia")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ja, entfernen" })).not.toBeInTheDocument();
    expect(entferneMitglied).toHaveBeenCalledTimes(1);
  });

});
