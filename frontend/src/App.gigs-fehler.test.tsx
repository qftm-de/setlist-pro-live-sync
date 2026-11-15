import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { ApiFehler } from "./api/client";
import { erstelleTestAdapter, type Band } from "./bands/bands";
import {
  erstelleGigTestAdapter,
  type Gig,
  type GigAdapter,
  type GigGruppen,
} from "./gigs/gigs";
import { appOptionen, gig, gruppen, zuAuftritten } from "./gigs/testhelfer";
import { erstelleSetlistTestAdapter } from "./setlists/setlists";
import { KONFIGURATION, sitzungAdapter, verzögert } from "./test-helfer";

beforeEach(() => {
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Auftritte Fehlerfälle", () => {
  it("hält die Verknüpfung bei fehlgeschlagener Setlist-Auswahl", async () => {
    const adapter = erstelleGigTestAdapter([
      gig({ id: 7, title: "Alt", setlist_id: 2, setlist_name: "Hauptset" }),
    ]);
    const aendern = vi.spyOn(adapter, "aendereGig");
    const setlistAdapter = erstelleSetlistTestAdapter([], {
      ladeSetlists: async () => {
        throw new ApiFehler(500, "server");
      },
    });
    render(
      <App {...appOptionen(adapter)} setlistAdapter={setlistAdapter} />,
    );
    await zuAuftritten();
    fireEvent.click(await screen.findByRole("button", { name: "Alt ändern" }));

    expect(
      (await screen.findAllByText("Serverfehler. Bitte erneut versuchen.")).length,
    ).toBeGreaterThan(0);
    const auswahl = screen.getByLabelText("Setlist (ändern)");
    expect(auswahl).toBeDisabled();
    expect(auswahl).toHaveValue("2");

    fireEvent.change(screen.getByLabelText("Titel (ändern)"), {
      target: { value: "Neu" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Änderung speichern" }));

    await waitFor(() => expect(aendern).toHaveBeenCalledTimes(1));
    const eingabe = aendern.mock.calls[0][2];
    expect(eingabe.title).toBe("Neu");
    expect("setlist_id" in eingabe).toBe(false);
    expect(
      screen.getAllByText("Serverfehler. Bitte erneut versuchen.").length,
    ).toBeGreaterThan(0);
  });

  it("trennt bestätigte Speicherung vom fehlgeschlagenen Listenabgleich", async () => {
    const gruppenLaden = vi
      .fn<() => Promise<GigGruppen>>()
      .mockResolvedValueOnce(gruppen())
      .mockRejectedValueOnce(new ApiFehler(500, "server"))
      .mockResolvedValueOnce(
        gruppen({
          upcoming: [gig({ id: 1, title: "Sommerfest", date: "2026-06-20" })],
        }),
      );
    let naechsteId = 1;
    const adapter: GigAdapter = {
      ladeGigs: gruppenLaden,
      erstelleGig: vi.fn(async (_bandId, eingabe) => {
        const neu = gig({ id: naechsteId, ...eingabe });
        naechsteId += 1;
        return neu;
      }),
      aendereGig: vi.fn(async () => gig()),
      loescheGig: vi.fn(async () => {}),
    };
    render(<App {...appOptionen(adapter)} />);
    await zuAuftritten();
    await screen.findByText("Keine kommenden Auftritte.");

    fireEvent.change(screen.getByLabelText("Titel"), {
      target: { value: "Sommerfest" },
    });
    fireEvent.change(screen.getByLabelText("Datum"), {
      target: { value: "2026-06-20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Auftritt anlegen" }));

    expect(await screen.findByText("Gespeichert")).toBeInTheDocument();
    expect(
      await screen.findByText(/Gespeichert, Liste nicht aktualisiert/),
    ).toBeInTheDocument();
    expect(adapter.erstelleGig).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    await waitFor(() => expect(gruppenLaden).toHaveBeenCalledTimes(3));
    expect(adapter.erstelleGig).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Sommerfest")).toBeInTheDocument();
    expect(
      screen.queryByText(/Gespeichert, Liste nicht aktualisiert/),
    ).not.toBeInTheDocument();
  });

  it("zeigt Ladefehler wiederholbar", async () => {
    const laden = vi
      .fn<() => Promise<GigGruppen>>()
      .mockRejectedValueOnce(new ApiFehler(500, "server"))
      .mockResolvedValueOnce(gruppen());
    const adapter: GigAdapter = {
      ladeGigs: laden,
      erstelleGig: vi.fn(),
      aendereGig: vi.fn(),
      loescheGig: vi.fn(),
    };
    render(<App {...appOptionen(adapter)} />);
    await zuAuftritten();

    expect(
      await screen.findByText("Serverfehler. Bitte erneut versuchen."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(await screen.findByText("Keine kommenden Auftritte.")).toBeInTheDocument();
    expect(laden).toHaveBeenCalledTimes(2);
  });

  it("erhält Eingaben bei Schreibfehlern", async () => {
    const adapter = erstelleGigTestAdapter([], "2026-06-15");
    vi.spyOn(adapter, "erstelleGig").mockRejectedValue(new ApiFehler(500, "server"));
    render(<App {...appOptionen(adapter)} />);
    await zuAuftritten();
    await screen.findByText("Keine kommenden Auftritte.");

    fireEvent.change(screen.getByLabelText("Titel"), {
      target: { value: "Bleibt stehen" },
    });
    fireEvent.change(screen.getByLabelText("Datum"), {
      target: { value: "2026-06-20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Auftritt anlegen" }));

    expect(
      await screen.findByText("Serverfehler. Bitte erneut versuchen."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Titel")).toHaveValue("Bleibt stehen");
    expect(screen.getByLabelText("Datum")).toHaveValue("2026-06-20");
  });

  it("führt bei 401 zur Anmeldung", async () => {
    const adapter = erstelleGigTestAdapter([], "2026-06-15");
    vi.spyOn(adapter, "erstelleGig").mockRejectedValue(
      new ApiFehler(401, "unauthenticated"),
    );
    render(<App {...appOptionen(adapter)} />);
    await zuAuftritten();
    await screen.findByText("Keine kommenden Auftritte.");

    fireEvent.change(screen.getByLabelText("Titel"), {
      target: { value: "Abgelaufen" },
    });
    fireEvent.change(screen.getByLabelText("Datum"), {
      target: { value: "2026-06-20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Auftritt anlegen" }));

    expect(await screen.findByText("Anmeldung erforderlich")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Auftritt anlegen" }),
    ).not.toBeInTheDocument();
  });

  it("ignoriert späte Antworten nach dem Bandwechsel", async () => {
    const spaet = verzögert<GigGruppen>();
    const laden = vi.fn(async (bandId: string) => {
      if (bandId === "a") {
        return gruppen({
          upcoming: [gig({ id: 1, title: "A-Termin" })],
        });
      }
      return spaet.promise;
    });
    const adapter: GigAdapter = {
      ladeGigs: laden,
      erstelleGig: vi.fn(),
      aendereGig: vi.fn(),
      loescheGig: vi.fn(),
    };
    const bands: Band[] = [
      { id: "a", name: "Band A" },
      { id: "b", name: "Band B" },
    ];
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={erstelleTestAdapter(bands, async (bandId) => ({
          bandId,
          songs: [],
        }))}
        gigAdapter={adapter}
      />,
    );
    await zuAuftritten();
    expect(await screen.findByText("A-Termin")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Band"), { target: { value: "b" } });
    await waitFor(() => expect(laden).toHaveBeenCalledWith("b"));
    expect(screen.queryByText("A-Termin")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Band"), { target: { value: "a" } });
    expect(await screen.findByText("A-Termin")).toBeInTheDocument();

    spaet.aufloesen(
      gruppen({ upcoming: [gig({ id: 2, title: "B-Termin" })] }),
    );
    await waitFor(() =>
      expect(screen.queryByText("B-Termin")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("A-Termin")).toBeInTheDocument();
  });

  it("führt bei 401 im Listenabgleich zur Anmeldung", async () => {
    const laden = vi
      .fn<() => Promise<GigGruppen>>()
      .mockResolvedValueOnce(gruppen())
      .mockRejectedValueOnce(new ApiFehler(401, "unauthenticated"));
    const adapter: GigAdapter = {
      ladeGigs: laden,
      erstelleGig: vi.fn(async () => gig({ id: 1, title: "Neu" })),
      aendereGig: vi.fn(),
      loescheGig: vi.fn(),
    };
    render(<App {...appOptionen(adapter)} />);
    await zuAuftritten();
    await screen.findByText("Keine kommenden Auftritte.");

    fireEvent.change(screen.getByLabelText("Titel"), {
      target: { value: "Neu" },
    });
    fireEvent.change(screen.getByLabelText("Datum"), {
      target: { value: "2026-06-20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Auftritt anlegen" }));

    expect(await screen.findByText("Anmeldung erforderlich")).toBeInTheDocument();
    expect(laden).toHaveBeenCalledTimes(2);
  });

  it("lädt die Setlist-Auswahl nach einem Fehler erneut", async () => {
    let aufrufe = 0;
    const setlistAdapter = erstelleSetlistTestAdapter([], {
      ladeSetlists: async () => {
        aufrufe += 1;
        if (aufrufe === 1) {
          throw new ApiFehler(500, "server");
        }
        return [{ id: 2, name: "Hauptset" }];
      },
    });
    render(
      <App
        {...appOptionen(erstelleGigTestAdapter([]))}
        setlistAdapter={setlistAdapter}
      />,
    );
    await zuAuftritten();
    expect(
      await screen.findByText("Serverfehler. Bitte erneut versuchen."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Setlists erneut laden" }));
    await waitFor(() => expect(screen.getByLabelText("Setlist")).not.toBeDisabled());
    expect(
      within(screen.getByLabelText("Setlist")).getByRole("option", {
        name: "Hauptset",
      }),
    ).toBeInTheDocument();
  });

  it("ignoriert späte Schreibantworten nach dem Bandwechsel", async () => {
    const schreiben = verzögert<Gig>();
    const adapter: GigAdapter = {
      ladeGigs: async (bandId) =>
        bandId === "a"
          ? gruppen({ upcoming: [gig({ id: 1, title: "A-Termin" })] })
          : gruppen(),
      erstelleGig: async () => schreiben.promise,
      aendereGig: vi.fn(),
      loescheGig: vi.fn(),
    };
    render(
      <App
        konfigurationLaden={vi.fn().mockResolvedValue(KONFIGURATION)}
        sessionAdapter={sitzungAdapter()}
        bandAdapter={erstelleTestAdapter(
          [
            { id: "a", name: "Band A" },
            { id: "b", name: "Band B" },
          ],
          async (bandId) => ({ bandId, songs: [] }),
        )}
        gigAdapter={adapter}
      />,
    );
    await zuAuftritten();
    expect(await screen.findByText("A-Termin")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Titel"), {
      target: { value: "Später Auftritt" },
    });
    fireEvent.change(screen.getByLabelText("Datum"), {
      target: { value: "2026-06-20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Auftritt anlegen" }));

    fireEvent.change(screen.getByLabelText("Band"), { target: { value: "b" } });
    expect(await screen.findByText("Keine kommenden Auftritte.")).toBeInTheDocument();

    schreiben.aufloesen(gig({ id: 9, title: "Später Auftritt" }));
    await waitFor(() =>
      expect(screen.queryByText("Später Auftritt")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Keine kommenden Auftritte.")).toBeInTheDocument();
  });
});
