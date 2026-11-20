import { useState } from "react";
import { fehlerText, istApiFehler } from "../api/client";
import type { BandDatenZustand } from "../bands/useBandDaten";
import { apiStage } from "../stage/stage";

export function useBuehnenEinstieg(
  bandDaten: BandDatenZustand | { bandId: null; status: "leer" },
  verbindungId: string | null,
  navigiere: (pfad: string) => void,
) {
  const [buehnenFehler, setBuehnenFehler] = useState<string | null>(null);

  async function buehneOeffnen(setlistId: number) {
    const bandIdJetzt = bandDaten.status === "fertig" ? bandDaten.daten.bandId : null;
    if (!bandIdJetzt || !verbindungId) {
      setBuehnenFehler("Die Verbindung ist noch nicht bereit. Bitte kurz warten.");
      return;
    }
    setBuehnenFehler(null);
    try {
      const sitzung = await apiStage.start(bandIdJetzt, setlistId, verbindungId);
      navigiere(`/stage/${encodeURIComponent(bandIdJetzt)}/${sitzung.id}`);
    } catch (ursache) {
      if (istApiFehler(ursache) && ursache.code === "conflict") {
        try {
          const aktiv = await apiStage.aktive(bandIdJetzt, verbindungId);
          if (aktiv) {
            navigiere(`/stage/${encodeURIComponent(bandIdJetzt)}/${aktiv.id}`);
            return;
          }
        } catch {
          // unten als sichtbarer Fehler
        }
      }
      setBuehnenFehler(fehlerText(ursache));
    }
  }

  return { buehnenFehler, buehneOeffnen };
}
