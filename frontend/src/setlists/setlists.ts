import { apiFetch } from "../api/client";
import type { TextAntwort, TextStand } from "../collaboration/texte";

export type AbschnittsArt = "set" | "pause" | "zugabe";
export type EintragsArt = "song" | "pause" | "notiz";

export interface SongKurz {
  id: number;
  title: string;
}

export interface Eintrag {
  id: number;
  uuid?: string;
  position: number;
  entry_type: EintragsArt;
  song: SongKurz | null;
  label: string;
  duration_seconds: number | null;
}

export interface Abschnitt {
  id: number;
  uuid?: string;
  name: string;
  kind: AbschnittsArt;
  position: number;
  entries: Eintrag[];
}

export interface Setlist {
  id: number;
  uuid?: string;
  name: string;
  revision?: number;
  sections: Abschnitt[];
}

export interface SetlistKurz {
  id: number;
  uuid?: string;
  name: string;
  revision?: number;
}

export interface EintragEingabe {
  uuid?: string;
  entry_type: EintragsArt;
  song_id?: number | null;
  label?: string;
  duration_seconds?: number | null;
}

export interface AbschnittEingabe {
  uuid?: string;
  name?: string;
  kind: AbschnittsArt;
  entries: EintragEingabe[];
}

export interface SetlistAdapter {
  ladeSetlists(bandId: string): Promise<SetlistKurz[]>;
  erstelleSetlist(bandId: string, name: string): Promise<Setlist>;
  ladeSetlist(bandId: string, setlistId: number): Promise<Setlist>;
  speichereInhalt(
    bandId: string,
    setlistId: number,
    abschnitte: AbschnittEingabe[],
    revision: number,
  ): Promise<Setlist>;
  loescheSetlist(bandId: string, setlistId: number): Promise<void>;
  ladeTexte?(
    bandId: string,
    setlistId: number,
  ): Promise<{ revision: number; texts: TextStand[] }>;
  sendeText?(
    bandId: string,
    setlistId: number,
    eingabe: {
      object_type: TextStand["object_type"];
      object_uuid: string;
      field: TextStand["field"];
      epoch: number;
      update: string;
    },
  ): Promise<TextAntwort>;
}

function pfad(bandId: string, rest = ""): string {
  return `/api/bands/${encodeURIComponent(bandId)}/setlists/${rest}`;
}

export const apiSetlists: SetlistAdapter = {
  ladeSetlists(bandId) {
    return apiFetch<SetlistKurz[]>(pfad(bandId));
  },
  erstelleSetlist(bandId, name) {
    return apiFetch<Setlist>(pfad(bandId), {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },
  ladeSetlist(bandId, setlistId) {
    return apiFetch<Setlist>(pfad(bandId, `${setlistId}/`));
  },
  speichereInhalt(bandId, setlistId, abschnitte, revision) {
    return apiFetch<Setlist>(pfad(bandId, `${setlistId}/content/`), {
      method: "PUT",
      body: JSON.stringify({ revision, sections: abschnitte }),
    });
  },
  ladeTexte(bandId, setlistId) {
    return apiFetch<{ revision: number; texts: TextStand[] }>(
      pfad(bandId, `${setlistId}/texts/`),
    );
  },
  sendeText(bandId, setlistId, eingabe) {
    return apiFetch<TextAntwort>(pfad(bandId, `${setlistId}/text/`), {
      method: "POST",
      body: JSON.stringify(eingabe),
    });
  },
  async loescheSetlist(bandId, setlistId) {
    await apiFetch<void>(pfad(bandId, `${setlistId}/`), { method: "DELETE" });
  },
};

export function erstelleSetlistTestAdapter(
  vorhandene: Setlist[],
  ergaenzungen: Partial<SetlistAdapter> = {},
): SetlistAdapter {
  const speicher = vorhandene;
  return {
    async ladeSetlists() {
      return speicher.map((setlist) => ({ id: setlist.id, name: setlist.name }));
    },
    async erstelleSetlist(_bandId, name) {
      const neu = {
        id: speicher.length + 1,
        uuid: `setlist-${speicher.length + 1}`,
        name,
        revision: 0,
        sections: [],
      };
      speicher.push(neu);
      return neu;
    },
    async ladeSetlist(_bandId, setlistId) {
      const treffer = speicher.find((setlist) => setlist.id === setlistId);
      if (!treffer) {
        throw new Error("Setlist fehlt im Testadapter");
      }
      return treffer;
    },
    async speichereInhalt(_bandId, setlistId, abschnitte, revision) {
      const setlist = speicher.find((eintrag) => eintrag.id === setlistId);
      if (!setlist) {
        throw new Error("Setlist fehlt im Testadapter");
      }
      setlist.revision = revision + 1;
      setlist.sections = abschnitte.map((abschnitt, abschnittsIndex) => ({
        id: abschnittsIndex + 1,
        uuid: abschnitt.uuid ?? `abschnitt-${abschnittsIndex + 1}`,
        name: abschnitt.name ?? "",
        kind: abschnitt.kind,
        position: abschnittsIndex + 1,
        entries: abschnitt.entries.map((eintrag, eintragsIndex) => ({
          id: eintragsIndex + 1,
          uuid: eintrag.uuid ?? `eintrag-${abschnittsIndex + 1}-${eintragsIndex + 1}`,
          position: eintragsIndex + 1,
          entry_type: eintrag.entry_type,
          song: eintrag.song_id ? { id: eintrag.song_id, title: `Song ${eintrag.song_id}` } : null,
          label: eintrag.label ?? "",
          duration_seconds: eintrag.duration_seconds ?? null,
        })),
      }));
      return setlist;
    },
    async loescheSetlist(_bandId, setlistId) {
      const index = speicher.findIndex((setlist) => setlist.id === setlistId);
      if (index >= 0) {
        speicher.splice(index, 1);
      }
    },
    ...ergaenzungen,
  };
}
