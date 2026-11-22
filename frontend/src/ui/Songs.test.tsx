import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { erstelleTestAdapter } from "../bands/bands";
import { song } from "../test-helfer";
import { Songs } from "./Songs";

describe("Songs Suche", () => {
  const adapter = erstelleTestAdapter([], async (bandId) => ({
    bandId,
    songs: [],
  }));

  it("zeigt den Band-Leerzustand ohne Songs", () => {
    render(<Songs bandId="a" adapter={adapter} songs={[]} />);
    expect(screen.getByText("Keine Songs in dieser Band.")).toBeInTheDocument();
    expect(screen.queryByText("Keine passenden Songs gefunden.")).not.toBeInTheDocument();
  });

  it("zeigt eine Meldung, wenn die Songsuche keinen Treffer liefert", () => {
    render(
      <Songs
        bandId="a"
        adapter={adapter}
        songs={[
          song("Abrissbirne", { id: 1, artist: "Kapelle" }),
          song("Feuerwerk", { id: 2, artist: "Nordwind" }),
        ]}
      />,
    );

    const suche = screen.getByLabelText("Songs suchen");
    fireEvent.change(suche, { target: { value: "unbekannt" } });

    expect(screen.getByText("Keine passenden Songs gefunden.")).toBeInTheDocument();
    expect(screen.queryByText("Abrissbirne")).not.toBeInTheDocument();

    fireEvent.change(suche, { target: { value: "nord" } });
    expect(screen.queryByText("Keine passenden Songs gefunden.")).not.toBeInTheDocument();
    expect(screen.getByText("Feuerwerk")).toBeInTheDocument();
    expect(screen.queryByText("Abrissbirne")).not.toBeInTheDocument();
  });
});
