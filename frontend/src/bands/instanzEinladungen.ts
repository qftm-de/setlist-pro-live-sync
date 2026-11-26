import { apiFetch } from "../api/client";

export interface InstanzEinladung {
  id: number;
  note: string;
  expires_at: string;
  revoked_at: string | null;
  uses_count: number;
  max_uses: number | null;
  status: "active" | "expired" | "revoked" | "exhausted";
  created_at: string;
  last_used_at: string | null;
}

export interface InstanzEinladungErstellt extends InstanzEinladung {
  token: string;
  invite_path: string;
}

export interface InstanzEinladungEingabe {
  note?: string;
  tage?: number;
  max_uses?: number | null;
}

const PFAD = "/api/instanz-einladungen/";

export const instanzEinladungenApi = {
  lade(): Promise<InstanzEinladung[]> {
    return apiFetch<InstanzEinladung[]>(PFAD);
  },
  erstelle(eingabe: InstanzEinladungEingabe): Promise<InstanzEinladungErstellt> {
    return apiFetch<InstanzEinladungErstellt>(PFAD, {
      method: "POST",
      body: JSON.stringify({
        note: eingabe.note ?? "",
        tage: eingabe.tage ?? 14,
        max_uses: eingabe.max_uses ?? null,
      }),
    });
  },
  widerrufe(einladungId: number): Promise<InstanzEinladung> {
    return apiFetch<InstanzEinladung>(
      `${PFAD}${encodeURIComponent(String(einladungId))}/`,
      { method: "DELETE" },
    );
  },
};
