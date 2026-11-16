import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { istApiFehler } from "../api/client";
import { docAusUpdate, hatLokaleAenderungen } from "./crdtHelfer";
import {
  base64AusBytes,
  bytesAusBase64,
  deltaUpdate,
  dokumentAusStand,
  setzeText,
  textAusDokument,
  wendeUpdateAn,
  zustandsVektor,
  type TextAntwort,
  type TextStand,
} from "./texte";

export type TextZustand =
  | "bestaetigt"
  | "offen"
  | "abgelehnt"
  | "fehler"
  | "pausiert";

export interface CrdtTextOptionen {
  stand?: TextStand | null;
  wert: string;
  aktiv: boolean;
  senden: (update: string, epoch: number) => Promise<TextAntwort>;
  onBestaetigt?: (text: string, epoch: number) => void;
  onWert?: (text: string) => void;
  onStand?: (text: string) => void;
  onKonflikt?: () => void;
}

export interface CrdtTextHandle {
  wert: string;
  zustand: TextZustand;
  fehler: string | null;
  entwurf: string | null;
  setWert: (wert: string) => void;
  sendeJetzt: () => void;
  uebernehmen: () => void;
  wendeRemoteAn: (update: string, epoch?: number, revision?: number) => void;
}

export function useCrdtText(optionen: CrdtTextOptionen): CrdtTextHandle {
  const docRef = useRef<Y.Doc | null>(null);
  const svRef = useRef<Uint8Array | null>(null);
  const updateRef = useRef<Uint8Array | null>(null);
  const epochRef = useRef(optionen.stand?.epoch ?? 0);
  const timerRef = useRef<number | null>(null);
  const sendetRef = useRef(false);
  const sendenRef = useRef(optionen.senden);
  const aktivRef = useRef(optionen.aktiv);
  const bestaetigtCbRef = useRef(optionen.onBestaetigt);
  const wertCbRef = useRef(optionen.onWert);
  const standCbRef = useRef(optionen.onStand);
  const konfliktCbRef = useRef(optionen.onKonflikt);
  const sendeJetztRef = useRef<() => void>(() => undefined);
  sendenRef.current = optionen.senden;
  aktivRef.current = optionen.aktiv;
  bestaetigtCbRef.current = optionen.onBestaetigt;
  wertCbRef.current = optionen.onWert;
  standCbRef.current = optionen.onStand;
  konfliktCbRef.current = optionen.onKonflikt;

  const [wert, setWertState] = useState(optionen.wert);
  const [zustand, setZustand] = useState<TextZustand>("bestaetigt");
  const [fehler, setFehler] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState<string | null>(null);
  const entwurfRef = useRef<string | null>(null);
  const ausServerstandRef = useRef(Boolean(optionen.stand?.state));
  const lokalGeaendertRef = useRef(false);
  const standAusEreignisRef = useRef(false);
  const letzteEreignisRevisionRef = useRef(0);
  const ausgangstextRef = useRef(optionen.wert);
  const docGenerationRef = useRef(0);

  const setzeEntwurf = useCallback((wert: string | null) => {
    entwurfRef.current = wert;
    setEntwurf(wert);
  }, []);

  const timerLoeschen = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const planeSenden = useCallback(
    (sofort = false) => {
      timerLoeschen();
      if (!aktivRef.current || sendetRef.current) {
        return;
      }
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        sendeJetztRef.current();
      }, sofort ? 0 : 250);
    },
    [timerLoeschen],
  );

  const setzeBestaetigt = useCallback((update: Uint8Array) => {
    updateRef.current = update;
    svRef.current = zustandsVektor(docAusUpdate(update));
  }, []);

  const initialisieren = useCallback(
    (stand: TextStand | null | undefined, text: string) => {
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
    },
    [planeSenden, setzeBestaetigt],
  );

  useEffect(() => {
    initialisieren(optionen.stand, optionen.wert);
    // Nur ein neuer Serverstand startet den Zustand neu. Lokale Werte
    // dürfen den laufenden Text nicht zurücksetzen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initialisieren,
    optionen.stand?.epoch,
    optionen.stand?.revision,
    optionen.stand?.state,
  ]);

  const sendeJetzt = useCallback(() => {
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
  }, [setzeBestaetigt, timerLoeschen]);

  sendeJetztRef.current = sendeJetzt;

  const setWert = useCallback(
    (neu: string) => {
      const doc = docRef.current;
      if (!doc) {
        setWertState(neu);
        return;
      }
      setzeText(doc, neu);
      lokalGeaendertRef.current = true;
      setFehler(null);
      setWertState(textAusDokument(doc));
      setZustand(aktivRef.current ? "offen" : "pausiert");
      wertCbRef.current?.(textAusDokument(doc));
      planeSenden();
    },
    [planeSenden],
  );

  const uebernehmen = useCallback(() => {
    if (entwurf === null) {
      return;
    }
    setWert(entwurf);
  }, [entwurf, setWert]);

  const wendeRemoteAn = useCallback(
    (update: string, epoch?: number, revision?: number) => {
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
    },
    [planeSenden, setzeBestaetigt, setzeEntwurf],
  );

  useEffect(
    () => () => {
      timerLoeschen();
    },
    [timerLoeschen],
  );

  return {
    wert,
    zustand,
    fehler,
    entwurf,
    setWert,
    sendeJetzt,
    uebernehmen,
    wendeRemoteAn,
  };
}
