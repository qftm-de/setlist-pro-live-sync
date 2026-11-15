import type { Zeitgeber } from "./typen";

export const HEARTBEAT_MS = 20_000;
export const AUSFALL_MS = 60_000;
export const MAX_WARTE_MS = 30_000;

export function standardZeit(): Zeitgeber {
  return {
    setTimeout: (rueckruf, ms) => window.setTimeout(rueckruf, ms),
    clearTimeout: (kennung) => window.clearTimeout(kennung),
    now: () => Date.now(),
  };
}

export function wartezeit(versuch: number, zufall: () => number = Math.random): number {
  const obergrenze = Math.min(MAX_WARTE_MS, 2 ** Math.max(0, versuch) * 1000);
  return Math.round(1000 + zufall() * (obergrenze - 1000));
}

export function socketUrl(bandId: string): string {
  const schema = window.location.protocol === "https:" ? "wss" : "ws";
  return `${schema}://${window.location.host}/ws/bands/${encodeURIComponent(bandId)}/`;
}
