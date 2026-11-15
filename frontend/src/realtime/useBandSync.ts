import { useCallback, useEffect, useRef, useState } from "react";
import { ApiFehler, apiFetch } from "../api/client";
import { BandSync } from "./realtime";
import type { Ereignis, Verbindungszustand } from "./typen";

export interface BandSyncZustand {
  zustand: Verbindungszustand;
  erneutVersuchen: () => void;
}

interface AbgleichAntwort {
  counters: { band: number; personal: number };
  [feld: string]: unknown;
}

export function useBandSync(
  bandId: string | null,
  beiEreignis: (ereignis: Ereignis) => void,
  beiAbgleich: (daten: unknown) => void,
  beiSitzungAbgelaufen: () => void,
  aktiv = true,
): BandSyncZustand {
  const [zustand, setZustand] = useState<Verbindungszustand>("verbinden");
  const clientRef = useRef<BandSync | null>(null);
  const ereignisRef = useRef(beiEreignis);
  const abgleichRef = useRef(beiAbgleich);
  const sitzungRef = useRef(beiSitzungAbgelaufen);
  ereignisRef.current = beiEreignis;
  abgleichRef.current = beiAbgleich;
  sitzungRef.current = beiSitzungAbgelaufen;

  const pruefeSitzung = useCallback(() => {
    void apiFetch("/api/session/").catch((fehler: unknown) => {
      if (fehler instanceof ApiFehler && fehler.code === "unauthenticated") {
        sitzungRef.current();
      }
    });
  }, []);

  useEffect(() => {
    if (bandId === null || !aktiv) {
      setZustand("verbinden");
      return;
    }
    const client = new BandSync({
      bandId,
      ladeAbgleich: async (id) => {
        try {
          const antwort = await apiFetch<AbgleichAntwort>(
            `/api/bands/${encodeURIComponent(id)}/sync/`,
          );
          return { counters: antwort.counters, daten: antwort };
        } catch (fehler) {
          if (fehler instanceof ApiFehler && fehler.code === "unauthenticated") {
            sitzungRef.current();
          }
          throw fehler;
        }
      },
      beiEreignis: (ereignis) => ereignisRef.current(ereignis),
      beiZustand: setZustand,
      beiAbgleich: (daten) => abgleichRef.current(daten),
      beiVerbindungsverlust: pruefeSitzung,
    });
    clientRef.current = client;
    client.start();
    return () => {
      client.stop();
      if (clientRef.current === client) {
        clientRef.current = null;
      }
    };
  }, [aktiv, bandId, pruefeSitzung]);

  const erneutVersuchen = useCallback(() => {
    clientRef.current?.erneutVersuchen();
  }, []);

  return { zustand, erneutVersuchen };
}
