import { istApiFehler } from "../api/client";
import { docAusUpdate, hatLokaleAenderungen } from "./crdtHelfer";
import type { CrdtTextKontext } from "./crdtTextKontext";
import {
  base64AusBytes,
  bytesAusBase64,
  deltaUpdate,
  textAusDokument,
  wendeUpdateAn,
  zustandsVektor,
} from "./texte";

export function sendeTextJetzt(kontext: CrdtTextKontext): void {
  const {
    docRef,
    svRef,
    updateRef,
    epochRef,
    sendetRef,
    sendenRef,
    aktivRef,
    bestaetigtCbRef,
    wertCbRef,
    konfliktCbRef,
    entwurfRef,
    docGenerationRef,
    setFehler,
    setZustand,
    setWertState,
    setzeEntwurf,
    planeSenden,
    setzeBestaetigt,
    timerLoeschen,
  } = kontext;

  timerLoeschen();
  const doc = docRef.current;
  if (!doc || sendetRef.current) {
    return;
  }
  if (!hatLokaleAenderungen(doc, updateRef.current)) {
    setZustand("bestaetigt");
    return;
  }
  const update = deltaUpdate(doc, svRef.current ?? zustandsVektor(doc));
  if (!aktivRef.current) {
    setZustand("pausiert");
    return;
  }
  sendetRef.current = true;
  setFehler(null);
  const gesendeteEpoche = epochRef.current;
  const gesendeteGeneration = docGenerationRef.current;
  setZustand("offen");
  void sendenRef
    .current(base64AusBytes(update), epochRef.current)
    .then((antwort) => {
      const aktuell = docRef.current;
      if (!aktuell) {
        return;
      }
      if (
        epochRef.current !== gesendeteEpoche ||
        docGenerationRef.current !== gesendeteGeneration
      ) {
        // Antwort einer überholten Sendung nach einem Epochenwechsel.
        sendetRef.current = false;
        setZustand(
          hatLokaleAenderungen(aktuell, updateRef.current)
            ? "offen"
            : entwurfRef.current
              ? "abgelehnt"
              : "bestaetigt",
        );
        return;
      }
      wendeUpdateAn(aktuell, antwort.update);
      setzeBestaetigt(bytesAusBase64(antwort.update));
      epochRef.current = antwort.epoch;
      const text = textAusDokument(aktuell);
      setWertState(text);
      setzeEntwurf(null);
      sendetRef.current = false;
      const offen = hatLokaleAenderungen(aktuell, updateRef.current);
      if (offen) {
        setZustand("offen");
        planeSenden(true);
      } else {
        setZustand("bestaetigt");
      }
      setFehler(null);
      bestaetigtCbRef.current?.(antwort.text, antwort.epoch);
      wertCbRef.current?.(text);
    })
    .catch((fehler: unknown) => {
      sendetRef.current = false;
      if (
        epochRef.current !== gesendeteEpoche ||
        docGenerationRef.current !== gesendeteGeneration
      ) {
        // Ein alter Fehler darf den neuen Entwurf nicht überschreiben.
        const aktuell = docRef.current;
        setZustand(
          aktuell && hatLokaleAenderungen(aktuell, updateRef.current)
            ? "offen"
            : entwurfRef.current
              ? "abgelehnt"
              : "bestaetigt",
        );
        return;
      }
      if (istApiFehler(fehler) && fehler.code === "conflict") {
        const aktuell = docRef.current;
        const neueEpoche = fehler.daten?.current_epoch;
        if (typeof neueEpoche === "number") {
          setFehler(null);
          if (aktuell) {
            setzeEntwurf(textAusDokument(aktuell));
          }
          // Die neue Epoche kommt gleich mit dem neu geladenen Stand.
          // Hier nicht vorwegnehmen, sonst mischt der Reload beide Stände.
          const bestaetigt = docAusUpdate(
            updateRef.current ?? new Uint8Array(),
          );
          docRef.current = bestaetigt;
          docGenerationRef.current += 1;
          svRef.current = zustandsVektor(bestaetigt);
          const text = textAusDokument(bestaetigt);
          setWertState(text);
          setZustand("abgelehnt");
          wertCbRef.current?.(text);
          konfliktCbRef.current?.();
          return;
        }
        // Namens- oder Feldkonflikt: der Serverstand ist unverändert.
        // Den lokalen Text behalten und den Grund sichtbar machen.
        if (aktuell) {
          setzeEntwurf(textAusDokument(aktuell));
        }
        setFehler(fehler.meldung ?? "Der Text wurde abgelehnt.");
        setZustand("abgelehnt");
        return;
      }
      setFehler("Senden fehlgeschlagen. Bitte erneut versuchen.");
      setZustand(aktivRef.current ? "fehler" : "pausiert");
    });
}
