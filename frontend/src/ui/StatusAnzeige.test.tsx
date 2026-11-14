import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusAnzeige, type SpeicherZustand } from "./StatusAnzeige";

const ZUSTAENDE: SpeicherZustand[] = [
  "laedt",
  "fehler",
  "entwurf",
  "speichert",
  "gespeichert",
];

describe("StatusAnzeige", () => {
  it("zeigt jeden Zustand unterscheidbar", () => {
    const texte = new Set<string>();
    for (const zustand of ZUSTAENDE) {
      const { unmount } = render(<StatusAnzeige zustand={zustand} />);
      const anzeige = screen.getByRole("status");
      expect(anzeige).toHaveAttribute("data-zustand", zustand);
      texte.add(anzeige.textContent ?? "");
      unmount();
    }
    expect(texte.size).toBe(ZUSTAENDE.length);
  });
});
