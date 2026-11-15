import { apiFetch, istApiFehler } from "../api/client";

export interface Sitzung {
  angemeldet: boolean;
  benutzerId?: number;
  benutzername?: string;
}

export interface SessionAdapter {
  ladeSitzung(): Promise<Sitzung>;
  anmelden(benutzer: string, passwort: string): Promise<Sitzung>;
  abmelden(): Promise<void>;
}

interface SitzungsAntwort {
  id: number;
  username: string;
  display_name?: string;
}

function alsSitzung(antwort: SitzungsAntwort): Sitzung {
  return {
    angemeldet: true,
    benutzerId: antwort.id,
    benutzername: antwort.display_name || antwort.username,
  };
}

export const apiSitzung: SessionAdapter = {
  async ladeSitzung() {
    try {
      return alsSitzung(await apiFetch<SitzungsAntwort>("/api/session/"));
    } catch (fehler) {
      if (istApiFehler(fehler) && fehler.code === "unauthenticated") {
        return { angemeldet: false };
      }
      throw fehler;
    }
  },
  async anmelden(benutzer, passwort) {
    return alsSitzung(
      await apiFetch<SitzungsAntwort>("/api/anmeldung/", {
        method: "POST",
        body: JSON.stringify({ username: benutzer, password: passwort }),
      }),
    );
  },
  async abmelden() {
    await apiFetch<void>("/api/abmeldung/", { method: "POST" });
  },
};
