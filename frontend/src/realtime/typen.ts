export type Verbindungszustand =
  | "verbinden"
  | "verbunden"
  | "unterbrochen"
  | "abgleich"
  | "abgleich-fehlgeschlagen";

export interface Zaehler {
  band: number;
  personal: number;
}

export interface Ereignis {
  stream: "band" | "personal";
  seq: number;
  event: string;
  data: Record<string, unknown>;
}

export interface Zeitgeber {
  setTimeout: (rueckruf: () => void, ms: number) => number;
  clearTimeout: (kennung: number) => void;
  now: () => number;
}

export interface WebSocketLike {
  onopen: ((ereignis: Event) => void) | null;
  onmessage: ((ereignis: MessageEvent) => void) | null;
  onclose: ((ereignis: CloseEvent) => void) | null;
  onerror: ((ereignis: Event) => void) | null;
  send(daten: string): void;
  close(code?: number, grund?: string): void;
}

export interface SyncOptionen {
  bandId: string;
  ladeAbgleich: (bandId: string) => Promise<{ counters: Zaehler; daten?: unknown }>;
  beiEreignis: (ereignis: Ereignis) => void;
  beiZustand: (zustand: Verbindungszustand) => void;
  beiAbgleich?: (daten: unknown) => void;
  beiVerbindungsverlust?: () => void;
  beiBereit?: (info: { connection?: string; counters: Zaehler }) => void;
  beiAntwort?: (nachricht: Record<string, unknown>) => void;
  socketBauen?: (url: string) => WebSocketLike;
  zeit?: Zeitgeber;
  zufall?: () => number;
}
