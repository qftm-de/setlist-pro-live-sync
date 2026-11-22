export type LadeMarke = "gig" | "band";

/**
 * Welche Ansicht muss nach einem bestätigten Ereignis nachladen?
 * Text- und Inhaltsereignisse ändern weder die Auftritte noch die
 * Mitgliederverwaltung und lösen deshalb keinen Abruf aus.
 */
export function ladeMarke(ereignis: string): LadeMarke | null {
  if (ereignis.startsWith("gig.")) {
    return "gig";
  }
  // Auftritte zeigen den Setlist-Namen als Live-Link. Umbenennen und Löschen
  // müssen deshalb die Auftritts- und Startansicht neu laden.
  if (ereignis === "setlist.updated" || ereignis === "setlist.deleted") {
    return "gig";
  }
  if (
    ereignis === "band.updated" ||
    ereignis === "band.members.updated" ||
    ereignis === "band.invitations.updated"
  ) {
    return "band";
  }
  return null;
}
