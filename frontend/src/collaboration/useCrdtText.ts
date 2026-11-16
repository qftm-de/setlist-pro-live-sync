import { useCallback, useEffect, useRef, useState } from "react";
import { istApiFehler } from "../api/client";
import * as Y from "yjs";
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

export type TextZustand = "bestaetigt" | "offen" | "abgelehnt" | "pausiert";

export interface CrdtTextOptionen {
  stand?: TextStand | null;
  wert: string;
  aktiv: boolean;
  senden: (update: string, epoch: number) => Promise<TextAntwort>;
  onBestaetigt?: (text: string, epoch: number) => void;
  onWert?: (text: string) => void;
  onStand?: (text: string) => void;
}

export interface CrdtTextHandle {
  wert: string;
  zustand: TextZustand;
  entwurf: string | null;
  setWert: (wert: string) => void;
  sendeJetzt: () => void;
  uebernehmen: () => void;
  wendeRemoteAn: (update: string) => void;
}

export function useCrdtText(optionen: CrdtTextOptionen): CrdtTextHandle {
  const docRef = useRef<Y.Doc | null>(null);
  const svRef = useRef<Uint8Array | null>(null);
  const updateRef = useRef<Uint8Array | null>(null);
  const epochRef = useRef(optionen.stand?.epoch ?? 0);
  const timerRef = useRef<number | null>(null);
  const sendenRef = useRef(optionen.senden);
  const aktivRef = useRef(optionen.aktiv);
  const bestaetigtCbRef = useRef(optionen.onBestaetigt);
  const wertCbRef = useRef(optionen.onWert);
  const standCbRef = useRef(optionen.onStand);
  sendenRef.current = optionen.senden;
  aktivRef.current = optionen.aktiv;
  bestaetigtCbRef.current = optionen.onBestaetigt;
  wertCbRef.current = optionen.onWert;
  standCbRef.current = optionen.onStand;

  const [wert, setWertState] = useState(optionen.wert);
  const [zustand, setZustand] = useState<TextZustand>("bestaetigt");
  const [entwurf, setEntwurf] = useState<string | null>(null);

  const initialisieren = useCallback(
    (stand: TextStand | null | undefined, text: string) => {
      const doc = dokumentAusStand(stand, text);
      docRef.current = doc;
      const inhalt = textAusDokument(doc);
      svRef.current = zustandsVektor(doc);
      updateRef.current = stand?.state
        ? bytesAusBase64(stand.state)
        : Y.encodeStateAsUpdate(doc);
      epochRef.current = stand?.epoch ?? 0;
      setWertState(inhalt);
      setZustand("bestaetigt");
      setEntwurf(null);
      standCbRef.current?.(inhalt);
    },
    [],
  );

  useEffect(() => {
    initialisieren(optionen.stand, optionen.wert);
    // Nur ein neuer Serverstand startet den Zustand neu. Lokale Werte
    // dürfen den laufenden Text nicht zurücksetzen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialisieren, optionen.stand?.epoch, optionen.stand?.state]);

  const sendeJetzt = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const doc = docRef.current;
    if (!doc) {
      return;
    }
    const update = deltaUpdate(doc, svRef.current ?? zustandsVektor(doc));
    if (update.length <= 2) {
      setZustand("bestaetigt");
      return;
    }
    if (!aktivRef.current) {
      setZustand("pausiert");
      return;
    }
    setZustand("offen");
    void sendenRef
      .current(base64AusBytes(update), epochRef.current)
      .then((antwort) => {
        const aktuell = docRef.current;
        if (!aktuell) {
          return;
        }
        wendeUpdateAn(aktuell, antwort.update);
        svRef.current = zustandsVektor(aktuell);
        updateRef.current = bytesAusBase64(antwort.update);
        epochRef.current = antwort.epoch;
        const text = textAusDokument(aktuell);
        setWertState(text);
        setEntwurf(null);
        const offen = deltaUpdate(aktuell, svRef.current);
        setZustand(offen.length > 2 ? "offen" : "bestaetigt");
        bestaetigtCbRef.current?.(text, antwort.epoch);
        wertCbRef.current?.(text);
      })
      .catch((fehler: unknown) => {
        if (istApiFehler(fehler) && fehler.code === "conflict") {
          const aktuell = docRef.current;
          if (aktuell) {
            setEntwurf(textAusDokument(aktuell));
          }
          const bestaetigt = new Y.Doc();
          if (updateRef.current) {
            Y.applyUpdate(bestaetigt, updateRef.current);
          }
          docRef.current = bestaetigt;
          svRef.current = zustandsVektor(bestaetigt);
          setWertState(textAusDokument(bestaetigt));
          setZustand("abgelehnt");
          wertCbRef.current?.(textAusDokument(bestaetigt));
          return;
        }
        setZustand(aktivRef.current ? "offen" : "pausiert");
      });
  }, []);

  const setWert = useCallback(
    (neu: string) => {
      const doc = docRef.current;
      if (!doc) {
        setWertState(neu);
        return;
      }
      setzeText(doc, neu);
      setWertState(textAusDokument(doc));
      setZustand(aktivRef.current ? "offen" : "pausiert");
      wertCbRef.current?.(textAusDokument(doc));
      if (!aktivRef.current) {
        return;
      }
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        sendeJetzt();
      }, 250);
    },
    [sendeJetzt],
  );

  const uebernehmen = useCallback(() => {
    if (entwurf === null) {
      return;
    }
    setWert(entwurf);
  }, [entwurf, setWert]);

  const wendeRemoteAn = useCallback((update: string) => {
    const doc = docRef.current;
    if (!doc) {
      return;
    }
    try {
      wendeUpdateAn(doc, update);
    } catch {
      return;
    }
    svRef.current = zustandsVektor(doc);
    updateRef.current = bytesAusBase64(update);
    const text = textAusDokument(doc);
    setWertState(text);
    setZustand("bestaetigt");
    wertCbRef.current?.(text);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    },
    [],
  );

  return { wert, zustand, entwurf, setWert, sendeJetzt, uebernehmen, wendeRemoteAn };
}
