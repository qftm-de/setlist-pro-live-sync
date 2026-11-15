import { apiFetch } from "../api/client";

export interface Gig {
  id: number;
  title: string;
  date: string;
  time: string | null;
  location: string;
  notes: string;
  setlist_id: number | null;
  setlist_name: string | null;
}

export interface GigEingabe {
  title: string;
  date: string;
  time: string | null;
  location: string;
  notes: string;
  setlist_id?: number | null;
}

export interface GigGruppen {
  upcoming: Gig[];
  past: Gig[];
}

export interface GigAdapter {
  ladeGigs(bandId: string): Promise<GigGruppen>;
  erstelleGig(bandId: string, eingabe: GigEingabe): Promise<Gig>;
  aendereGig(
    bandId: string,
    gigId: number,
    eingabe: Partial<GigEingabe>,
  ): Promise<Gig>;
  loescheGig(bandId: string, gigId: number): Promise<void>;
}

function pfad(bandId: string, rest = ""): string {
  return `/api/bands/${encodeURIComponent(bandId)}/gigs/${rest}`;
}

export const apiGigs: GigAdapter = {
  ladeGigs(bandId) {
    return apiFetch<GigGruppen>(pfad(bandId));
  },
  erstelleGig(bandId, eingabe) {
    return apiFetch<Gig>(pfad(bandId), {
      method: "POST",
      body: JSON.stringify(eingabe),
    });
  },
  aendereGig(bandId, gigId, eingabe) {
    return apiFetch<Gig>(pfad(bandId, `${gigId}/`), {
      method: "PATCH",
      body: JSON.stringify(eingabe),
    });
  },
  async loescheGig(bandId, gigId) {
    await apiFetch<void>(pfad(bandId, `${gigId}/`), { method: "DELETE" });
  },
};

function sortiert(gigs: Gig[], absteigend = false): Gig[] {
  return [...gigs].sort((a, b) => {
    if (a.date !== b.date) {
      const richtung = a.date < b.date ? -1 : 1;
      return absteigend ? -richtung : richtung;
    }
    if (a.time !== b.time) {
      if (a.time === null) {
        return 1;
      }
      if (b.time === null) {
        return -1;
      }
      return a.time < b.time ? -1 : 1;
    }
    return a.id - b.id;
  });
}

export function erstelleGigTestAdapter(
  start: Gig[] = [],
  heute = "2026-06-15",
): GigAdapter {
  const liste = start.map((gig) => ({ ...gig }));
  let naechsteId = liste.reduce((hoechste, gig) => Math.max(hoechste, gig.id), 0) + 1;

  return {
    async ladeGigs() {
      return {
        upcoming: sortiert(liste.filter((gig) => gig.date >= heute)).map((gig) => ({
          ...gig,
        })),
        past: sortiert(
          liste.filter((gig) => gig.date < heute),
          true,
        ).map((gig) => ({ ...gig })),
      };
    },
    async erstelleGig(_bandId, eingabe) {
      const neu: Gig = {
        id: naechsteId,
        title: eingabe.title,
        date: eingabe.date,
        time: eingabe.time,
        location: eingabe.location,
        notes: eingabe.notes,
        setlist_id: eingabe.setlist_id ?? null,
        setlist_name: null,
      };
      naechsteId += 1;
      liste.push(neu);
      return { ...neu };
    },
    async aendereGig(_bandId, gigId, eingabe) {
      const index = liste.findIndex((gig) => gig.id === gigId);
      if (index < 0) {
        throw new Error("Auftritt fehlt im Testadapter");
      }
      liste[index] = { ...liste[index], ...eingabe };
      return { ...liste[index] };
    },
    async loescheGig(_bandId, gigId) {
      const index = liste.findIndex((gig) => gig.id === gigId);
      if (index >= 0) {
        liste.splice(index, 1);
      }
    },
  };
}
