import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { docAusUpdate, hatLokaleAenderungen } from "./crdtHelfer";
import { initialisiereText } from "./crdtTextInitialisieren";
import type { CrdtTextKontext, TextZustand } from "./crdtTextKontext";
import { wendeRemoteTextAn } from "./crdtTextRemote";
import { sendeTextJetzt } from "./crdtTextSenden";
import {
  setzeText,
  textAusDokument,
  zustandsVektor,
  type TextAntwort,
  type TextStand,
} from "./texte";

export type { TextZustand } from "./crdtTextKontext";

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
  const warAktivRef = useRef(optionen.aktiv);
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

  const kontext = useMemo<CrdtTextKontext>(
    () => ({
      docRef,
      svRef,
      updateRef,
      epochRef,
      sendetRef,
      sendenRef,
      aktivRef,
      bestaetigtCbRef,
      wertCbRef,
      standCbRef,
      konfliktCbRef,
      entwurfRef,
      ausServerstandRef,
      lokalGeaendertRef,
      standAusEreignisRef,
      letzteEreignisRevisionRef,
      ausgangstextRef,
      docGenerationRef,
      setWertState,
      setZustand,
      setFehler,
      setzeEntwurf,
      planeSenden,
      setzeBestaetigt,
      timerLoeschen,
    }),
    [planeSenden, setzeBestaetigt, setzeEntwurf, timerLoeschen],
  );

  const initialisieren = useCallback(
    (stand: TextStand | null | undefined, text: string) => {
      initialisiereText(kontext, stand, text);
    },
    [kontext],
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

  useEffect(() => {
    const vorher = warAktivRef.current;
    warAktivRef.current = optionen.aktiv;
    if (
      !vorher &&
      optionen.aktiv &&
      docRef.current &&
      hatLokaleAenderungen(docRef.current, updateRef.current)
    ) {
      // Nach einer Unterbrechung pausierte lokale Änderungen nachsenden.
      planeSenden(true);
    }
  }, [optionen.aktiv, planeSenden]);

  const sendeJetzt = useCallback(() => {
    sendeTextJetzt(kontext);
  }, [kontext]);

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
      wendeRemoteTextAn(kontext, update, epoch, revision);
    },
    [kontext],
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
