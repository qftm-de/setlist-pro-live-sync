import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { istApiFehler } from "../api/client";
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
  onKonflikt?: () => void;
}

export interface CrdtTextHandle {
  wert: string;
  zustand: TextZustand;
  entwurf: string | null;
  setWert: (wert: string) => void;
  sendeJetzt: () => void;
  uebernehmen: () => void;
  wendeRemoteAn: (update: string, epoch?: number) => void;
}

function docAusUpdate(update: Uint8Array): Y.Doc {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, update);
  return doc;
}

/** Ein leerer Delta kann trotzdem Bytes enthalten; der Zustandsvektor zählt. */
function hatOffeneOps(doc: Y.Doc, sv: Uint8Array | null): boolean {
  if (!sv) {
    return false;
  }
  const aktuell = zustandsVektor(doc);
  if (aktuell.length !== sv.length) {
    return true;
  }
  for (let index = 0; index < aktuell.length; index += 1) {
    if (aktuell[index] !== sv[index]) {
      return true;
    }
  }
  return false;
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
  const [entwurf, setEntwurf] = useState<string | null>(null);
  const entwurfRef = useRef<string | null>(null);

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

  const setzeBestaetigt = useCallback((update: Uint8Array) => {
    updateRef.current = update;
    svRef.current = zustandsVektor(docAusUpdate(update));
  }, []);

  const initialisieren = useCallback(
    (stand: TextStand | null | undefined, text: string) => {
      const neuerEpoch = stand?.epoch ?? 0;
      const doc = docRef.current;
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
        const offen = hatOffeneOps(doc, svRef.current);
        setZustand(
          offen
            ? "offen"
            : entwurfRef.current
              ? "abgelehnt"
              : "bestaetigt",
        );
        standCbRef.current?.(inhalt);
        return;
      }

      // Neuer Stand oder neue Epoche.
      if (doc) {
        const offen = hatOffeneOps(doc, svRef.current);
        const neuerEntwurf =
          offen ? textAusDokument(doc) : entwurfRef.current;
        setzeEntwurf(neuerEntwurf);
        setZustand(neuerEntwurf ? "abgelehnt" : "bestaetigt");
      }
      const neu = dokumentAusStand(stand, text);
      docRef.current = neu;
      const inhalt = textAusDokument(neu);
      epochRef.current = neuerEpoch;
      setzeBestaetigt(
        stand?.state ? bytesAusBase64(stand.state) : Y.encodeStateAsUpdate(neu),
      );
      setWertState(inhalt);
      standCbRef.current?.(inhalt);
    },
    [setzeBestaetigt],
  );

  useEffect(() => {
    initialisieren(optionen.stand, optionen.wert);
    // Nur ein neuer Serverstand startet den Zustand neu. Lokale Werte
    // dürfen den laufenden Text nicht zurücksetzen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialisieren, optionen.stand?.epoch, optionen.stand?.state]);

  const sendeJetzt = useCallback(() => {
    timerLoeschen();
    const doc = docRef.current;
    if (!doc || sendetRef.current) {
      return;
    }
    if (!hatOffeneOps(doc, svRef.current)) {
      setZustand("bestaetigt");
      return;
    }
    const update = deltaUpdate(doc, svRef.current ?? zustandsVektor(doc));
    if (!aktivRef.current) {
      setZustand("pausiert");
      return;
    }
    sendetRef.current = true;
    setZustand("offen");
    void sendenRef
      .current(base64AusBytes(update), epochRef.current)
      .then((antwort) => {
        const aktuell = docRef.current;
        if (!aktuell) {
          return;
        }
        wendeUpdateAn(aktuell, antwort.update);
        setzeBestaetigt(bytesAusBase64(antwort.update));
        epochRef.current = antwort.epoch;
        const text = textAusDokument(aktuell);
        setWertState(text);
        setzeEntwurf(null);
        sendetRef.current = false;
        const offen = hatOffeneOps(aktuell, svRef.current);
        if (offen) {
          setZustand("offen");
          if (aktivRef.current) {
            timerRef.current = window.setTimeout(() => {
              timerRef.current = null;
              sendeJetztRef.current();
            }, 0);
          }
        } else {
          setZustand("bestaetigt");
        }
        bestaetigtCbRef.current?.(antwort.text, antwort.epoch);
        wertCbRef.current?.(text);
      })
      .catch((fehler: unknown) => {
        sendetRef.current = false;
        if (istApiFehler(fehler) && fehler.code === "conflict") {
          const aktuell = docRef.current;
          if (aktuell) {
            setzeEntwurf(textAusDokument(aktuell));
          }
          // Die neue Epoche kommt gleich mit dem neu geladenen Stand.
          // Hier nicht vorwegnehmen, sonst mischt der Reload beide Stände.
          const bestaetigt = docAusUpdate(
            updateRef.current ?? new Uint8Array(),
          );
          docRef.current = bestaetigt;
          svRef.current = zustandsVektor(bestaetigt);
          const text = textAusDokument(bestaetigt);
          setWertState(text);
          setZustand("abgelehnt");
          wertCbRef.current?.(text);
          konfliktCbRef.current?.();
          return;
        }
        setZustand(aktivRef.current ? "offen" : "pausiert");
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
      setWertState(textAusDokument(doc));
      setZustand(aktivRef.current ? "offen" : "pausiert");
      wertCbRef.current?.(textAusDokument(doc));
      if (!aktivRef.current || sendetRef.current) {
        return;
      }
      timerLoeschen();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        sendeJetztRef.current();
      }, 250);
    },
    [timerLoeschen],
  );

  const uebernehmen = useCallback(() => {
    if (entwurf === null) {
      return;
    }
    setWert(entwurf);
  }, [entwurf, setWert]);

  const wendeRemoteAn = useCallback(
    (update: string, epoch?: number) => {
      const doc = docRef.current;
      if (!doc) {
        return;
      }
      if (typeof epoch === "number" && epoch < epochRef.current) {
        // Veraltetes Ereignis einer alten Epoche.
        return;
      }
      if (typeof epoch === "number" && epoch > epochRef.current) {
        // REST-Ersatz: neuer, unabhängiger Zustand. Nicht mit dem alten
        // Epoche-Dokument mischen, den Entwurf getrennt behalten.
        const offen = hatOffeneOps(doc, svRef.current);
        const entwurfText =
          offen ? textAusDokument(doc) : entwurfRef.current;
        setzeEntwurf(entwurfText);
        const neu = docAusUpdate(bytesAusBase64(update));
        docRef.current = neu;
        epochRef.current = epoch;
        setzeBestaetigt(bytesAusBase64(update));
        setWertState(textAusDokument(neu));
        setZustand(entwurfText ? "abgelehnt" : "bestaetigt");
        wertCbRef.current?.(textAusDokument(neu));
        return;
      }
      try {
        wendeUpdateAn(doc, update);
      } catch {
        return;
      }
      setzeBestaetigt(bytesAusBase64(update));
      const text = textAusDokument(doc);
      setWertState(text);
      const offen = hatOffeneOps(doc, svRef.current);
      setZustand(
        offen
          ? "offen"
          : entwurfRef.current
            ? "abgelehnt"
            : "bestaetigt",
      );
      wertCbRef.current?.(text);
      if (offen && aktivRef.current && !sendetRef.current) {
        timerLoeschen();
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          sendeJetztRef.current();
        }, 0);
      }
    },
    [setzeBestaetigt, setzeEntwurf, timerLoeschen],
  );

  useEffect(
    () => () => {
      timerLoeschen();
    },
    [timerLoeschen],
  );

  return { wert, zustand, entwurf, setWert, sendeJetzt, uebernehmen, wendeRemoteAn };
}
