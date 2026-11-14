import { apiFetch, istApiFehler } from "../api/client";

export interface Sitzung {
  angemeldet: boolean;
  benutzername?: string;
}

export interface SessionAdapter {
  ladeSitzung(): Promise<Sitzung>;
}

interface SitzungsAntwort {
  username: string;
}

export const apiSitzung: SessionAdapter = {
  async ladeSitzung() {
    try {
      const antwort = await apiFetch<SitzungsAntwort>("/api/session/");
      return { angemeldet: true, benutzername: antwort.username };
    } catch (fehler) {
      if (istApiFehler(fehler) && fehler.code === "unauthenticated") {
        return { angemeldet: false };
      }
      throw fehler;
    }
  },
};
