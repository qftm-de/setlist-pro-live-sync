import { useCallback, useState } from "react";
import type { Ereignis } from "../realtime/typen";
import type { TextEreignis } from "./texte";

export const TEXT_EREIGNISSE_GRENZE = 128;

export interface TextEreignisseSteuerung {
  textEreignisse: Record<string, TextEreignis>;
  verlust: number;
  textEreignisSpeichern: (ereignis: Ereignis) => void;
  leeren: () => void;
}

interface TextEreignisStand {
  map: Record<string, TextEreignis>;
  verlust: number;
}

export function useTextEreignisse(): TextEreignisseSteuerung {
  const [stand, setStand] = useState<TextEreignisStand>({ map: {}, verlust: 0 });

  const leeren = useCallback(() => {
    setStand((vorher) =>
      Object.keys(vorher.map).length === 0 ? vorher : { ...vorher, map: {} },
    );
  }, []);

  const textEreignisSpeichern = useCallback((ereignis: Ereignis) => {
    if (ereignis.event !== "text.updated") {
      return;
    }
    const objectUuid = String(ereignis.data.object_uuid ?? "");
    const field = String(ereignis.data.field ?? "");
    const schluessel = `${objectUuid}:${field}`;
    const eintrag: TextEreignis = {
      object_uuid: objectUuid,
      field,
      update: String(ereignis.data.update ?? ""),
      epoch: Number(ereignis.data.epoch ?? 0),
      revision: Number(ereignis.data.revision ?? 0),
    };
    setStand((vorher) => {
      const neu: Record<string, TextEreignis> = { ...vorher.map };
      // Ein erneutes Setzen hängt den Schlüssel hinten an und hält damit die
      // Reihenfolge für den ältesten Eintrag aktuell. Objekte behalten für
      // Zeichenketten-Schlüssel die Einfügereihenfolge.
      delete neu[schluessel];
      neu[schluessel] = eintrag;
      const schluesselListe = Object.keys(neu);
      let verworfen = 0;
      while (schluesselListe.length > TEXT_EREIGNISSE_GRENZE) {
        const alt = schluesselListe[0];
        if (!alt) {
          break;
        }
        delete neu[alt];
        schluesselListe.shift();
        verworfen += 1;
      }
      return { map: neu, verlust: vorher.verlust + verworfen };
    });
  }, []);

  return {
    textEreignisse: stand.map,
    verlust: stand.verlust,
    textEreignisSpeichern,
    leeren,
  };
}
