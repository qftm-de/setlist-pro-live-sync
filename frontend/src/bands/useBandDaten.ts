import { useEffect, useRef, useState } from "react";
import { fehlerText, istApiFehler, type ApiFehlerCode } from "../api/client";
import type { BandAdapter, BandDaten } from "./bands";

export type BandDatenZustand =
  | { bandId: string; status: "laedt" }
  | { bandId: string; status: "fehler"; fehler: string; code: ApiFehlerCode }
  | { bandId: string; status: "fertig"; daten: BandDaten };

export function useBandDaten(
  adapter: BandAdapter,
  bandId: string | null,
  version = 0,
): BandDatenZustand | { bandId: null; status: "leer" } {
  const [zustand, setZustand] = useState<BandDatenZustand | { bandId: null; status: "leer" }>(
    bandId ? { bandId, status: "laedt" } : { bandId: null, status: "leer" },
  );
  const lauf = useRef(0);

  useEffect(() => {
    const token = ++lauf.current;
    if (!bandId) {
      setZustand({ bandId: null, status: "leer" });
      return;
    }
    // Gleiche Band: alte Daten stehen lassen, damit die Ansicht beim
    // Nachladen nicht unmountet und Formulareingaben erhalten bleiben.
    setZustand((vorher) =>
      vorher.status === "fertig" && vorher.bandId === bandId
        ? vorher
        : { bandId, status: "laedt" },
    );
    adapter
      .ladeBandDaten(bandId)
      .then((daten) => {
        if (token === lauf.current) {
          setZustand({ bandId, status: "fertig", daten });
        }
      })
      .catch((fehler: unknown) => {
        if (token !== lauf.current) {
          return;
        }
        // Ein vorübergehender Fehlschlag beim Nachladen behält den alten Stand,
        // damit die Ansicht montiert bleibt. Ein entzogener Zugriff räumt sie.
        const code = istApiFehler(fehler) ? fehler.code : "invalid_response";
        const voruebergehend =
          code === "network" || code === "server" || code === "invalid_response";
        setZustand((vorher) =>
          vorher.status === "fertig" && vorher.bandId === bandId && voruebergehend
            ? vorher
            : {
                bandId,
                status: "fehler",
                fehler: fehlerText(fehler),
                code,
              },
        );
      });
    return () => {
      lauf.current += 1;
    };
  }, [adapter, bandId, version]);

  if (bandId === null) {
    return { bandId: null, status: "leer" };
  }
  if (zustand.bandId !== bandId) {
    return { bandId, status: "laedt" };
  }
  return zustand;
}
