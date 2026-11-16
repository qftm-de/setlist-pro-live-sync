import { apiFetch } from "../api/client";
import type { TextAntwort } from "../collaboration/texte";
import { neueUuid } from "../uuid";

export type AnmerkungsArt = "text" | "marker";
export type AnmerkungsSichtbarkeit = "private" | "band";
export type AnmerkungsFarbe = "gelb" | "orange" | "blau" | "gruen";
export type Schriftgroesse = 0.015 | 0.0225 | 0.03;

export interface Geometrie {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Anmerkung {
  id: number;
  uuid: string;
  page_number: number;
  kind: AnmerkungsArt;
  visibility: AnmerkungsSichtbarkeit;
  geometry: Geometrie;
  color: AnmerkungsFarbe;
  text: string;
  font_size: Schriftgroesse | null;
  revision: number;
  permission_generation: number;
  text_epoch: number;
  text_state: string;
  author_id: number;
  can_edit: boolean;
  can_delete: boolean;
  can_change_visibility: boolean;
  created_at: string;
  updated_at: string;
}

export interface Entwurf {
  uuid: string;
  page_number: number;
  geometry: Geometrie;
}

export interface AnmerkungEingabe {
  uuid: string;
  page_number: number;
  kind: AnmerkungsArt;
  visibility: AnmerkungsSichtbarkeit;
  geometry: Geometrie;
  color: AnmerkungsFarbe;
  text?: string;
  font_size?: number | null;
}

export interface AnmerkungAenderung {
  page_number?: number;
  kind?: AnmerkungsArt;
  visibility?: AnmerkungsSichtbarkeit;
  geometry?: Geometrie;
  color?: AnmerkungsFarbe;
  text?: string;
  font_size?: number | null;
}

export interface AnmerkungAdapter {
  lade(bandId: string, songId: number, versionId: number): Promise<Anmerkung[]>;
  erstelle(
    bandId: string,
    songId: number,
    versionId: number,
    eingabe: AnmerkungEingabe,
  ): Promise<Anmerkung>;
  aendere(
    bandId: string,
    songId: number,
    versionId: number,
    annotationId: number,
    revision: number,
    aenderung: AnmerkungAenderung,
  ): Promise<Anmerkung>;
  loesche(
    bandId: string,
    songId: number,
    versionId: number,
    annotationId: number,
    revision: number,
  ): Promise<void>;
  sendeText?(
    bandId: string,
    songId: number,
    versionId: number,
    annotationId: number,
    eingabe: { epoch: number; generation: number; update: string },
  ): Promise<TextAntwort>;
}

export const FARBEN: AnmerkungsFarbe[] = ["gelb", "orange", "blau", "gruen"];
export const SCHRIFTGROESSEN: Schriftgroesse[] = [0.015, 0.0225, 0.03];

export function farbName(farbe: AnmerkungsFarbe): string {
  return { gelb: "Gelb", orange: "Orange", blau: "Blau", gruen: "Grün" }[farbe];
}

function basis(bandId: string, songId: number, versionId: number): string {
  return (
    `/api/bands/${encodeURIComponent(bandId)}/songs/${encodeURIComponent(String(songId))}` +
    `/document/versions/${encodeURIComponent(String(versionId))}/annotations/`
  );
}

export const apiAnmerkungen: AnmerkungAdapter = {
  lade(bandId, songId, versionId) {
    return apiFetch<Anmerkung[]>(basis(bandId, songId, versionId));
  },
  erstelle(bandId, songId, versionId, eingabe) {
    return apiFetch<Anmerkung>(basis(bandId, songId, versionId), {
      method: "POST",
      body: JSON.stringify(eingabe),
    });
  },
  aendere(bandId, songId, versionId, annotationId, revision, aenderung) {
    return apiFetch<Anmerkung>(
      `${basis(bandId, songId, versionId)}${annotationId}/`,
      {
        method: "PATCH",
        body: JSON.stringify({ ...aenderung, revision }),
      },
    );
  },
  async loesche(bandId, songId, versionId, annotationId, revision) {
    await apiFetch<void>(
      `${basis(bandId, songId, versionId)}${annotationId}/?revision=${revision}`,
      { method: "DELETE" },
    );
  },
  sendeText(bandId, songId, versionId, annotationId, eingabe) {
    return apiFetch<TextAntwort>(
      `${basis(bandId, songId, versionId)}${annotationId}/text/`,
      { method: "POST", body: JSON.stringify(eingabe) },
    );
  },
};

export function neueAnmerkungsId(): string {
  return neueUuid();
}
