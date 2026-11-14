export type ApiFehlerCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "server"
  | "network"
  | "bad_request"
  | "invalid_response";

const TEXTE: Record<ApiFehlerCode, string> = {
  unauthenticated: "Anmeldung erforderlich.",
  forbidden: "Fehlende Berechtigung.",
  not_found: "Bereich noch nicht verfügbar.",
  server: "Serverfehler. Bitte erneut versuchen.",
  network: "Keine Verbindung zum Server.",
  bad_request: "Die Anfrage wurde abgelehnt. Bitte Eingaben prüfen.",
  invalid_response: "Unerwartete Antwort des Servers.",
};

export class ApiFehler extends Error {
  readonly status: number;
  readonly code: ApiFehlerCode;

  constructor(status: number, code: ApiFehlerCode) {
    super(TEXTE[code]);
    this.name = "ApiFehler";
    this.status = status;
    this.code = code;
  }
}

export function istApiFehler(fehler: unknown): fehler is ApiFehler {
  return fehler instanceof ApiFehler;
}

export function fehlerText(fehler: unknown): string {
  return istApiFehler(fehler) ? fehler.message : TEXTE.invalid_response;
}

export async function apiFetch<T>(pfad: string, init: RequestInit = {}): Promise<T> {
  if (!pfad.startsWith("/") || pfad.startsWith("//")) {
    throw new Error("API-Pfad muss relativ zur eigenen Origin sein.");
  }

  let antwort: Response;
  try {
    antwort = await fetch(pfad, {
      credentials: "same-origin",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiFehler(0, "network");
  }

  if (!antwort.ok) {
    if (antwort.status === 401) {
      throw new ApiFehler(401, "unauthenticated");
    }
    if (antwort.status === 403) {
      throw new ApiFehler(403, "forbidden");
    }
    if (antwort.status === 404) {
      throw new ApiFehler(404, "not_found");
    }
    if (antwort.status >= 500) {
      throw new ApiFehler(antwort.status, "server");
    }
    throw new ApiFehler(antwort.status, "bad_request");
  }

  try {
    return (await antwort.json()) as T;
  } catch {
    throw new ApiFehler(antwort.status, "invalid_response");
  }
}
