import { useCallback, useEffect, useRef, useState } from "react";
import { fehlerText, istApiFehler, type ApiFehlerCode } from "../api/client";
import type { GigAdapter, GigGruppen } from "./gigs";

export type GigsZustand =
  | { status: "laedt" }
  | { status: "fehler"; fehler: string; code: ApiFehlerCode }
  | { status: "fertig"; gruppen: GigGruppen };

export interface GigsLaden {
  zustand: GigsZustand;
  abgleichFehler: string | null;
  ladeNeu: () => Promise<boolean>;
}

export function useGigs(
  adapter: GigAdapter,
  bandId: string,
  onSitzungAbgelaufen?: () => void,
): GigsLaden {
  const [zustand, setZustand] = useState<GigsZustand>({ status: "laedt" });
  const [abgleichFehler, setAbgleichFehler] = useState<string | null>(null);
  const lauf = useRef(0);

  const laden = useCallback(async () => {
    const token = ++lauf.current;
    try {
      const gruppen = await adapter.ladeGigs(bandId);
      if (token !== lauf.current) {
        return false;
      }
      setZustand({ status: "fertig", gruppen });
      setAbgleichFehler(null);
      return true;
    } catch (fehler: unknown) {
      if (token !== lauf.current) {
        return false;
      }
      if (
        istApiFehler(fehler) &&
        fehler.code === "unauthenticated" &&
        onSitzungAbgelaufen
      ) {
        onSitzungAbgelaufen();
        return false;
      }
      const text = fehlerText(fehler);
      setZustand((vorher) =>
        vorher.status === "fertig"
          ? vorher
          : {
              status: "fehler",
              fehler: text,
              code: istApiFehler(fehler) ? fehler.code : "invalid_response",
            },
      );
      setAbgleichFehler(text);
      return false;
    }
  }, [adapter, bandId, onSitzungAbgelaufen]);

  useEffect(() => {
    setZustand({ status: "laedt" });
    setAbgleichFehler(null);
    void laden();
    return () => {
      lauf.current += 1;
    };
  }, [laden]);

  return { zustand, abgleichFehler, ladeNeu: laden };
}
