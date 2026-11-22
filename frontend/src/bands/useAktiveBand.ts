import { useEffect, useState } from "react";
import type { AppRoute } from "../routing";
import type { Band } from "./bands";

export function useAktiveBand(
  bands: Band[] | null,
  route: AppRoute,
  bandId: string | null,
  setBandId: (id: string | null) => void,
  navigiere: (pfad: string) => void,
) {
  const [direktFehler, setDirektFehler] = useState<string | null>(null);

  useEffect(() => {
    if (bands === null) {
      return;
    }
    if (route.bandFehler) {
      setBandId(null);
      setDirektFehler(route.bandFehler);
      return;
    }
    if (route.bandId === null) {
      setDirektFehler(null);
      if (bandId === null || !bands.some((band) => band.id === bandId)) {
        setBandId(bands[0]?.id ?? null);
      }
      return;
    }
    if (bands.some((band) => band.id === route.bandId)) {
      setBandId(route.bandId);
      setDirektFehler(null);
      return;
    }
    setBandId(null);
    setDirektFehler("Diese Band ist für dich nicht sichtbar.");
  }, [bandId, bands, route.bandFehler, route.bandId, setBandId]);

  function bandWechseln(wert: string) {
    if (route.bandId !== null || route.bandFehler) {
      navigiere(route.bereich === "document" ? "/songs" : "/setlists");
    }
    setBandId(wert);
  }

  return { direktFehler, bandWechseln };
}
