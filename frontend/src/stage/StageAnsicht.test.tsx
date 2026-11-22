import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Anmerkung } from "../annotations/annotations";
import type { PdfVorrat } from "../documents/pdfLaden";
import type { StageSitzung } from "./stage";
import { StageAnsicht } from "./StageAnsicht";

const gezeigt = vi.hoisted(() => [] as string[]);

vi.mock("./StagePdf", () => ({
  StagePdf: ({
    eintrag,
    annotationen,
  }: {
    eintrag: { song?: { title?: string } } | null;
    annotationen: Anmerkung[];
  }) => {
    gezeigt.push(
      `${eintrag?.song?.title ?? ""}:${annotationen.map((anmerkung) => anmerkung.id).join(",")}`,
    );
    return <div data-testid="buehne-pdf" />;
  },
}));

function anmerkung(id: number): Anmerkung {
  return {
    id,
    uuid: `anmerkung-${id}`,
    page_number: 1,
    kind: "text",
    visibility: "band",
    geometry: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 },
    color: "gelb",
    text: `Anmerkung ${id}`,
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

function sitzung(): StageSitzung {
  return {
    id: 1,
    band_id: 1,
    state: "active",
    generation: 1,
    revision: 1,
    leader_user_id: 1,
    leader_connection_active: true,
    last_number: 0,
    current: { entry_uuid: "song-1", page: 1 },
    started_at: null,
    ended_at: null,
    actions: {
      can_control: false,
      can_handover: false,
      can_takeover: false,
      can_resume: false,
      can_end: false,
    },
    members: [],
    sections: [
      {
        uuid: "abschnitt-1",
        name: "Set",
        kind: "set",
        position: 1,
        entries: [
          {
            uuid: "song-1",
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
              sha256: "a",
            },
          },
          {
            uuid: "song-2",
            position: 2,
            entry_type: "song",
            label: "Song 2",
            song: {
              id: 2,
              title: "Song 2",
              artist: "",
              key: "",
              bpm: null,
              notes: "",
            },
            document: {
              version_id: 20,
              page_count: 2,
              byte_size: 1000,
              sha256: "b",
            },
          },
        ],
      },
    ],
  };
}

describe("StageAnsicht", () => {
  it("zeigt nach lokalem Songwechsel die Anmerkungen des angezeigten Songs", async () => {
    render(
      <StageAnsicht
        bandId="1"
        sitzung={sitzung()}
        verbindungId={null}
        verbunden={false}
        antwort={null}
        sende={() => {}}
        vorrat={{} as PdfVorrat}
        annotationen={{ 10: [anmerkung(1)], 20: [anmerkung(2)] }}
        reserve={null}
        onSitzungAktualisieren={() => {}}
        onAktion={async () => {}}
        onVerlassen={() => {}}
      />,
    );

    expect(gezeigt.at(-1)).toBe("Song 1:1");

    fireEvent.click(screen.getByRole("button", { name: "Song 2" }));

    await waitFor(() => expect(gezeigt.at(-1)).toBe("Song 2:2"));
  });
});
