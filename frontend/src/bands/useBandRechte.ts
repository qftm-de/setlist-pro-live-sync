import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { behandleFehler } from "../api/client";
import type { SyncDaten } from "../realtime/daten";
import type { Band } from "./bands";

interface Args {
  bands: Band[] | null;
  aktuelleBandId: string | null;
  setBandId: Dispatch<SetStateAction<string | null>>;
  bandsNeuLaden: (
    zielBandId?: string | null,
  ) => Promise<{ liste: Band[]; angewendet: boolean }>;
  sitzungAbgelaufen: () => void;
  textEreignisseLeeren: () => void;
  setSyncStand: Dispatch<SetStateAction<SyncDaten | null>>;
  setDatenVersion: Dispatch<SetStateAction<number>>;
}

export function useBandRechte({
  bands,
  aktuelleBandId,
  setBandId,
  bandsNeuLaden,
  sitzungAbgelaufen,
  textEreignisseLeeren,
  setSyncStand,
  setDatenVersion,
}: Args) {
  const [bandListenFehler, setBandListenFehler] = useState<string | null>(null);
  const [gesperrteBandIds, setGesperrteBandIds] = useState<Set<string>>(() => new Set());
  const aktuelleBandIdRef = useRef(aktuelleBandId);
  aktuelleBandIdRef.current = aktuelleBandId;

  const sichtbareBands =
    bands && gesperrteBandIds.size > 0
      ? bands.filter((band) => !gesperrteBandIds.has(band.id))
      : bands;

  const bandSperren = useCallback((id: string) => {
    setGesperrteBandIds((vorher) =>
      vorher.has(id) ? vorher : new Set(vorher).add(id),
    );
  }, []);

  const bandEntsperren = useCallback((id: string) => {
    setGesperrteBandIds((vorher) => {
      if (!vorher.has(id)) {
        return vorher;
      }
      const neu = new Set(vorher);
      neu.delete(id);
      return neu;
    });
  }, []);

  const alleBandsEntsperren = useCallback(() => {
    setGesperrteBandIds(new Set());
  }, []);

  const bandListenFehlerMelden = useCallback(
    (fehler: unknown) => {
      setBandListenFehler(behandleFehler(fehler, sitzungAbgelaufen));
    },
    [sitzungAbgelaufen],
  );

  const beiRechtVerlust = useCallback(
    (entzogeneBandId: string) => {
      if (aktuelleBandIdRef.current !== entzogeneBandId) {
        return;
      }
      // Bestätigter Rechteentzug oder unklare Zugriffsprüfung: Ansicht sofort
      // räumen und Band ausblenden, bis die Serverliste den Zugriff klärt.
      bandSperren(entzogeneBandId);
      setBandId(null);
      setSyncStand(null);
      setDatenVersion((wert) => wert + 1);
      textEreignisseLeeren();
      setBandListenFehler(null);
      void bandsNeuLaden()
        .then(({ liste, angewendet }) => {
          if (!angewendet) {
            return;
          }
          setBandListenFehler(null);
          bandEntsperren(entzogeneBandId);
          if (liste.some((band) => band.id === entzogeneBandId)) {
            setBandId((aktuell) =>
              aktuell === null ? entzogeneBandId : aktuell,
            );
          }
        })
        .catch(bandListenFehlerMelden);
    },
    [
      bandEntsperren,
      bandListenFehlerMelden,
      bandSperren,
      bandsNeuLaden,
      setBandId,
      setDatenVersion,
      setSyncStand,
      textEreignisseLeeren,
    ],
  );

  const bandVerlassen = useCallback(
    async (verlasseneBandId: string | null, nachher: () => void) => {
      if (verlasseneBandId) {
        bandSperren(verlasseneBandId);
      }
      const istNochAktiv =
        verlasseneBandId !== null && aktuelleBandIdRef.current === verlasseneBandId;
      if (istNochAktiv) {
        setBandId(null);
        setSyncStand(null);
        setDatenVersion((wert) => wert + 1);
        textEreignisseLeeren();
        setBandListenFehler(null);
        nachher();
      }
      try {
        const { angewendet } = await bandsNeuLaden(istNochAktiv ? null : undefined);
        if (angewendet && verlasseneBandId) {
          bandEntsperren(verlasseneBandId);
        }
      } catch (fehler: unknown) {
        bandListenFehlerMelden(fehler);
      }
    },
    [
      bandEntsperren,
      bandListenFehlerMelden,
      bandSperren,
      bandsNeuLaden,
      setBandId,
      setDatenVersion,
      setSyncStand,
      textEreignisseLeeren,
    ],
  );

  return {
    sichtbareBands,
    bandListenFehler,
    setBandListenFehler,
    bandEntsperren,
    alleBandsEntsperren,
    bandListenFehlerMelden,
    beiRechtVerlust,
    bandVerlassen,
  };
}
