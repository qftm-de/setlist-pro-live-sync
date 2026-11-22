import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiFehler } from "../api/client";
import { EinladungAnsicht } from "./EinladungAnsicht";
import { apiBandVerwaltung } from "./verwaltung";
import { erstelleVerwaltungTestAdapter } from "./verwaltung.testhelfer";

const VORSCHAU = {
  band_name: "Testband",
  expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  authenticated: false,
  already_member: false,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("EinladungAnsicht Fehlerfälle", () => {
  it("weist ungültige Links ab", async () => {
    const verwaltung = erstelleVerwaltungTestAdapter({
      pruefeEinladung: async () => {
        throw new ApiFehler(404, "not_found");
      },
    });
    render(
      <EinladungAnsicht token="abc" verwaltung={verwaltung} onBeigetreten={() => {}} />,
    );
    expect(
      await screen.findByText("Dieser Einladungslink ist ungültig oder abgelaufen."),
    ).toBeInTheDocument();
  });

  it("verlangt übereinstimmende Passwörter", async () => {
    const akzeptiereEinladung = vi.fn();
    const verwaltung = erstelleVerwaltungTestAdapter({
      pruefeEinladung: async () => VORSCHAU,
      akzeptiereEinladung,
    });
    render(
      <EinladungAnsicht token="abc" verwaltung={verwaltung} onBeigetreten={() => {}} />,
    );
    await screen.findByLabelText("Benutzername");
    fireEvent.change(screen.getByLabelText("Benutzername"), {
      target: { value: "neu" },
    });
    fireEvent.change(screen.getByLabelText("E-Mail"), {
      target: { value: "neu@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Passwort"), {
      target: { value: "testpasswort-1111" },
    });
    fireEvent.change(screen.getByLabelText("Passwort wiederholen"), {
      target: { value: "anders" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Konto anlegen und beitreten" }),
    );
    expect(
      await screen.findByText("Die Passwörter stimmen nicht überein."),
    ).toBeInTheDocument();
    expect(akzeptiereEinladung).not.toHaveBeenCalled();
  });

  it("meldet einen zwischenzeitlich ungültigen Link beim Beitritt", async () => {
    const akzeptiereEinladung = vi
      .fn()
      .mockRejectedValue(new ApiFehler(404, "not_found"));
    const verwaltung = erstelleVerwaltungTestAdapter({
      pruefeEinladung: async () => ({
        ...VORSCHAU,
        authenticated: true,
        already_member: false,
      }),
      akzeptiereEinladung,
    });
    render(
      <EinladungAnsicht token="abc" verwaltung={verwaltung} onBeigetreten={() => {}} />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Band beitreten" }));
    expect(
      await screen.findByText("Dieser Einladungslink ist ungültig oder abgelaufen."),
    ).toBeInTheDocument();
  });

  it("lädt nach abgelaufener Session die Vorschau anonym neu", async () => {
    let aufrufe = 0;
    const pruefeEinladung = vi.fn().mockImplementation(async () => {
      aufrufe += 1;
      return aufrufe === 1
        ? { ...VORSCHAU, authenticated: true, already_member: false }
        : { ...VORSCHAU, authenticated: false };
    });
    const onSitzungAbgelaufen = vi.fn();
    const akzeptiereEinladung = vi.fn().mockRejectedValue(
      new ApiFehler(400, "bad_request", undefined, {
        mode: "mode login oder register ist Pflicht.",
      }),
    );
    const verwaltung = erstelleVerwaltungTestAdapter({
      pruefeEinladung,
      akzeptiereEinladung,
    });
    render(
      <EinladungAnsicht
        token="abc"
        verwaltung={verwaltung}
        onBeigetreten={() => {}}
        onSitzungAbgelaufen={onSitzungAbgelaufen}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Band beitreten" }));
    expect(
      await screen.findByText("Deine Anmeldung ist abgelaufen. Bitte erneut anmelden."),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Neues Konto anlegen" }),
    ).toBeInTheDocument();
    expect(onSitzungAbgelaufen).toHaveBeenCalled();
  });

  it("zeigt bei abgelaufener Session einen sichtbaren Hinweis", async () => {
    const onSitzungAbgelaufen = vi.fn();
    const akzeptiereEinladung = vi
      .fn()
      .mockRejectedValue(new ApiFehler(401, "unauthenticated"));
    const verwaltung = erstelleVerwaltungTestAdapter({
      pruefeEinladung: async () => ({
        ...VORSCHAU,
        authenticated: true,
        already_member: false,
      }),
      akzeptiereEinladung,
    });
    render(
      <EinladungAnsicht
        token="abc"
        verwaltung={verwaltung}
        onBeigetreten={() => {}}
        onSitzungAbgelaufen={onSitzungAbgelaufen}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Band beitreten" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Deine Anmeldung ist abgelaufen. Bitte erneut anmelden.",
    );
    expect(onSitzungAbgelaufen).toHaveBeenCalled();
  });

  it("zeigt 400-Fehler beim Beitritt sichtbar an", async () => {
    const meldung = "Passwort erfüllt die Regeln nicht.";
    const akzeptiereEinladung = vi
      .fn()
      .mockRejectedValue(new ApiFehler(400, "bad_request", meldung));
    const onBeigetreten = vi.fn();
    const verwaltung = erstelleVerwaltungTestAdapter({
      pruefeEinladung: async () => VORSCHAU,
      akzeptiereEinladung,
    });
    render(
      <EinladungAnsicht
        token="abc"
        verwaltung={verwaltung}
        onBeigetreten={onBeigetreten}
      />,
    );
    await screen.findByLabelText("Benutzername");
    fireEvent.change(screen.getByLabelText("Benutzername"), {
      target: { value: "neu" },
    });
    fireEvent.change(screen.getByLabelText("E-Mail"), {
      target: { value: "neu@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Passwort"), {
      target: { value: "zu-kurz" },
    });
    fireEvent.change(screen.getByLabelText("Passwort wiederholen"), {
      target: { value: "zu-kurz" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Konto anlegen und beitreten" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(meldung);
    expect(onBeigetreten).not.toHaveBeenCalled();
  });

  it("erkennt die abgelaufene Session über den echten API-Adapter", async () => {
    let vorschauAufrufe = 0;
    const fetchMock = vi.fn(
      async (pfad: RequestInfo | URL): Promise<Response> => {
        const url = String(pfad);
        if (url.endsWith("/accept/")) {
          return {
            ok: false,
            status: 400,
            text: async () =>
              JSON.stringify({ mode: "mode login oder register ist Pflicht." }),
          } as Response;
        }
        vorschauAufrufe += 1;
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              ...VORSCHAU,
              authenticated: vorschauAufrufe === 1,
              already_member: false,
            }),
        } as Response;
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const onSitzungAbgelaufen = vi.fn();
    render(
      <EinladungAnsicht
        token="abc"
        verwaltung={apiBandVerwaltung}
        onBeigetreten={() => {}}
        onSitzungAbgelaufen={onSitzungAbgelaufen}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Band beitreten" }));
    expect(
      await screen.findByText("Deine Anmeldung ist abgelaufen. Bitte erneut anmelden."),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Neues Konto anlegen" }),
    ).toBeInTheDocument();
    expect(onSitzungAbgelaufen).toHaveBeenCalled();
    expect(vorschauAufrufe).toBe(2);
  });

  it("wiederholt nach bestätigtem Beitritt nur das Öffnen statt den POST", async () => {
    const akzeptiereEinladung = vi.fn().mockResolvedValue({
      band: { id: 7, name: "Testband" },
      joined: true,
    });
    const onBeigetreten = vi
      .fn()
      .mockRejectedValueOnce(new ApiFehler(0, "network"))
      .mockResolvedValueOnce(undefined);
    const verwaltung = erstelleVerwaltungTestAdapter({
      pruefeEinladung: async () => ({
        ...VORSCHAU,
        authenticated: true,
        already_member: false,
      }),
      akzeptiereEinladung,
    });
    render(
      <EinladungAnsicht
        token="einmal"
        verwaltung={verwaltung}
        onBeigetreten={onBeigetreten}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Band beitreten" }));
    expect(await screen.findByText("Beitritt bestätigt")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Keine Verbindung zum Server.");
    expect(akzeptiereEinladung).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Band öffnen" }));
    await waitFor(() => expect(onBeigetreten).toHaveBeenCalledTimes(2));
    expect(onBeigetreten).toHaveBeenLastCalledWith("7");
    expect(akzeptiereEinladung).toHaveBeenCalledTimes(1);
  });
});
