import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EinladungAnsicht } from "./EinladungAnsicht";
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

describe("EinladungAnsicht", () => {
  it("legt über den Link ein Konto an und meldet den Beitritt", async () => {
    const akzeptiereEinladung = vi.fn().mockResolvedValue({
      band: { id: 7, name: "Testband" },
      joined: true,
    });
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
    expect(await screen.findByText(/Einladung zu Testband/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Benutzername"), {
      target: { value: "neu" },
    });
    fireEvent.change(screen.getByLabelText("Anzeigename"), {
      target: { value: "Neue Nina" },
    });
    fireEvent.change(screen.getByLabelText("E-Mail"), {
      target: { value: "neu@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Passwort"), {
      target: { value: "testpasswort-1111" },
    });
    fireEvent.change(screen.getByLabelText("Passwort wiederholen"), {
      target: { value: "testpasswort-1111" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Konto anlegen und beitreten" }),
    );
    await waitFor(() =>
      expect(akzeptiereEinladung).toHaveBeenCalledWith(
        "abc",
        expect.objectContaining({ mode: "register", username: "neu" }),
      ),
    );
    await waitFor(() => expect(onBeigetreten).toHaveBeenCalledWith("7"));
  });

  it("meldet ein bestehendes Konto an", async () => {
    const akzeptiereEinladung = vi.fn().mockResolvedValue({
      band: { id: 7, name: "Testband" },
      joined: true,
    });
    const verwaltung = erstelleVerwaltungTestAdapter({
      pruefeEinladung: async () => VORSCHAU,
      akzeptiereEinladung,
    });
    render(
      <EinladungAnsicht token="abc" verwaltung={verwaltung} onBeigetreten={() => {}} />,
    );
    await screen.findByLabelText("Benutzername");
    fireEvent.click(
      screen.getByRole("button", { name: "Mit bestehendem Konto anmelden" }),
    );
    fireEvent.change(screen.getByLabelText("Benutzername"), {
      target: { value: "alt" },
    });
    fireEvent.change(screen.getByLabelText("Passwort"), {
      target: { value: "geheim-1234" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Anmelden und beitreten" }),
    );
    await waitFor(() =>
      expect(akzeptiereEinladung).toHaveBeenCalledWith(
        "abc",
        expect.objectContaining({ mode: "login", username: "alt" }),
      ),
    );
  });

  it("zeigt angemeldeten Mitgliedern den direkten Einstieg", async () => {
    const akzeptiereEinladung = vi.fn().mockResolvedValue({
      band: { id: 7, name: "Testband" },
      joined: false,
    });
    const onBeigetreten = vi.fn();
    const verwaltung = erstelleVerwaltungTestAdapter({
      pruefeEinladung: async () => ({
        ...VORSCHAU,
        authenticated: true,
        already_member: true,
      }),
      akzeptiereEinladung,
    });
    render(
      <EinladungAnsicht
        token="abc"
        verwaltung={verwaltung}
        onBeigetreten={onBeigetreten}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Band öffnen" }));
    await waitFor(() =>
      expect(akzeptiereEinladung).toHaveBeenCalledWith("abc", {}),
    );
    await waitFor(() => expect(onBeigetreten).toHaveBeenCalledWith("7"));
  });

});
