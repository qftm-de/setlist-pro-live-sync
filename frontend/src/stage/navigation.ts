import type { StageEintrag, StageSitzung } from "./stage";

export interface Ziel {
  entryUuid: string;
  page: number | null;
}

export function songEintraege(sitzung: StageSitzung): StageEintrag[] {
  return sitzung.sections.flatMap((abschnitt) =>
    abschnitt.entries.filter((eintrag) => eintrag.entry_type === "song"),
  );
}

export function eintragFuer(sitzung: StageSitzung, uuid: string | null) {
  if (!uuid) {
    return null;
  }
  return songEintraege(sitzung).find((eintrag) => eintrag.uuid === uuid) ?? null;
}

export function zielFuerEintrag(eintrag: StageEintrag): Ziel {
  return {
    entryUuid: eintrag.uuid,
    page: eintrag.document ? 1 : null,
  };
}

export function aktuellesZiel(sitzung: StageSitzung): Ziel | null {
  const eintraege = songEintraege(sitzung);
  if (eintraege.length === 0) {
    return null;
  }
  const aktuell = eintragFuer(sitzung, sitzung.current.entry_uuid) ?? eintraege[0];
  const seite =
    aktuell.document !== null && sitzung.current.page !== null
      ? sitzung.current.page
      : zielFuerEintrag(aktuell).page;
  return { entryUuid: aktuell.uuid, page: seite };
}

export function weiter(sitzung: StageSitzung, ziel: Ziel): Ziel | null {
  const eintraege = songEintraege(sitzung);
  const eintrag = eintragFuer(sitzung, ziel.entryUuid);
  if (!eintrag) {
    return eintraege.length > 0 ? zielFuerEintrag(eintraege[0]) : null;
  }
  const seite = ziel.page ?? (eintrag.document ? 1 : null);
  if (eintrag.document && seite !== null && seite < eintrag.document.page_count) {
    return { entryUuid: eintrag.uuid, page: seite + 1 };
  }
  const index = eintraege.findIndex((kandidat) => kandidat.uuid === eintrag.uuid);
  const naechster = eintraege[index + 1];
  return naechster ? zielFuerEintrag(naechster) : null;
}

export function zurueck(sitzung: StageSitzung, ziel: Ziel): Ziel | null {
  const eintraege = songEintraege(sitzung);
  const eintrag = eintragFuer(sitzung, ziel.entryUuid);
  if (!eintrag) {
    return null;
  }
  const seite = ziel.page ?? (eintrag.document ? 1 : null);
  if (eintrag.document && seite !== null && seite > 1) {
    return { entryUuid: eintrag.uuid, page: seite - 1 };
  }
  const index = eintraege.findIndex((kandidat) => kandidat.uuid === eintrag.uuid);
  const vorheriger = eintraege[index - 1];
  if (!vorheriger) {
    return null;
  }
  return {
    entryUuid: vorheriger.uuid,
    page: vorheriger.document ? vorheriger.document.page_count : null,
  };
}

export function seitenAnzeige(
  sitzung: StageSitzung,
  ziel: Ziel,
): { seite: number; gesamt: number } | null {
  const eintrag = eintragFuer(sitzung, ziel.entryUuid);
  if (!eintrag?.document || ziel.page === null) {
    return null;
  }
  return { seite: ziel.page, gesamt: eintrag.document.page_count };
}

export function naechsterSongTitel(sitzung: StageSitzung, ziel: Ziel): string | null {
  const eintraege = songEintraege(sitzung);
  const index = eintraege.findIndex((eintrag) => eintrag.uuid === ziel.entryUuid);
  const naechster = eintraege[index + 1];
  return naechster?.song?.title ?? naechster?.label ?? null;
}
