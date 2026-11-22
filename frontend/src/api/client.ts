export type ApiFehlerCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "server"
  | "network"
  | "bad_request"
  | "conflict"
  | "too_large"
  | "invalid_response";

const TEXTE: Record<ApiFehlerCode, string> = {
  unauthenticated: "Anmeldung erforderlich.",
  forbidden: "Fehlende Berechtigung.",
  not_found: "Bereich noch nicht verfügbar.",
  server: "Serverfehler. Bitte erneut versuchen.",
  network: "Keine Verbindung zum Server.",
  bad_request: "Die Anfrage wurde abgelehnt. Bitte Eingaben prüfen.",
  conflict: "Der Stand wurde inzwischen geändert. Bitte neu laden.",
  too_large: "Die Datei ist zu groß.",
  invalid_response: "Unerwartete Antwort des Servers.",
};

export class ApiFehler extends Error {
  readonly status: number;
  readonly code: ApiFehlerCode;
  /** Klartext des Servers, falls er einen mitschickt (nur 4xx). */
  readonly meldung?: string;
  readonly daten?: Record<string, unknown>;

  constructor(
    status: number,
    code: ApiFehlerCode,
    meldung?: string,
    daten?: Record<string, unknown>,
  ) {
    super(TEXTE[code]);
    this.name = "ApiFehler";
    this.status = status;
    this.code = code;
    this.meldung = meldung;
    this.daten = daten;
  }
}

export function istApiFehler(fehler: unknown): fehler is ApiFehler {
  return fehler instanceof ApiFehler;
}

export function fehlerText(fehler: unknown): string {
  if (!istApiFehler(fehler)) {
    return TEXTE.invalid_response;
  }
  return fehler.meldung || fehler.message;
}

/** Erste Klartextmeldung aus einer DRF-Fehlerantwort, ohne interne Details. */
function serverMeldung(text: string): string | undefined {
  if (!text) {
    return undefined;
  }
  let daten: unknown;
  try {
    daten = JSON.parse(text);
  } catch {
    return undefined;
  }
  const suche = (wert: unknown): string | undefined => {
    if (typeof wert === "string") {
      return wert.trim() || undefined;
    }
    if (Array.isArray(wert)) {
      for (const eintrag of wert) {
        const treffer = suche(eintrag);
        if (treffer) {
          return treffer;
        }
      }
      return undefined;
    }
    if (wert && typeof wert === "object") {
      for (const eintrag of Object.values(wert)) {
        const treffer = suche(eintrag);
        if (treffer) {
          return treffer;
        }
      }
    }
    return undefined;
  };
  const meldung = suche(daten);
  return meldung && meldung.length <= 200 ? meldung : undefined;
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

async function liesFehlerdaten(
  antwort: Response,
): Promise<{ text: string; daten?: Record<string, unknown> }> {
  let text = "";
  try {
    text = await antwort.text();
  } catch {
    text = "";
  }
  let daten: Record<string, unknown> | undefined;
  try {
    const roh = text ? JSON.parse(text) : null;
    daten = roh && typeof roh === "object" ? roh : undefined;
  } catch {
    daten = undefined;
  }
  return { text, daten };
}

async function pruefeAntwort(antwort: Response): Promise<never> {
  if (antwort.status === 401) {
    throw new ApiFehler(401, "unauthenticated");
  }
  if (antwort.status === 403) {
    throw new ApiFehler(403, "forbidden");
  }
  if (antwort.status === 404) {
    throw new ApiFehler(404, "not_found");
  }
  if (antwort.status === 409) {
    const { text, daten } = await liesFehlerdaten(antwort);
    throw new ApiFehler(409, "conflict", serverMeldung(text), daten);
  }
  if (antwort.status === 413) {
    throw new ApiFehler(413, "too_large");
  }
  if (antwort.status >= 500) {
    throw new ApiFehler(antwort.status, "server");
  }
  const { text, daten } = await liesFehlerdaten(antwort);
  throw new ApiFehler(antwort.status, "bad_request", serverMeldung(text), daten);
}

function pruefePfad(pfad: string): void {
  if (!pfad.startsWith("/") || pfad.startsWith("//") || pfad.includes("\\")) {
    throw new Error("API-Pfad muss relativ zur eigenen Origin sein.");
  }
}

export async function apiFetch<T>(pfad: string, init: RequestInit = {}): Promise<T> {
  pruefePfad(pfad);

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
    await pruefeAntwort(antwort);
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

/** Lädt private Binärdateien über dieselbe Origin und mit denselben Fehlern. */
export async function apiFetchDatei(pfad: string): Promise<ArrayBuffer> {
  pruefePfad(pfad);
  let antwort: Response;
  try {
    antwort = await fetch(pfad, {
      credentials: "same-origin",
      headers: { Accept: "application/pdf" },
    });
  } catch {
    throw new ApiFehler(0, "network");
  }
  if (!antwort.ok) {
    await pruefeAntwort(antwort);
  }
  try {
    const daten = await antwort.arrayBuffer();
    if (daten.byteLength === 0) {
      throw new Error("leer");
    }
    return daten;
  } catch (fehler) {
    if (fehler instanceof Error && fehler.message === "leer") {
      throw new ApiFehler(antwort.status, "invalid_response");
    }
    throw new ApiFehler(0, "network");
  }
}
