import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiFehler } from "../api/client";
import { BandVerwaltung } from "./BandVerwaltung";
import { OWNER_TEST, erstelleVerwaltungTestAdapter } from "./verwaltung.testhelfer";
import type { Band } from "./bands";
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BandVerwaltung Serverstand", () => {
  it("behält ungespeicherte Einstellungen bei einem Serverstand", async () => {
    const verwaltung = baue({
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
    fireEvent.change(await screen.findByLabelText("Name"), {
      target: { value: "Mein Entwurf" },
    });

    rerender(
      <BandVerwaltung
        band={{ ...BAND, name: "Server-Neu" }}
        verwaltung={verwaltung}
        aktualisierung={0}
        onBandGeaendert={() => {}}
        onBandVerlassen={() => {}}
        onBandAnlegen={async () => {}}
      />,
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Mein Entwurf");
    expect(
      screen.getByText(/Die Banddaten wurden im Hintergrund geändert/),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Serverdaten übernehmen" }),
    );
    expect(screen.getByLabelText("Name")).toHaveValue("Server-Neu");
  });

  it("lädt die Band nach einem Rollenwechsel neu", async () => {
    const onBandGeaendert = vi.fn();
    const mitglieder = [
      OWNER_TEST[0],
      { ...OWNER_TEST[1], can_change_role: true, can_remove: true },
    ];
    const verwaltung = baue({
      ladeMitglieder: async () => mitglieder,
      ladeEinladungen: async () => [],
      aendereMitgliedRolle: vi.fn().mockResolvedValue(mitglieder),
    });
    render(
      <BandVerwaltung
        band={BAND}
        verwaltung={verwaltung}
        aktualisierung={0}
        onBandGeaendert={onBandGeaendert}
        onBandVerlassen={() => {}}
        onBandAnlegen={async () => {}}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Zum Owner machen" }),
    );
    await waitFor(() => expect(onBandGeaendert).toHaveBeenCalled());
  });

  it("zeigt einem herabgestuften Owner die bestätigten Banddaten", async () => {
    const verwaltung = baue({
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
    fireEvent.change(await screen.findByLabelText("Name"), {
      target: { value: "Mein Entwurf" },
    });

    rerender(
      <BandVerwaltung
        band={{ ...BAND, name: "Server-Name", role: "member", can_manage: false }}
        verwaltung={verwaltung}
        aktualisierung={0}
        onBandGeaendert={() => {}}
        onBandVerlassen={() => {}}
        onBandAnlegen={async () => {}}
      />,
    );

    expect(screen.getByText("Server-Name")).toBeInTheDocument();
    expect(screen.queryByText("Mein Entwurf")).toBeNull();
  });

  it("zeigt nach dem Speichern mit Randleerzeichen keine falsche Warnung", async () => {
    const aktualisiereBand = vi.fn().mockResolvedValue({ ...BAND, name: "Neu" });
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
    fireEvent.change(await screen.findByLabelText("Name"), {
      target: { value: "  Neu  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Einstellungen speichern" }));
    await screen.findByText("Gespeichert");

    rerender(
      <BandVerwaltung
        band={{ ...BAND, name: "Neu" }}
        verwaltung={verwaltung}
        aktualisierung={0}
        onBandGeaendert={() => {}}
        onBandVerlassen={() => {}}
        onBandAnlegen={async () => {}}
      />,
    );

    expect(screen.queryByText(/Hintergrund geändert/)).toBeNull();
    expect(screen.getByLabelText("Name")).toHaveValue("Neu");
  });

  it("zeigt Fehler beim Speichern und beim Rollenwechsel", async () => {
    const meldung = "Die Band braucht mindestens einen Owner.";
    const mitglieder = [
      OWNER_TEST[0],
      { ...OWNER_TEST[1], can_change_role: true },
    ];
    const verwaltung = baue({
      ladeMitglieder: async () => mitglieder,
      ladeEinladungen: async () => [],
      aktualisiereBand: vi.fn().mockRejectedValue(new ApiFehler(400, "bad_request", meldung)),
      aendereMitgliedRolle: vi.fn().mockRejectedValue(new ApiFehler(400, "bad_request", meldung)),
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
    fireEvent.change(await screen.findByLabelText("Name"), {
      target: { value: "Anders" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Einstellungen speichern" }));
    expect(await screen.findByText(meldung)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zum Owner machen" }));
    await waitFor(() => expect(screen.getAllByText(meldung)).toHaveLength(2));
  });

  it("sperrt die Eingaben während des Speicherns", async () => {
    const antwort = verzögert<Band>();
    const verwaltung = baue({
      ladeMitglieder: async () => OWNER_TEST,
      ladeEinladungen: async () => [],
      aktualisiereBand: vi.fn(() => antwort.promise),
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

    expect(name).toBeDisabled();
    expect(screen.getByLabelText("Genre")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Einstellungen speichern" }),
    ).toBeDisabled();

    await act(async () => {
      antwort.aufloesen({ ...BAND, name: "Neu" });
    });
    await screen.findByText("Gespeichert");
    expect(name).not.toBeDisabled();
  });

  it("behält eine Konfliktwarnung auch nach einem zweiten Serverstand an einem anderen Feld", async () => {
    const verwaltung = baue({
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
    fireEvent.change(await screen.findByLabelText("Name"), {
      target: { value: "Mein Name" },
    });

    rerender(
      <BandVerwaltung
        band={{ ...BAND, name: "Fremder Name" }}
        verwaltung={verwaltung}
        aktualisierung={0}
        onBandGeaendert={() => {}}
        onBandVerlassen={() => {}}
        onBandAnlegen={async () => {}}
      />,
    );
    expect(screen.getByText(/Auch diese Felder wurden geändert: Name\./)).toBeInTheDocument();

    rerender(
      <BandVerwaltung
        band={{ ...BAND, name: "Fremder Name", genre: "Jazz" }}
        verwaltung={verwaltung}
        aktualisierung={0}
        onBandGeaendert={() => {}}
        onBandVerlassen={() => {}}
        onBandAnlegen={async () => {}}
      />,
    );
    expect(screen.getByText(/Auch diese Felder wurden geändert: Name\./)).toBeInTheDocument();
    expect(screen.getByLabelText("Genre")).toHaveValue("Jazz");
    expect(screen.getByLabelText("Name")).toHaveValue("Mein Name");
  });

  it("behält ein während onBandGeaendert eingetroffenes unberührtes Feld trotz älterer PATCH-Antwort", async () => {
    const bandReload = verzögert<void>();
    const verwaltung = baue({
      ladeMitglieder: async () => OWNER_TEST,
      ladeEinladungen: async () => [],
      aktualisiereBand: vi.fn().mockResolvedValue({ ...BAND, genre: "Funk" }),
    });
    const { rerender } = render(
      <BandVerwaltung
        band={BAND}
        verwaltung={verwaltung}
        aktualisierung={0}
        onBandGeaendert={() => bandReload.promise}
        onBandVerlassen={() => {}}
        onBandAnlegen={async () => {}}
      />,
    );
    fireEvent.change(await screen.findByLabelText("Genre"), { target: { value: "Funk" } });
    fireEvent.click(screen.getByRole("button", { name: "Einstellungen speichern" }));
    await waitFor(() => expect(verwaltung.aktualisiereBand).toHaveBeenCalledTimes(1));

    rerender(
      <BandVerwaltung
        band={{ ...BAND, genre: "Funk", location: "Hamburg" }}
        verwaltung={verwaltung}
        aktualisierung={0}
        onBandGeaendert={() => bandReload.promise}
        onBandVerlassen={() => {}}
        onBandAnlegen={async () => {}}
      />,
    );
    await act(async () => {
      bandReload.aufloesen(undefined);
      await Promise.resolve();
    });
    await screen.findByText("Gespeichert");
    expect(screen.getByLabelText("Ort / Proberaum")).toHaveValue("Hamburg");
    expect(screen.getByLabelText("Genre")).toHaveValue("Funk");
  });
});
