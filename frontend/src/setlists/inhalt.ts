import type {
  Abschnitt,
  AbschnittEingabe,
  AbschnittsArt,
  EintragsArt,
  Setlist,
} from "./setlists";

export interface Zeile {
  schluessel: string;
  uuid?: string;
  art: EintragsArt;
  songId?: number;
  titel: string;
  dauer?: number | null;
}

export interface Block {
  schluessel: string;
  uuid?: string;
  name: string;
  kind: AbschnittsArt;
  zeilen: Zeile[];
}

let zaehler = 0;

export function neuerSchluessel(): string {
  zaehler += 1;
  return `z${zaehler}`;
}

const ART_NAMEN: Record<AbschnittsArt, string> = {
  set: "Set",
  pause: "Pause",
  zugabe: "Zugabe",
};

export function artName(kind: AbschnittsArt): string {
  return ART_NAMEN[kind];
}

function zeileAusEintrag(abschnitt: Abschnitt, index: number): Zeile {
  const eintrag = abschnitt.entries[index];
  const titel =
    eintrag.entry_type === "song"
      ? (eintrag.song?.title ?? eintrag.label)
      : eintrag.label;
  return {
    schluessel: eintrag.uuid ? `e${eintrag.uuid}` : `s${abschnitt.id}-e${eintrag.id}`,
    uuid: eintrag.uuid,
    art: eintrag.entry_type,
    songId: eintrag.song?.id,
    titel,
    dauer: eintrag.duration_seconds,
  };
}

export function bloeckeAusSetlist(setlist: Setlist): Block[] {
  return setlist.sections.map((abschnitt) => ({
    schluessel: abschnitt.uuid ? `a${abschnitt.uuid}` : `a${abschnitt.id}`,
    uuid: abschnitt.uuid,
    name: abschnitt.name,
    kind: abschnitt.kind,
    zeilen: abschnitt.entries.map((_, index) => zeileAusEintrag(abschnitt, index)),
  }));
}

export function eingabeAusBloecken(bloecke: Block[]): AbschnittEingabe[] {
  return bloecke.map((block) => ({
    ...(block.uuid ? { uuid: block.uuid } : {}),
    name: block.name,
    kind: block.kind,
    entries: block.zeilen.map((zeile) => ({
      ...(zeile.uuid ? { uuid: zeile.uuid } : {}),
      ...(zeile.art === "song"
        ? { entry_type: "song" as const, song_id: zeile.songId }
        : { entry_type: zeile.art, label: zeile.titel }),
      duration_seconds: zeile.dauer ?? null,
    })),
  }));
}

export function verschiebe<T>(liste: T[], von: number, nach: number): T[] {
  if (nach < 0 || nach >= liste.length || von === nach) {
    return liste;
  }
  const kopie = [...liste];
  const [eintrag] = kopie.splice(von, 1);
  kopie.splice(nach, 0, eintrag);
  return kopie;
}
