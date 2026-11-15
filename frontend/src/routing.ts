export type AppBereich = "start" | "songs" | "setlists" | "gigs" | "document";

export interface AppRoute {
  bereich: AppBereich;
  bandId: string | null;
  setlistId: number | null;
  songId: number | null;
  versionId: number | null;
  bandFehler?: string;
}

function ohneAnhang(pfad: string): string {
  return pfad.split("?")[0].split("#")[0];
}

function leereRoute(bereich: AppBereich): AppRoute {
  return {
    bereich,
    bandId: null,
    setlistId: null,
    songId: null,
    versionId: null,
  };
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
        songId: null,
        versionId: null,
      };
    } catch {
      return {
        bereich: "setlists",
        bandId: null,
        setlistId: Number(direkt[2]),
        songId: null,
        versionId: null,
        bandFehler: "Diese Band ist für dich nicht sichtbar.",
      };
    }
  }
  const pdf = rein.match(/^\/songs\/([^/]+)\/(\d+)\/pdf(?:\/versions\/(\d+))?\/?$/);
  if (pdf) {
    const songId = Number(pdf[2]);
    const versionId = pdf[3] ? Number(pdf[3]) : null;
    try {
      return {
        bereich: "document",
        bandId: decodeURIComponent(pdf[1]),
        setlistId: null,
        songId,
        versionId,
      };
    } catch {
      return {
        bereich: "document",
        bandId: null,
        setlistId: null,
        songId,
        versionId,
        bandFehler: "Diese Band ist für dich nicht sichtbar.",
      };
    }
  }
  if (rein === "/gigs" || rein.startsWith("/gigs/")) {
    return leereRoute("gigs");
  }
  if (rein === "/songs" || rein.startsWith("/songs/")) {
    return leereRoute("songs");
  }
  if (rein === "/setlists" || rein.startsWith("/setlists/")) {
    return leereRoute("setlists");
  }
  return leereRoute("start");
}

export function bereichAktiv(ziel: string, aktuell: string): boolean {
  if (ziel === "/") {
    return aktuell === "/";
  }
  return aktuell === ziel || aktuell.startsWith(`${ziel}/`);
}
