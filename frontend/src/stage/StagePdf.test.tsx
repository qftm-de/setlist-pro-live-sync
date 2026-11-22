import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Anmerkung } from "../annotations/annotations";
import type { PdfVorrat } from "../documents/pdfLaden";
import type { StageEintrag } from "./stage";
import { StagePdf } from "./StagePdf";

const gesehen = vi.hoisted(() => [] as number[][]);

vi.mock("../annotations/PdfAnmerkungsEbene", () => ({
  PdfAnmerkungsEbene: ({ annotationen }: { annotationen: Anmerkung[] }) => {
    gesehen.push(annotationen.map((anmerkung) => anmerkung.id));
    return <div data-testid="anmerkungsebene" />;
  },
}));

function anmerkung(id: number, seite: number): Anmerkung {
  return {
    id,
    uuid: `anmerkung-${id}`,
    page_number: seite,
    kind: "text",
    visibility: "band",
    geometry: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 },
    color: "gelb",
    text: `Seite ${seite}`,
    font_size: null,
    revision: 1,
    permission_generation: 1,
    text_epoch: 1,
    text_revision: 1,
    text_state: "",
    author_id: 1,
    can_edit: false,
    can_delete: false,
    can_change_visibility: false,
    created_at: "",
    updated_at: "",
  };
}

const EINTRAG: StageEintrag = {
  uuid: "eintrag-1",
  position: 1,
  entry_type: "song",
  label: "Song 1",
  song: {
    id: 1,
    title: "Song 1",
    artist: "",
    key: "",
    bpm: null,
    notes: "",
  },
  document: {
    version_id: 10,
    page_count: 2,
    byte_size: 1000,
    sha256: "abc",
  },
};

function vorratMitZweiSeiten(): PdfVorrat {
  let dokument: unknown;
  const seite = {
    rotate: 0,
    getViewport: ({ scale }: { scale: number }) => ({
      width: 100 * scale,
      height: 200 * scale,
      scale,
      rotation: 0,
    }),
    render: () => ({ promise: Promise.resolve(), cancel: () => {} }),
    cleanup: () => {},
  };
  dokument = {
    getPage: async () => seite,
  };
  return {
    get: () => dokument,
    lade: async () => dokument,
  } as unknown as PdfVorrat;
}

describe("StagePdf", () => {
  it("zeigt nur Anmerkungen der sichtbaren Seite", async () => {
    const vorrat = vorratMitZweiSeiten();
    const annotationen = [anmerkung(1, 1), anmerkung(2, 2)];
    const { rerender } = render(
      <StagePdf
        bandId="1"
        eintrag={EINTRAG}
        seite={1}
        vorrat={vorrat}
        annotationen={annotationen}
      />,
    );

    await screen.findByTestId("anmerkungsebene");
    await waitFor(() => expect(gesehen.at(-1)).toEqual([1]));

    rerender(
      <StagePdf
        bandId="1"
        eintrag={EINTRAG}
        seite={2}
        vorrat={vorrat}
        annotationen={annotationen}
      />,
    );

    await waitFor(() => expect(gesehen.at(-1)).toEqual([2]));
  });
});
