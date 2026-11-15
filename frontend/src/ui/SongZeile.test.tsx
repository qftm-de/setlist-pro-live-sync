import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BandAdapter, Song } from "../bands/bands";
import { SongZeile } from "./SongZeile";

const song: Song = { id: 1, title: "Alt", artist: "A", key: "C", bpm: 100, notes: "n" };

function zeile(aktuell: Song) {
  return (
    <SongZeile
      bandId="1"
      song={aktuell}
      adapter={{} as BandAdapter}
      onAendern={vi.fn()}
      onLoeschen={vi.fn()}
    />
  );
}

describe("SongZeile", () => {
  it("öffnet das Formular mit den aktuellen Werten statt denen vom ersten Rendern", () => {
    const { rerender } = render(zeile(song));

    rerender(zeile({ ...song, title: "Neu", bpm: 120 }));
    fireEvent.click(screen.getByRole("button", { name: "Neu ändern" }));

    expect(screen.getByLabelText("Titel (ändern)")).toHaveValue("Neu");
    expect(screen.getByLabelText("BPM (ändern)")).toHaveValue(120);
  });
});
