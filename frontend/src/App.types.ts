import type { ComponentType } from "react";
import type { AnmerkungAdapter } from "./annotations/annotations";
import type { LaufzeitKonfiguration } from "./api/config";
import type { Band, BandAdapter } from "./bands/bands";
import type { DokumentAdapter } from "./documents/documents";
import type { PdfViewerProps } from "./documents/PdfViewer";
import type { GigAdapter } from "./gigs/gigs";
import type { SessionAdapter } from "./session/session";
import type { SetlistAdapter } from "./setlists/setlists";

export interface AppProps {
  konfigurationLaden?: () => Promise<LaufzeitKonfiguration>;
  sessionAdapter?: SessionAdapter;
  bandAdapter?: BandAdapter;
  setlistAdapter?: SetlistAdapter;
  gigAdapter?: GigAdapter;
  dokumentAdapter?: DokumentAdapter;
  anmerkungAdapter?: AnmerkungAdapter;
  dokumentViewer?: ComponentType<PdfViewerProps>;
}

export type KonfigurationZustand =
  | { status: "laedt" }
  | { status: "fehler"; fehler: string }
  | { status: "fertig"; konfiguration: LaufzeitKonfiguration };

export type SitzungZustand =
  | { status: "laedt" }
  | { status: "fehler"; fehler: string }
  | { status: "anonym" }
  | { status: "angemeldet"; benutzername: string; benutzerId?: number };

export type BandsZustand =
  | { status: "laedt" }
  | { status: "fehler"; fehler: string }
  | { status: "fertig"; bands: Band[] };
