import * as Y from "yjs";
import { hatLokaleAenderungen } from "./crdtHelfer";
import type { CrdtTextKontext } from "./crdtTextKontext";
import {
  bytesAusBase64,
  dokumentAusStand,
  setzeText,
  textAusDokument,
  wendeUpdateAn,
  type TextStand,
} from "./texte";

export function initialisiereText(
  kontext: CrdtTextKontext,
  stand: TextStand | null | undefined,
  text: string,
): void {
  const {
    docRef,
    epochRef,
    ausServerstandRef,
    lokalGeaendertRef,
    standAusEreignisRef,
    letzteEreignisRevisionRef,
    ausgangstextRef,
    docGenerationRef,
    updateRef,
    entwurfRef,
    setWertState,
    setZustand,
    standCbRef,
    setzeEntwurf,
    planeSenden,
    setzeBestaetigt,
  } = kontext;

  const neuerEpoch = stand?.epoch ?? 0;
  const doc = docRef.current;
  if (stand?.state && neuerEpoch < epochRef.current) {
    // Veralteter Stand nach einem Epochenwechsel.
    return;
  }
  if (
    stand?.state &&
    standAusEreignisRef.current &&
    neuerEpoch <= epochRef.current
  ) {
    // Ein Ereignisstand ist neuer als dieser Lesestand, es sei denn der
    // Lesestand trägt eine höhere Revision.
    if ((stand.revision ?? 0) <= letzteEreignisRevisionRef.current) {
      if (doc && hatLokaleAenderungen(doc, updateRef.current)) {
        planeSenden(true);
      }
      return;
    }
    standAusEreignisRef.current = false;
  }
  if (stand?.state && !ausServerstandRef.current) {
    // Erster echter Serverstand: Dokument daraus aufbauen. Nur ein echt
    // getippter Text wird als Unterschied übernommen. Ein unveränderter
    // oder veralteter Prop darf neueren Servertext nicht überschreiben.
    const docText = doc ? textAusDokument(doc) : text;
    const echtGeaendert =
      lokalGeaendertRef.current && docText !== ausgangstextRef.current;
    const neu = dokumentAusStand(stand, text);
    const serverText = textAusDokument(neu);
    const ziel = echtGeaendert ? docText : serverText;
    if (ziel !== serverText) {
      setzeText(neu, ziel);
    }
    docRef.current = neu;
    docGenerationRef.current += 1;
    ausServerstandRef.current = true;
    lokalGeaendertRef.current = false;
    ausgangstextRef.current = serverText;
    standAusEreignisRef.current = false;
    epochRef.current = neuerEpoch;
    setzeBestaetigt(bytesAusBase64(stand.state));
    const inhalt = textAusDokument(neu);
    setWertState(inhalt);
    const offen = hatLokaleAenderungen(neu, updateRef.current);
    setZustand(
      offen ? "offen" : entwurfRef.current ? "abgelehnt" : "bestaetigt",
    );
    standCbRef.current?.(inhalt);
    if (offen) {
      planeSenden(true);
    }
    return;
  }
  if (doc && stand?.state && neuerEpoch === epochRef.current) {
    // Gleiche Epoche: Stand einmischen, offene lokale Ops behalten.
    try {
      wendeUpdateAn(doc, stand.state);
    } catch {
      // Ein beschädigter Fremdstand ersetzt nichts.
    }
    setzeBestaetigt(bytesAusBase64(stand.state));
    const inhalt = textAusDokument(doc);
    setWertState(inhalt);
    const offen = hatLokaleAenderungen(doc, updateRef.current);
    setZustand(
      offen
        ? "offen"
        : entwurfRef.current
          ? "abgelehnt"
          : "bestaetigt",
    );
    standCbRef.current?.(inhalt);
    if (offen) {
      planeSenden(true);
    }
    return;
  }

  // Neuer Stand oder neue Epoche.
  if (doc) {
    const offen = hatLokaleAenderungen(doc, updateRef.current);
    const neuerEntwurf =
      offen ? textAusDokument(doc) : entwurfRef.current;
    setzeEntwurf(neuerEntwurf);
    setZustand(neuerEntwurf ? "abgelehnt" : "bestaetigt");
  }
  const neu = dokumentAusStand(stand, text);
  docRef.current = neu;
  docGenerationRef.current += 1;
  ausServerstandRef.current = Boolean(stand?.state);
  standAusEreignisRef.current = false;
  const inhalt = textAusDokument(neu);
  epochRef.current = neuerEpoch;
  setzeBestaetigt(
    stand?.state ? bytesAusBase64(stand.state) : Y.encodeStateAsUpdate(neu),
  );
  setWertState(inhalt);
  standCbRef.current?.(inhalt);
}
