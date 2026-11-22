import { erstelleTestAdapter, type Band, type Song } from "./bands/bands";
import type { SessionAdapter } from "./session/session";

export const KONFIGURATION = {
  mode: "core" as const,
  instanceName: "Testinstanz",
  communityUrl: null,
};

export function verzögert<T>() {
  let aufloesen!: (wert: T) => void;
  let ablehnen!: (grund?: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    aufloesen = resolve;
    ablehnen = reject;
  });
  return { promise, aufloesen, ablehnen };
}

export function sitzungAdapter(angemeldet = true, benutzername = "anna"): SessionAdapter {
  return {
    ladeSitzung: async () => ({ angemeldet, benutzername }),
    anmelden: async () => ({ angemeldet: true, benutzername }),
    abmelden: async () => {},
  };
}

export function bandAdapterMitSongs(
  start: Song[],
  bands: Band[] = [{ id: "a", name: "Band A" }],
) {
  const songs = [...start];
  let naechsteId = 100;
  return erstelleTestAdapter(bands, async (bandId) => ({ bandId, songs: [...songs] }), {
    erstelleSong: async (_bandId, eingabe) => {
      naechsteId += 1;
      const neu = { id: naechsteId, ...eingabe };
      songs.push(neu);
      return neu;
    },
    aendereSong: async (_bandId, songId, eingabe) => {
      const index = songs.findIndex((eintrag) => eintrag.id === songId);
      songs[index] = { ...songs[index], ...eingabe };
      return songs[index];
    },
    loescheSong: async (_bandId, songId) => {
      const index = songs.findIndex((eintrag) => eintrag.id === songId);
      if (index >= 0) {
        songs.splice(index, 1);
      }
    },
  });
}

export function song(titel: string, zusatz: Partial<Song> = {}): Song {
  return { id: 1, title: titel, ...zusatz };
}
