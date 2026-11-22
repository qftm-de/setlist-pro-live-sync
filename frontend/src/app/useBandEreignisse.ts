import { useCallback, type Dispatch, type SetStateAction } from "react";
import { ladeMarke } from "../realtime/ereignisMarken";
import type { SyncDaten } from "../realtime/daten";
import type { Ereignis } from "../realtime/typen";

interface Args {
  bandsNeuLaden: () => Promise<{ angewendet: boolean }>;
  bandListenFehlerMelden: (fehler: unknown) => void;
  bandListenFehlerLoeschen: () => void;
  textEreignisSpeichern: (ereignis: Ereignis) => void;
  textEreignisseLeeren: () => void;
  setStageMarke: Dispatch<SetStateAction<number>>;
  setSyncStand: Dispatch<SetStateAction<SyncDaten | null>>;
  setDatenVersion: Dispatch<SetStateAction<number>>;
  setEreignisMarke: Dispatch<SetStateAction<number>>;
  setDokumentMarke: Dispatch<SetStateAction<number>>;
  setSetlistMarke: Dispatch<SetStateAction<number>>;
  setBandMarke: Dispatch<SetStateAction<number>>;
  setSyncMarke: Dispatch<SetStateAction<number>>;
}

export function useBandEreignisse({
  bandsNeuLaden,
  bandListenFehlerMelden,
  bandListenFehlerLoeschen,
  textEreignisSpeichern,
  textEreignisseLeeren,
  setStageMarke,
  setSyncStand,
  setDatenVersion,
  setEreignisMarke,
  setDokumentMarke,
  setSetlistMarke,
  setBandMarke,
  setSyncMarke,
}: Args) {
  const beiEchtzeitEreignis = useCallback(
    (ereignis: Ereignis) => {
      if (ereignis.event.startsWith("stage.")) {
        setStageMarke((wert) => wert + 1);
        return;
      }
      setSyncStand(null);
      if (ereignis.stream === "band") {
        setDatenVersion((wert) => wert + 1);
      }
      const marke = ladeMarke(ereignis.event);
      if (marke === "gig") {
        setEreignisMarke((wert) => wert + 1);
      }
      if (
        ereignis.event.startsWith("annotation.") ||
        ereignis.event.startsWith("document.")
      ) {
        setDokumentMarke((wert) => wert + 1);
      }
      if (ereignis.event.startsWith("setlist.")) {
        setSetlistMarke((wert) => wert + 1);
      }
      if (ereignis.event === "text.updated") {
        textEreignisSpeichern(ereignis);
      }
      if (marke === "band") {
        setBandMarke((wert) => wert + 1);
        void bandsNeuLaden()
          .then(({ angewendet }) => {
            if (angewendet) {
              bandListenFehlerLoeschen();
            }
          })
          .catch(bandListenFehlerMelden);
      }
    },
    [
      bandListenFehlerLoeschen,
      bandListenFehlerMelden,
      bandsNeuLaden,
      setBandMarke,
      setDatenVersion,
      setDokumentMarke,
      setEreignisMarke,
      setSetlistMarke,
      setStageMarke,
      setSyncStand,
      textEreignisSpeichern,
    ],
  );

  const beiAbgleich = useCallback(
    (daten: unknown) => {
      const stand = daten as SyncDaten | undefined;
      if (!stand || !stand.band) {
        return;
      }
      textEreignisseLeeren();
      setSyncStand(stand);
      setSyncMarke((wert) => wert + 1);
      if (stand.stage) {
        setStageMarke((wert) => wert + 1);
      }
      setEreignisMarke((wert) => wert + 1);
      setDokumentMarke((wert) => wert + 1);
      setSetlistMarke((wert) => wert + 1);
      setBandMarke((wert) => wert + 1);
      setDatenVersion((wert) => wert + 1);
      void bandsNeuLaden()
        .then(({ angewendet }) => {
          if (angewendet) {
            bandListenFehlerLoeschen();
          }
        })
        .catch(bandListenFehlerMelden);
    },
    [
      bandListenFehlerLoeschen,
      bandListenFehlerMelden,
      bandsNeuLaden,
      setBandMarke,
      setDatenVersion,
      setDokumentMarke,
      setEreignisMarke,
      setSetlistMarke,
      setStageMarke,
      setSyncMarke,
      setSyncStand,
      textEreignisseLeeren,
    ],
  );

  return { beiEchtzeitEreignis, beiAbgleich };
}
