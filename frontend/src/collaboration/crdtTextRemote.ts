import { docAusUpdate, hatLokaleAenderungen } from "./crdtHelfer";
import type { CrdtTextKontext } from "./crdtTextKontext";
import {
  bytesAusBase64,
  setzeText,
  textAusDokument,
  wendeUpdateAn,
} from "./texte";

export function wendeRemoteTextAn(
  kontext: CrdtTextKontext,
  update: string,
  epoch?: number,
  revision?: number,
): void {
  const {
    docRef,
    epochRef,
    ausServerstandRef,
    lokalGeaendertRef,
    standAusEreignisRef,
    letzteEreignisRevisionRef,
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

  const doc = docRef.current;
  if (!doc) {
    return;
  }
  if (typeof revision === "number") {
    letzteEreignisRevisionRef.current = revision;
  }
  if (!ausServerstandRef.current) {
    // Erstes Serverereignis vor dem Lesestand: Der lokale Text ist noch
    // nicht CRDT-basiert. Remote-Stand übernehmen, lokales Tippen als
    // Unterschied anwenden statt beide Dokumente zu mischen.
    const serverUpdate = bytesAusBase64(update);
    const neu = docAusUpdate(serverUpdate);
    const serverText = textAusDokument(neu);
    const lokalText = textAusDokument(doc);
    const tippt = lokalGeaendertRef.current;
    if (tippt && lokalText !== serverText) {
      setzeText(neu, lokalText);
    }
    docRef.current = neu;
    docGenerationRef.current += 1;
    ausServerstandRef.current = true;
    standAusEreignisRef.current = true;
    lokalGeaendertRef.current = false;
    if (typeof epoch === "number") {
      epochRef.current = epoch;
    }
    setzeBestaetigt(serverUpdate);
    const inhalt = textAusDokument(neu);
    setWertState(inhalt);
    const offen = hatLokaleAenderungen(neu, updateRef.current);
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
  if (typeof epoch === "number" && epoch < epochRef.current) {
    // Veraltetes Ereignis einer alten Epoche.
    return;
  }
  if (typeof epoch === "number" && epoch > epochRef.current) {
    // REST-Ersatz: neuer, unabhängiger Zustand. Nicht mit dem alten
    // Epoche-Dokument mischen, den Entwurf getrennt behalten.
    const offen = hatLokaleAenderungen(doc, updateRef.current);
    const entwurfText =
      offen ? textAusDokument(doc) : entwurfRef.current;
    setzeEntwurf(entwurfText);
    const neu = docAusUpdate(bytesAusBase64(update));
    docRef.current = neu;
    docGenerationRef.current += 1;
    ausServerstandRef.current = true;
    lokalGeaendertRef.current = false;
    standAusEreignisRef.current = true;
    epochRef.current = epoch;
    setzeBestaetigt(bytesAusBase64(update));
    setWertState(textAusDokument(neu));
    setZustand(entwurfText ? "abgelehnt" : "bestaetigt");
    standCbRef.current?.(textAusDokument(neu));
    return;
  }
  try {
    wendeUpdateAn(doc, update);
  } catch {
    return;
  }
  setzeBestaetigt(bytesAusBase64(update));
  ausServerstandRef.current = true;
  standAusEreignisRef.current = true;
  const text = textAusDokument(doc);
  setWertState(text);
  const offen = hatLokaleAenderungen(doc, updateRef.current);
  setZustand(
    offen
      ? "offen"
      : entwurfRef.current
        ? "abgelehnt"
        : "bestaetigt",
  );
  standCbRef.current?.(text);
  if (offen) {
    planeSenden(true);
  }
}
