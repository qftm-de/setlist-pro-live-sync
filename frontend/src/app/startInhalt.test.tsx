import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AppRoute } from "../routing";
import { erstelleVerwaltungTestAdapter } from "../bands/verwaltung.testhelfer";
import { startInhalt } from "./startInhalt";

function props(route: AppRoute) {
  return {
    konfiguration: {
      status: "fertig" as const,
      konfiguration: {
        mode: "core" as const,
        instanceName: "Testinstanz",
        communityUrl: null,
      },
    },
    sitzung: { status: "anonym" as const },
    bands: { status: "fertig" as const, bands: [] },
    sichtbareBands: [],
    route,
    verwaltungAdapter: erstelleVerwaltungTestAdapter({}),
    sitzungAbgelaufen: () => {},
    einladungAngenommen: () => {},
    beitrittFertig: () => {},
    pfad: "/",
    kontoZeile: null,
    direktFehler: null,
    bandListenFehler: null,
    erneutVersuchen: () => {},
    alleBandsEntsperren: () => {},
    setBandListenFehler: () => {},
    bandAnlegen: async () => {},
    anmelden: async () => {},
  };
}

describe("startInhalt mit Instanz-Einladung", () => {
  it("zeigt bei fehlendem Token den Fehlerhinweis statt des Anmeldeformulars", () => {
    render(
      <>
        {startInhalt(
          props({
            bereich: "invite",
            bandId: null,
            setlistId: null,
            songId: null,
            versionId: null,
            inviteArt: "instanz",
            inviteToken: null,
          }),
        )}
      </>,
    );
    expect(
      screen.getByText("Dieser Einladungslink ist ungültig oder abgelaufen."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Anmeldung erforderlich")).toBeNull();
  });

  it("zeigt fuer einen Band-Token weiterhin die Band-Einladung", () => {
    const verwaltung = erstelleVerwaltungTestAdapter({
      pruefeEinladung: vi.fn().mockResolvedValue({
        band_name: "Testband",
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
        authenticated: false,
        already_member: false,
      }),
    });
    render(
      <>
        {startInhalt({
          ...props({
            bereich: "invite",
            bandId: null,
            setlistId: null,
            songId: null,
            versionId: null,
            inviteArt: "band",
            inviteToken: "abc",
          }),
          verwaltungAdapter: verwaltung,
        })}
      </>,
    );
    expect(verwaltung.pruefeEinladung).toHaveBeenCalledWith("abc");
  });
});
