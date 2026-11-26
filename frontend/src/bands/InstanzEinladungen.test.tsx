import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiFehler } from "../api/client";
import { InstanzEinladungen } from "./InstanzEinladungen";
import type {
  InstanzEinladung,
  InstanzEinladungErstellt,
  instanzEinladungenApi,
} from "./instanzEinladungen";

type Api = typeof instanzEinladungenApi;

function einladung(over: Partial<InstanzEinladung> = {}): InstanzEinladung {
  return {
    id: 1,
    note: "Band B",
    expires_at: new Date(Date.now() + 86400_000).toISOString(),
    revoked_at: null,
    uses_count: 0,
    max_uses: null,
    status: "active",
    created_at: new Date().toISOString(),
    last_used_at: null,
    ...over,
  };
}

function adapter(over: Partial<Api> = {}): Api {
  return {
    lade: vi.fn().mockResolvedValue([]),
    erstelle: vi.fn(),
    widerrufe: vi.fn(),
    ...over,
  } as unknown as Api;
}

describe("InstanzEinladungen", () => {
  it("bleibt fuer Nicht-Betreiber unsichtbar", async () => {
    const api = adapter({
      lade: vi.fn().mockRejectedValue(new ApiFehler(403, "forbidden")),
    });
    const { container } = render(<InstanzEinladungen api={api} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(screen.queryByText("Weitere Band einladen")).toBeNull();
  });

  it("zeigt fuer den Betreiber das Formular", async () => {
    render(<InstanzEinladungen api={adapter()} />);
    expect(
      await screen.findByText("Weitere Band einladen"),
    ).toBeInTheDocument();
  });

  it("erstellt einen Link und zeigt ihn einmal an", async () => {
    const neu: InstanzEinladungErstellt = {
      ...einladung({ note: "Band B" }),
      token: "geheim",
      invite_path: "/beitritt/geheim",
    };
    const api = adapter({ erstelle: vi.fn().mockResolvedValue(neu) });
    render(<InstanzEinladungen api={api} />);
    await screen.findByText("Weitere Band einladen");
    fireEvent.change(screen.getByLabelText("Hinweis"), {
      target: { value: "Band B" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Einladungslink erstellen" }));
    await waitFor(() =>
      expect(api.erstelle).toHaveBeenCalledWith({
        note: "Band B",
        tage: 14,
        max_uses: null,
      }),
    );
    expect(await screen.findByText("Link, nur einmal sichtbar:")).toBeInTheDocument();
    expect(screen.getByText(/\/beitritt\/geheim$/)).toBeInTheDocument();
    expect(screen.getByText("Band B")).toBeInTheDocument();
  });

  it("weist eine Laufzeit ausserhalb der Grenzen ab", async () => {
    const api = adapter();
    render(<InstanzEinladungen api={api} />);
    await screen.findByText("Weitere Band einladen");
    fireEvent.change(screen.getByLabelText("Laufzeit in Tagen"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Einladungslink erstellen" }));
    expect(
      await screen.findByText("Laufzeit liegt zwischen 1 und 90 Tagen."),
    ).toBeInTheDocument();
    expect(api.erstelle).not.toHaveBeenCalled();
  });

  it("widerruft eine aktive Einladung", async () => {
    const api = adapter({
      lade: vi.fn().mockResolvedValue([einladung()]),
      widerrufe: vi.fn().mockResolvedValue(einladung({ status: "revoked" })),
    });
    render(<InstanzEinladungen api={api} />);
    fireEvent.click(await screen.findByRole("button", { name: "Widerrufen" }));
    await waitFor(() => expect(api.widerrufe).toHaveBeenCalledWith(1));
    expect(await screen.findByText("Widerrufen")).toBeInTheDocument();
  });
});
