import { ApiFehler } from "../api/client";
import type {
  Anmerkung,
  AnmerkungAenderung,
  AnmerkungAdapter,
  AnmerkungEingabe,
} from "./annotations";

export function anmerkungTestAdapter(
  start: Anmerkung[] = [],
  ergaenzungen: Partial<AnmerkungAdapter> = {},
): AnmerkungAdapter {
  let liste = [...start];
  let naechste = Math.max(0, ...start.map((eintrag) => eintrag.id)) + 1;
  return {
    async lade() {
      return [...liste];
    },
    async erstelle(_bandId, _songId, _versionId, eingabe: AnmerkungEingabe) {
      const neu: Anmerkung = {
        id: naechste,
        uuid: eingabe.uuid,
        page_number: eingabe.page_number,
        kind: eingabe.kind,
        visibility: eingabe.visibility,
        geometry: eingabe.geometry,
        color: eingabe.color,
        text: eingabe.text ?? "",
        font_size: (eingabe.font_size ?? null) as Anmerkung["font_size"],
        revision: 0,
        permission_generation: 0,
        text_epoch: 0,
        text_revision: 0,
        text_state: "",
        author_id: 1,
        can_edit: true,
        can_delete: true,
        can_change_visibility: true,
        created_at: "2026-11-15T08:00:00Z",
        updated_at: "2026-11-15T08:00:00Z",
      };
      naechste += 1;
      liste = [...liste, neu];
      return neu;
    },
    async aendere(
      _bandId,
      _songId,
      _versionId,
      id: number,
      revision: number,
      aenderung: AnmerkungAenderung,
    ) {
      const alt = liste.find((eintrag) => eintrag.id === id);
      if (!alt || alt.revision !== revision) {
        throw new ApiFehler(409, "conflict");
      }
      const neu: Anmerkung = {
        ...alt,
        ...aenderung,
        font_size: (aenderung.font_size ?? alt.font_size) as Anmerkung["font_size"],
        revision: revision + 1,
      };
      liste = liste.map((eintrag) => (eintrag.id === id ? neu : eintrag));
      return neu;
    },
    async loesche(_bandId, _songId, _versionId, id: number) {
      liste = liste.filter((eintrag) => eintrag.id !== id);
    },
    ...ergaenzungen,
  };
}

export function testAnmerkung(zusatz: Partial<Anmerkung> = {}): Anmerkung {
  return {
    id: 1,
    uuid: "00000000-0000-4000-8000-000000000001",
    page_number: 1,
    kind: "text",
    visibility: "private",
    geometry: { x: 0.1, y: 0.1, width: 0.2, height: 0.05 },
    color: "gelb",
    text: "Leiser",
    font_size: 0.0225,
    revision: 0,
    permission_generation: 0,
    text_epoch: 0,
    text_revision: 0,
    text_state: "",
    author_id: 1,
    can_edit: true,
    can_delete: true,
    can_change_visibility: true,
    created_at: "2026-11-15T08:00:00Z",
    updated_at: "2026-11-15T08:00:00Z",
    ...zusatz,
  };
}
