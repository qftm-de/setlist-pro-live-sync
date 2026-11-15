import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BandAdapter } from "../bands/bands";
import { Songs } from "./Songs";

function adapter(): BandAdapter {
  return {
    async ladeBands() {
      return [];
    },
    async ladeBandDaten(bandId) {
      return { bandId, songs: [] };
    },
    async erstelleBand(name) {
      return { id: "a", name };
    },
    async erstelleSong() {
      throw new Error("nicht erwartet");
    },
    async aendereSong() {
      throw new Error("nicht erwartet");
    },
    async loescheSong() {
      throw new Error("nicht erwartet");
    },
  };
}

describe("Songs", () => {
  it("markiert einen entfernten Song im offenen Formular und behält den Entwurf", () => {
    const eigenschaften = {
      bandId: "a",
      adapter: adapter(),
      songs: [{ id: 1, title: "Alt" }],
    };
    const { rerender } = render(<Songs {...eigenschaften} />);
    fireEvent.click(screen.getByRole("button", { name: "Alt ändern" }));
    fireEvent.change(screen.getByLabelText("Titel (ändern)"), {
      target: { value: "Mein Entwurf" },
    });

    rerender(<Songs {...eigenschaften} songs={[]} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Dieser Song wurde inzwischen gelöscht",
    );
    expect(screen.getByLabelText("Titel (ändern)")).toHaveValue("Mein Entwurf");
    expect(screen.getByRole("button", { name: "Änderung speichern" })).toBeDisabled();
  });

  it("meldet keinen Löschmarker für einen weiterhin vorhandenen Song", () => {
    const eigenschaften = {
      bandId: "a",
      adapter: adapter(),
      songs: [{ id: 1, title: "Alt" }],
    };
    const { rerender } = render(<Songs {...eigenschaften} />);
    fireEvent.click(screen.getByRole("button", { name: "Alt ändern" }));
    rerender(
      <Songs {...eigenschaften} songs={[{ id: 1, title: "Alt (neu)" }]} />,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Titel (ändern)")).toHaveValue("Alt");
  });
});
