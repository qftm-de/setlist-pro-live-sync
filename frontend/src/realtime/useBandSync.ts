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
}

export function useBandSync(
  bandId: string | null,
  beiEreignis: (ereignis: Ereignis) => void,
  beiAbgleich: () => void,
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
            `/api/bands/${encodeURIComponent(id)}/sync/?nur_zaehler=1`,
          );
          return { counters: antwort.counters };
        } catch (fehler) {
          if (fehler instanceof ApiFehler && fehler.code === "unauthenticated") {
            sitzungRef.current();
          }
          throw fehler;
        }
      },
      beiEreignis: (ereignis) => ereignisRef.current(ereignis),
      beiZustand: setZustand,
      beiAbgleich: () => abgleichRef.current(),
    });
    clientRef.current = client;
    client.start();
    return () => {
      client.stop();
      if (clientRef.current === client) {
        clientRef.current = null;
      }
    };
  }, [aktiv, bandId]);

  const erneutVersuchen = useCallback(() => {
    clientRef.current?.erneutVersuchen();
  }, []);

  return { zustand, erneutVersuchen };
}
