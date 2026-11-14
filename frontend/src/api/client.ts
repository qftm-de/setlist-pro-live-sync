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

/**
 * Fehlertext fürs Formular. Bei abgelaufener Session wird zusätzlich die
 * Anmeldung angefordert, statt nur "Anmeldung erforderlich." anzuzeigen.
 */
export function behandleFehler(
  fehler: unknown,
  beiSitzungAbgelaufen?: () => void,
): string | null {
  if (istApiFehler(fehler) && fehler.code === "unauthenticated") {
    beiSitzungAbgelaufen?.();
    return null;
  }
  return fehlerText(fehler);
}

function csrfToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  for (const eintrag of document.cookie.split("; ")) {
    if (eintrag.startsWith("csrftoken=")) {
      return decodeURIComponent(eintrag.slice("csrftoken=".length));
    }
  }
  return null;
}

export async function apiFetch<T>(pfad: string, init: RequestInit = {}): Promise<T> {
  if (!pfad.startsWith("/") || pfad.startsWith("//") || pfad.includes("\\")) {
    throw new Error("API-Pfad muss relativ zur eigenen Origin sein.");
  }

  const methode = (init.method ?? "GET").toUpperCase();
  const kopfzeilen = new Headers(init.headers);
  if (!kopfzeilen.has("Accept")) {
    kopfzeilen.set("Accept", "application/json");
  }
  if (!["GET", "HEAD", "OPTIONS", "TRACE"].includes(methode)) {
    const token = csrfToken();
    if (token && !kopfzeilen.has("X-CSRFToken")) {
      kopfzeilen.set("X-CSRFToken", token);
    }
  }
  if (
    init.body !== undefined &&
    init.body !== null &&
    typeof init.body === "string" &&
    !kopfzeilen.has("Content-Type")
  ) {
    kopfzeilen.set("Content-Type", "application/json");
  }

  let antwort: Response;
  try {
    antwort = await fetch(pfad, {
      credentials: "same-origin",
      ...init,
      headers: kopfzeilen,
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

  if (antwort.status === 204 || antwort.status === 205) {
    return undefined as T;
  }
  const text = await antwort.text();
  if (!text) {
    return undefined as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiFehler(antwort.status, "invalid_response");
  }
}
