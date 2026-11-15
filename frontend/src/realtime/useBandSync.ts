import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/client";
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
  aktiv = true,
): BandSyncZustand {
  const [zustand, setZustand] = useState<Verbindungszustand>("verbinden");
  const clientRef = useRef<BandSync | null>(null);
  const ereignisRef = useRef(beiEreignis);
  const abgleichRef = useRef(beiAbgleich);
  ereignisRef.current = beiEreignis;
  abgleichRef.current = beiAbgleich;

  useEffect(() => {
    if (bandId === null || !aktiv) {
      setZustand("verbinden");
      return;
    }
    const client = new BandSync({
      bandId,
      ladeAbgleich: async (id) => {
        const antwort = await apiFetch<AbgleichAntwort>(
          `/api/bands/${encodeURIComponent(id)}/sync/`,
        );
        return { counters: antwort.counters };
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
