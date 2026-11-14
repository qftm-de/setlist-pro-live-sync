import { apiFetch } from "../api/client";

export interface Band {
  id: string;
  name: string;
}

export interface Song {
  id: number;
  title: string;
  artist?: string;
  key?: string;
  bpm?: number | null;
  notes?: string;
}

export interface SongEingabe {
  title: string;
  artist?: string;
  key?: string;
  bpm?: number | null;
  notes?: string;
}

export interface BandDaten {
  bandId: string;
  songs: Song[];
}

export interface BandAdapter {
  ladeBands(): Promise<Band[]>;
  ladeBandDaten(bandId: string): Promise<BandDaten>;
  erstelleBand(name: string): Promise<Band>;
  erstelleSong(bandId: string, eingabe: SongEingabe): Promise<Song>;
  aendereSong(bandId: string, songId: number, eingabe: SongEingabe): Promise<Song>;
  loescheSong(bandId: string, songId: number): Promise<void>;
}

interface BandAntwort {
  id: number;
  name: string;
  songs?: Song[];
}

function alsBand(antwort: BandAntwort): Band {
  return { id: String(antwort.id), name: antwort.name };
}

export const apiBands: BandAdapter = {
  async ladeBands() {
    const antwort = await apiFetch<BandAntwort[]>("/api/bands/");
    return antwort.map(alsBand);
  },
  async ladeBandDaten(bandId) {
    const antwort = await apiFetch<BandAntwort>(`/api/bands/${encodeURIComponent(bandId)}/`);
    return { bandId, songs: antwort.songs ?? [] };
  },
  async erstelleBand(name) {
    const antwort = await apiFetch<BandAntwort>("/api/bands/", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    return alsBand(antwort);
  },
  erstelleSong(bandId, eingabe) {
    return apiFetch<Song>(`/api/bands/${encodeURIComponent(bandId)}/songs/`, {
      method: "POST",
      body: JSON.stringify(eingabe),
    });
  },
  aendereSong(bandId, songId, eingabe) {
    return apiFetch<Song>(
      `/api/bands/${encodeURIComponent(bandId)}/songs/${encodeURIComponent(String(songId))}/`,
      { method: "PATCH", body: JSON.stringify(eingabe) },
    );
  },
  async loescheSong(bandId, songId) {
    await apiFetch<void>(
      `/api/bands/${encodeURIComponent(bandId)}/songs/${encodeURIComponent(String(songId))}/`,
      { method: "DELETE" },
    );
  },
};

export function erstelleTestAdapter(
  bands: Band[],
  ladeDaten: (bandId: string) => Promise<BandDaten>,
  ergaenzungen: Partial<BandAdapter> = {},
): BandAdapter {
  return {
    async ladeBands() {
      return bands;
    },
    ladeBandDaten: ladeDaten,
    async erstelleBand(name) {
      return { id: String(bands.length + 1), name };
    },
    async erstelleSong(_bandId, eingabe) {
      return { id: 1, ...eingabe };
    },
    async aendereSong(_bandId, songId, eingabe) {
      return { id: songId, ...eingabe };
    },
    async loescheSong() {},
    ...ergaenzungen,
  };
}
