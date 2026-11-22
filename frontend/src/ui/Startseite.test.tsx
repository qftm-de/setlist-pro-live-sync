import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiFehler } from "../api/client";
import type { GigAdapter, GigGruppen } from "../gigs/gigs";
import { gig, gruppen } from "../gigs/testhelfer";
import { Startseite } from "./Startseite";

function testAdapter(ladeGigs: GigAdapter["ladeGigs"]): GigAdapter {
  return {
    ladeGigs,
    erstelleGig: vi.fn(),
    aendereGig: vi.fn(),
    loescheGig: vi.fn(),
  };
}

describe("Startseite Echtzeit-Abgleich", () => {
  it("lädt den nächsten Auftritt bei Echtzeit-Aktualisierung neu", async () => {
    const onNavigieren = vi.fn();
    const onSitzungAbgelaufen = vi.fn();
    const ladeGigs = vi
      .fn<() => Promise<GigGruppen>>()
      .mockResolvedValueOnce(
        gruppen({ upcoming: [gig({ id: 1, title: "Sommerfest", date: "2026-06-20" })] }),
      )
      .mockResolvedValueOnce(
        gruppen({ upcoming: [gig({ id: 2, title: "Herbstprobe", date: "2026-09-10" })] }),
      );
    const adapter = testAdapter(ladeGigs);
    const { rerender } = render(
      <Startseite
        bandId="a"
        adapter={adapter}
        aktualisierung={0}
        onNavigieren={onNavigieren}
        onSitzungAbgelaufen={onSitzungAbgelaufen}
      />,
    );

    expect(await screen.findByText("Sommerfest")).toBeInTheDocument();

    rerender(
      <Startseite
        bandId="a"
        adapter={adapter}
        aktualisierung={1}
        onNavigieren={onNavigieren}
        onSitzungAbgelaufen={onSitzungAbgelaufen}
      />,
    );

    expect(await screen.findByText("Herbstprobe")).toBeInTheDocument();
    expect(ladeGigs).toHaveBeenCalledTimes(2);
  });

  it("übernimmt Auftritte direkt aus der Sync-Vorgabe", async () => {
    const onNavigieren = vi.fn();
    const onSitzungAbgelaufen = vi.fn();
    const ladeGigs = vi.fn<() => Promise<GigGruppen>>().mockResolvedValue(gruppen());
    const adapter = testAdapter(ladeGigs);
    const { rerender } = render(
      <Startseite
        bandId="a"
        adapter={adapter}
        vorgabe={null}
        onNavigieren={onNavigieren}
        onSitzungAbgelaufen={onSitzungAbgelaufen}
      />,
    );

    expect(await screen.findByText("Noch kein kommender Auftritt.")).toBeInTheDocument();

    rerender(
      <Startseite
        bandId="a"
        adapter={adapter}
        vorgabe={gruppen({
          upcoming: [gig({ id: 5, title: "Clubkonzert", date: "2026-10-05" })],
        })}
        onNavigieren={onNavigieren}
        onSitzungAbgelaufen={onSitzungAbgelaufen}
      />,
    );

    expect(await screen.findByText("Clubkonzert")).toBeInTheDocument();
  });

  it("behält den bestätigten Auftritt bei fehlgeschlagenem Echtzeit-Nachladen", async () => {
    const onNavigieren = vi.fn();
    const onSitzungAbgelaufen = vi.fn();
    const ladeGigs = vi
      .fn<() => Promise<GigGruppen>>()
      .mockResolvedValueOnce(
        gruppen({ upcoming: [gig({ id: 1, title: "Stadtfest", date: "2026-07-01" })] }),
      )
      .mockRejectedValueOnce(new ApiFehler(500, "server"))
      .mockResolvedValueOnce(
        gruppen({ upcoming: [gig({ id: 3, title: "Neuer Termin", date: "2026-08-01" })] }),
      );
    const adapter = testAdapter(ladeGigs);
    const { rerender } = render(
      <Startseite
        bandId="a"
        adapter={adapter}
        aktualisierung={0}
        onNavigieren={onNavigieren}
        onSitzungAbgelaufen={onSitzungAbgelaufen}
      />,
    );

    expect(await screen.findByText("Stadtfest")).toBeInTheDocument();

    rerender(
      <Startseite
        bandId="a"
        adapter={adapter}
        aktualisierung={1}
        onNavigieren={onNavigieren}
        onSitzungAbgelaufen={onSitzungAbgelaufen}
      />,
    );

    expect(await screen.findByText("Serverfehler. Bitte erneut versuchen.")).toBeInTheDocument();
    expect(screen.getByText("Stadtfest")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    await waitFor(() => expect(screen.getByText("Neuer Termin")).toBeInTheDocument());
  });
});
