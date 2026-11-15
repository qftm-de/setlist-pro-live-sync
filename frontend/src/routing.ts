export type AppBereich = "start" | "songs" | "setlists" | "gigs";

export interface AppRoute {
  bereich: AppBereich;
  bandId: string | null;
  setlistId: number | null;
  bandFehler?: string;
}

function ohneAnhang(pfad: string): string {
  return pfad.split("?")[0].split("#")[0];
}

export function parseRoute(pfad: string): AppRoute {
  const rein = ohneAnhang(pfad);
  const direkt = rein.match(/^\/setlists\/([^/]+)\/(\d+)\/?$/);
  if (direkt) {
    try {
      return {
        bereich: "setlists",
        bandId: decodeURIComponent(direkt[1]),
        setlistId: Number(direkt[2]),
      };
    } catch {
      return {
        bereich: "setlists",
        bandId: null,
        setlistId: Number(direkt[2]),
        bandFehler: "Diese Band ist für dich nicht sichtbar.",
      };
    }
  }
  if (rein === "/gigs" || rein.startsWith("/gigs/")) {
    return { bereich: "gigs", bandId: null, setlistId: null };
  }
  if (rein === "/songs" || rein.startsWith("/songs/")) {
    return { bereich: "songs", bandId: null, setlistId: null };
  }
  if (rein === "/setlists" || rein.startsWith("/setlists/")) {
    return { bereich: "setlists", bandId: null, setlistId: null };
  }
  return { bereich: "start", bandId: null, setlistId: null };
}

export function bereichAktiv(ziel: string, aktuell: string): boolean {
  if (ziel === "/") {
    return aktuell === "/";
  }
  return aktuell === ziel || aktuell.startsWith(`${ziel}/`);
}
