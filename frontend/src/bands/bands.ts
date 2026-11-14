import { apiFetch } from "../api/client";

export interface Band {
  id: string;
  name: string;
}

export interface BandDaten {
  bandId: string;
  songs: string[];
}

export interface BandAdapter {
  ladeBands(): Promise<Band[]>;
  ladeBandDaten(bandId: string): Promise<BandDaten>;
}

export const apiBands: BandAdapter = {
  ladeBands() {
    return apiFetch<Band[]>("/api/bands/");
  },
  ladeBandDaten(bandId) {
    return apiFetch<BandDaten>(`/api/bands/${encodeURIComponent(bandId)}/`);
  },
};

export function erstelleTestAdapter(
  bands: Band[],
  ladeDaten: (bandId: string) => Promise<BandDaten>,
): BandAdapter {
  return {
    async ladeBands() {
      return bands;
    },
    ladeBandDaten: ladeDaten,
  };
}
