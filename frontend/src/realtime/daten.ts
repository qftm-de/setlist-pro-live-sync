import type { Song } from "../bands/bands";
import type { GigGruppen } from "../gigs/gigs";
import type { Zaehler } from "./typen";

export interface SyncDaten {
  band: {
    id: number;
    name: string;
    genre?: string;
    location?: string;
    description?: string;
    internal_notes?: string;
    role?: "owner" | "member" | null;
    can_manage?: boolean;
  };
  songs: Song[];
  setlists: Array<{ id: number; name: string }>;
  gigs: GigGruppen;
  counters: Zaehler;
  server_time: string;
  stage?: unknown | null;
}
