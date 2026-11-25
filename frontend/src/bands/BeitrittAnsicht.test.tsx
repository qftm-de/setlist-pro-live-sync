import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiFehler } from "../api/client";
import { parseRoute } from "../routing";
import { BeitrittAnsicht } from "./BeitrittAnsicht";
import type { BeitrittAdapter, BeitrittVorschau } from "./beitritt";

const VORSCHAU: BeitrittVorschau = {
  kind: "instanz",
  note: "Für die Nachbarband",
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  authenticated: false,
};

function adapter(
  teile: Partial<BeitrittAdapter> = {},
): BeitrittAdapter {
  return {
    pruefe: async () => VORSCHAU,
    akzeptiere: async () => ({ konto_angelegt: true, note: "" }),
    ...teile,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BeitrittAnsicht", () => {
  it("legt über den Link ein Konto an und meldet Fertig", async () => {
    const akzeptiere = vi.fn().mockResolvedValue({
      konto_angelegt: true,
      note: "",
    });
    const onFertig = vi.fn();
    render(
      <BeitrittAnsicht
        token="abc"
        api={adapter({ akzeptiere })}
        onFertig={onFertig}
      />,
    );

    expect(await screen.findByText(/Einladung zum Server/)).toBeInTheDocument();
    expect(screen.getByText("Für die Nachbarband")).toBeInTheDocument();

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
    fireEvent.click(screen.getByRole("button", { name: "Konto anlegen" }));

    await waitFor(() => expect(akzeptiere).toHaveBeenCalledTimes(1));
    expect(akzeptiere).toHaveBeenCalledWith("abc", {
      mode: "register",
      username: "neu",
      display_name: "Neue Nina",
      email: "neu@example.test",
      password: "testpasswort-1111",
    });
    expect(onFertig).toHaveBeenCalledTimes(1);
  });

  it("zeigt abweichende Passwörter ohne Aufruf", async () => {
    const akzeptiere = vi.fn();
    render(
      <BeitrittAnsicht
        token="abc"
        api={adapter({ akzeptiere })}
        onFertig={() => {}}
      />,
    );
    await screen.findByText(/Einladung zum Server/);
    fireEvent.change(screen.getByLabelText("Benutzername"), {
      target: { value: "neu" },
    });
    fireEvent.change(screen.getByLabelText("E-Mail"), {
      target: { value: "neu@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Passwort"), {
      target: { value: "eins-123456" },
    });
    fireEvent.change(screen.getByLabelText("Passwort wiederholen"), {
      target: { value: "zwei-123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Konto anlegen" }));
    expect(
      await screen.findByText("Die Passwörter stimmen nicht überein."),
    ).toBeInTheDocument();
    expect(akzeptiere).not.toHaveBeenCalled();
  });

  it("meldet einen ungültigen Link verständlich", async () => {
    render(
      <BeitrittAnsicht
        token="alt"
        api={adapter({
          pruefe: async () => {
            throw new ApiFehler(404, "not_found");
          },
        })}
        onFertig={() => {}}
      />,
    );
    expect(
      await screen.findByText(
        "Dieser Einladungslink ist ungültig oder abgelaufen.",
      ),
    ).toBeInTheDocument();
  });

  it("meldet einen zwischenzeitlich ungueltigen Link beim Absenden", async () => {
    const akzeptiere = vi
      .fn()
      .mockRejectedValue(new ApiFehler(404, "not_found"));
    render(
      <BeitrittAnsicht
        token="abc"
        api={adapter({ akzeptiere })}
        onFertig={() => {}}
      />,
    );
    await screen.findByText(/Einladung zum Server/);
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
      target: { value: "testpasswort-1111" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Konto anlegen" }));
    expect(
      await screen.findByText(
        "Dieser Einladungslink ist ungültig oder abgelaufen.",
      ),
    ).toBeInTheDocument();
  });

  it("haelt einen Fehler beim Absenden sichtbar", async () => {
    const akzeptiere = vi
      .fn()
      .mockRejectedValue(new ApiFehler(400, "bad_request"));
    render(
      <BeitrittAnsicht
        token="abc"
        api={adapter({ akzeptiere })}
        onFertig={() => {}}
      />,
    );
    await screen.findByText(/Einladung zum Server/);
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
      target: { value: "testpasswort-1111" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Konto anlegen" }));
    const meldung = await screen.findByRole("alert");
    expect(meldung.textContent).not.toBe("");
  });

  it("bietet angemeldeten Nutzern den Weg zur Band", async () => {
    const onFertig = vi.fn();
    render(
      <BeitrittAnsicht
        token="abc"
        api={adapter({ pruefe: async () => ({ ...VORSCHAU, authenticated: true }) })}
        onFertig={onFertig}
      />,
    );
    expect(
      await screen.findByText(/Du bist bereits angemeldet/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Weiter zur Band" }));
    expect(onFertig).toHaveBeenCalledTimes(1);
  });
});

describe("parseRoute", () => {
  it("trennt Instanz- und Band-Einladung", () => {
    expect(parseRoute("/beitritt/abc").inviteArt).toBe("instanz");
    expect(parseRoute("/beitritt/abc").inviteToken).toBe("abc");
    expect(parseRoute("/einladung/abc").inviteArt).toBe("band");
    expect(parseRoute("/einladung/abc").inviteToken).toBe("abc");
    const kaputt = parseRoute("/beitritt/%E0%A4%A");
    expect(kaputt.inviteArt).toBe("instanz");
    expect(kaputt.inviteToken).toBeNull();
    for (const pfad of ["/beitritt", "/beitritt/"]) {
      const ohne = parseRoute(pfad);
      expect(ohne.inviteArt).toBe("instanz");
      expect(ohne.inviteToken).toBeNull();
    }
  });
});
