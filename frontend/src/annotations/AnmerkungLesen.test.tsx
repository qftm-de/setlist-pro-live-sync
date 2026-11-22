import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiFehler } from "../api/client";
import { AnmerkungLesen } from "./AnmerkungLesen";
import { AnmerkungsFormulare } from "./AnmerkungsFormulare";
import { testAnmerkung } from "./testhelfer";

describe("AnmerkungLesen Löschbestätigung", () => {
  it("setzt die Löschbestätigung beim Wechsel der Anmerkung zurück", () => {
    const erste = testAnmerkung({
      id: 1,
      text: "Erste Bandnotiz",
      visibility: "band",
      can_edit: false,
      can_delete: true,
    });
    const zweite = testAnmerkung({
      id: 2,
      text: "Zweite Bandnotiz",
      visibility: "band",
      can_edit: false,
      can_delete: true,
    });
    const onLoeschen = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <AnmerkungLesen
        anmerkung={erste}
        onLoeschen={onLoeschen}
        onSchliessen={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Anmerkung löschen" }));
    expect(screen.getByRole("button", { name: "Löschen bestätigen" })).toBeInTheDocument();

    rerender(
      <AnmerkungLesen
        anmerkung={zweite}
        onLoeschen={onLoeschen}
        onSchliessen={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Löschen bestätigen" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anmerkung löschen" })).toBeInTheDocument();
    expect(onLoeschen).not.toHaveBeenCalled();
  });

  it("bricht die Löschbestätigung über Löschen abbrechen ab", () => {
    const anmerkung = testAnmerkung({
      id: 3,
      text: "Bleibt",
      visibility: "band",
      can_edit: false,
      can_delete: true,
    });
    const onLoeschen = vi.fn().mockResolvedValue(undefined);
    render(
      <AnmerkungsFormulare
        entwurf={null}
        ausgewaehlt={anmerkung}
        ersatz={null}
        seiten={2}
        farbe="gelb"
        schriftgroesse={0.0225}
        formRef={{ current: null }}
        onSpeichern={vi.fn().mockResolvedValue(undefined)}
        onLoeschen={onLoeschen}
        onAbbrechenEntwurf={vi.fn()}
        onAbbrechenAuswahl={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Anmerkung löschen" }));
    fireEvent.click(screen.getByRole("button", { name: "Löschen abbrechen" }));

    expect(screen.queryByRole("button", { name: "Löschen bestätigen" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anmerkung löschen" })).toBeInTheDocument();
    expect(onLoeschen).not.toHaveBeenCalled();
  });

  it("führt bei 401 während des Löschens zur Anmeldung zurück", async () => {
    const anmerkung = testAnmerkung({
      id: 4,
      text: "Sitzung abgelaufen",
      visibility: "band",
      can_edit: false,
      can_delete: true,
    });
    const onSitzungAbgelaufen = vi.fn();
    render(
      <AnmerkungsFormulare
        entwurf={null}
        ausgewaehlt={anmerkung}
        ersatz={null}
        seiten={2}
        farbe="gelb"
        schriftgroesse={0.0225}
        formRef={{ current: null }}
        onSpeichern={vi.fn().mockResolvedValue(undefined)}
        onLoeschen={vi.fn().mockRejectedValue(
          new ApiFehler(401, "unauthenticated", "Anmeldung erforderlich."),
        )}
        onAbbrechenEntwurf={vi.fn()}
        onAbbrechenAuswahl={vi.fn()}
        onDirtyChange={vi.fn()}
        onSitzungAbgelaufen={onSitzungAbgelaufen}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Anmerkung löschen" }));
    fireEvent.click(screen.getByRole("button", { name: "Löschen bestätigen" }));

    await waitFor(() => expect(onSitzungAbgelaufen).toHaveBeenCalledTimes(1));
  });
});
