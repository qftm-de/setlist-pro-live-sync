import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BandVerwaltung } from "./BandVerwaltung";
import {
  EINLADUNG_TEST,
  MITGLIED_TEST,
  OWNER_TEST,
  erstelleVerwaltungTestAdapter,
} from "./verwaltung.testhelfer";
import type { Band } from "./bands";

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BandVerwaltung", () => {
  it("Owner speichert Einstellungen und sieht den Status", async () => {
    const aktualisiereBand = vi.fn().mockResolvedValue({ ...BAND, name: "Neu" });
    const verwaltung = baue({
      aktualisiereBand,
      ladeMitglieder: async () => MITGLIED_TEST,
      ladeEinladungen: async () => [],
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
    const name = await screen.findByLabelText("Name");
    fireEvent.change(name, { target: { value: "Neu" } });
    fireEvent.click(screen.getByRole("button", { name: "Einstellungen speichern" }));
    expect(await screen.findByText("Gespeichert")).toBeInTheDocument();
    expect(aktualisiereBand).toHaveBeenCalledWith("1", { name: "Neu" });
  });

  it("sendet nur berührte Felder und erhält parallele Serveränderungen", async () => {
    const aktualisiereBand = vi.fn().mockResolvedValue(BAND);
    const verwaltung = baue({
      aktualisiereBand,
      ladeMitglieder: async () => OWNER_TEST,
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
    fireEvent.change(await screen.findByLabelText("Genre"), {
      target: { value: "Funk" },
    });

    rerender(
      <BandVerwaltung
        band={{ ...BAND, location: "Proberaum Süd" }}
        verwaltung={verwaltung}
        aktualisierung={0}
        onBandGeaendert={() => {}}
        onBandVerlassen={() => {}}
        onBandAnlegen={async () => {}}
      />,
    );

    expect(screen.getByLabelText("Ort / Proberaum")).toHaveValue("Proberaum Süd");
    fireEvent.click(screen.getByRole("button", { name: "Einstellungen speichern" }));
    await screen.findByText("Gespeichert");
    expect(aktualisiereBand).toHaveBeenCalledWith("1", { genre: "Funk" });
  });

  it("Mitglied liest ohne Bearbeitungsrechte", async () => {
    const verwaltung = baue({
      ladeMitglieder: async () => MITGLIED_TEST.map((m) => ({ ...m, can_change_role: false, can_remove: m.is_self })),
    });
    render(
      <BandVerwaltung
        band={{ ...BAND, role: "member", can_manage: false }}
        verwaltung={verwaltung}
        aktualisierung={0}
        onBandGeaendert={() => {}}
        onBandVerlassen={() => {}}
        onBandAnlegen={async () => {}}
      />,
    );
    expect(
      await screen.findByText("Nur Band-Owner ändern diese Angaben."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Einstellungen speichern" })).toBeNull();
    expect(screen.getByText("Intern")).toBeInTheDocument();
  });

  it("Owner ändert eine Rolle und entfernt nach Bestätigung", async () => {
    const mitglieder = [
      { ...OWNER_TEST[0] },
      { ...OWNER_TEST[1], can_change_role: true, can_remove: true },
    ];
    const aendereMitgliedRolle = vi.fn().mockResolvedValue(mitglieder);
    const entferneMitglied = vi.fn().mockResolvedValue(undefined);
    const verwaltung = baue({
      ladeMitglieder: async () => mitglieder,
      aendereMitgliedRolle,
      entferneMitglied,
      ladeEinladungen: async () => [],
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
      await screen.findByRole("button", { name: "Zum Owner machen" }),
    );
    await waitFor(() =>
      expect(aendereMitgliedRolle).toHaveBeenCalledWith("1", 2, "owner"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Entfernen" }));
    fireEvent.click(screen.getByRole("button", { name: "Ja, entfernen" }));
    await waitFor(() => expect(entferneMitglied).toHaveBeenCalledWith("1", 2));
  });

  it("erstellt und widerruft einen Einladungslink", async () => {
    const schreiben = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: schreiben },
      configurable: true,
    });
    const erstelleEinladung = vi.fn().mockResolvedValue(EINLADUNG_TEST);
    const widerrufeEinladung = vi.fn().mockResolvedValue({
      ...EINLADUNG_TEST,
      status: "revoked",
      revoked_at: new Date().toISOString(),
    });
    const verwaltung = baue({
      ladeMitglieder: async () => OWNER_TEST,
      ladeEinladungen: async () => [],
      erstelleEinladung,
      widerrufeEinladung,
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
    fireEvent.change(await screen.findByLabelText("Hinweis"), {
      target: { value: "Probe" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "48-Stunden-Link erstellen" }),
    );
    const feld = await screen.findByLabelText("Link");
    expect((feld as HTMLInputElement).value).toContain("/einladung/test-token");
    expect(erstelleEinladung).toHaveBeenCalledWith(
      "1",
      expect.objectContaining({ note: "Probe", max_uses: null }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Link kopieren" }));
    await waitFor(() => expect(schreiben).toHaveBeenCalled());

    rerender(
      <BandVerwaltung
        band={BAND}
        verwaltung={baue({
          ladeMitglieder: async () => OWNER_TEST,
          ladeEinladungen: async () => [EINLADUNG_TEST],
          widerrufeEinladung,
        })}
        aktualisierung={1}
        onBandGeaendert={() => {}}
        onBandVerlassen={() => {}}
        onBandAnlegen={async () => {}}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Widerrufen" }));
    fireEvent.click(screen.getByRole("button", { name: "Ja, widerrufen" }));
    await waitFor(() =>
      expect(widerrufeEinladung).toHaveBeenCalledWith("1", EINLADUNG_TEST.id),
    );
  });

  it("Mitglied tritt nach Bestätigung selbst aus", async () => {
    const entferneMitglied = vi.fn().mockResolvedValue(undefined);
    const onBandVerlassen = vi.fn();
    const verwaltung = baue({
      ladeMitglieder: async () => MITGLIED_TEST,
      entferneMitglied,
    });
    render(
      <BandVerwaltung
        band={{ ...BAND, role: "member", can_manage: false }}
        verwaltung={verwaltung}
        aktualisierung={0}
        onBandGeaendert={() => {}}
        onBandVerlassen={onBandVerlassen}
        onBandAnlegen={async () => {}}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Austreten" }));
    expect(screen.getByText("Band wirklich verlassen?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ja, austreten" }));
    await waitFor(() => expect(entferneMitglied).toHaveBeenCalledWith("1", 2));
    await waitFor(() => expect(onBandVerlassen).toHaveBeenCalled());
  });

});
