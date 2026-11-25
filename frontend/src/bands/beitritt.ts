import { apiFetch } from "../api/client";

/** Vorschau einer Instanz-Einladung: kein Bandbezug, nur Konto. */
export interface BeitrittVorschau {
  kind: "instanz";
  note: string;
  expires_at: string;
  authenticated: boolean;
}

export interface BeitrittEingabe {
  mode: "login" | "register";
  username: string;
  display_name?: string;
  email?: string;
  password: string;
}

export interface BeitrittAntwort {
  konto_angelegt: boolean;
  note: string;
}

export interface BeitrittAdapter {
  pruefe(token: string): Promise<BeitrittVorschau>;
  akzeptiere(token: string, eingabe: BeitrittEingabe): Promise<BeitrittAntwort>;
}

export const beitrittApi: BeitrittAdapter = {
  pruefe(token) {
    return apiFetch<BeitrittVorschau>(
      `/api/beitritt/${encodeURIComponent(token)}/`,
    );
  },
  akzeptiere(token, eingabe) {
    return apiFetch<BeitrittAntwort>(
      `/api/beitritt/${encodeURIComponent(token)}/accept/`,
      { method: "POST", body: JSON.stringify(eingabe) },
    );
  },
};
