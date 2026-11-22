import { apiFetch } from "../api/client";
import { alsBand, type Band, type BandEingabe, type BandRolle } from "./bands";

export interface BandMitglied {
  id: number;
  user_id: number;
  username: string;
  display_name: string;
  role: BandRolle;
  is_self: boolean;
  can_change_role: boolean;
  can_remove: boolean;
}

export interface Einladung {
  id: number;
  note: string;
  expires_at: string;
  revoked_at: string | null;
  uses_count: number;
  max_uses: number | null;
  status: "active" | "expired" | "revoked" | "exhausted";
  created_at: string;
  last_used_at: string | null;
  created_by: string;
}

export interface EinladungErstellt extends Einladung {
  token: string;
  invite_path: string;
}

export interface EinladungEingabe {
  note?: string;
  max_uses?: number | null;
}

export interface EinladungVorschau {
  band_name: string;
  expires_at: string;
  authenticated: boolean;
  already_member: boolean;
}

export interface BeitrittsEingabe {
  mode?: "login" | "register";
  username?: string;
  display_name?: string;
  email?: string;
  password?: string;
}

export interface BeitrittsAntwort {
  band: { id: number | string; name: string };
  joined: boolean;
}

export interface BandVerwaltungAdapter {
  aktualisiereBand(bandId: string, eingabe: BandEingabe): Promise<Band>;
  ladeMitglieder(bandId: string): Promise<BandMitglied[]>;
  aendereMitgliedRolle(
    bandId: string,
    mitgliedId: number,
    rolle: BandRolle,
  ): Promise<BandMitglied[]>;
  entferneMitglied(bandId: string, mitgliedId: number): Promise<void>;
  ladeEinladungen(bandId: string): Promise<Einladung[]>;
  erstelleEinladung(bandId: string, eingabe: EinladungEingabe): Promise<EinladungErstellt>;
  widerrufeEinladung(bandId: string, einladungId: number): Promise<Einladung>;
  pruefeEinladung(token: string): Promise<EinladungVorschau>;
  akzeptiereEinladung(token: string, eingabe: BeitrittsEingabe): Promise<BeitrittsAntwort>;
}

interface BandAntwort {
  id: number;
  name: string;
  genre?: string;
  location?: string;
  description?: string;
  internal_notes?: string;
  role?: BandRolle;
  can_manage?: boolean;
}

function bandPfad(bandId: string, suffix = ""): string {
  return `/api/bands/${encodeURIComponent(bandId)}/${suffix}`;
}

function mitgliedPfad(bandId: string, mitgliedId: number): string {
  return bandPfad(bandId, `members/${encodeURIComponent(String(mitgliedId))}/`);
}

export const apiBandVerwaltung: BandVerwaltungAdapter = {
  async aktualisiereBand(bandId, eingabe) {
    const antwort = await apiFetch<BandAntwort>(bandPfad(bandId), {
      method: "PATCH",
      body: JSON.stringify(eingabe),
    });
    return alsBand(antwort);
  },
  ladeMitglieder(bandId) {
    return apiFetch<BandMitglied[]>(bandPfad(bandId, "members/"));
  },
  aendereMitgliedRolle(bandId, mitgliedId, rolle) {
    return apiFetch<BandMitglied[]>(mitgliedPfad(bandId, mitgliedId), {
      method: "PATCH",
      body: JSON.stringify({ role: rolle }),
    });
  },
  async entferneMitglied(bandId, mitgliedId) {
    await apiFetch<void>(mitgliedPfad(bandId, mitgliedId), { method: "DELETE" });
  },
  ladeEinladungen(bandId) {
    return apiFetch<Einladung[]>(bandPfad(bandId, "invitations/"));
  },
  erstelleEinladung(bandId, eingabe) {
    return apiFetch<EinladungErstellt>(bandPfad(bandId, "invitations/"), {
      method: "POST",
      body: JSON.stringify({
        note: eingabe.note ?? "",
        max_uses: eingabe.max_uses ?? null,
      }),
    });
  },
  widerrufeEinladung(bandId, einladungId) {
    return apiFetch<Einladung>(
      bandPfad(bandId, `invitations/${encodeURIComponent(String(einladungId))}/`),
      { method: "DELETE" },
    );
  },
  pruefeEinladung(token) {
    return apiFetch<EinladungVorschau>(
      `/api/invitations/${encodeURIComponent(token)}/`,
    );
  },
  akzeptiereEinladung(token, eingabe) {
    return apiFetch<BeitrittsAntwort>(
      `/api/invitations/${encodeURIComponent(token)}/accept/`,
      { method: "POST", body: JSON.stringify(eingabe) },
    );
  },
};
