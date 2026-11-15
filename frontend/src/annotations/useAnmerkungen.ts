import { useEffect, useState } from "react";
import { behandleFehler, fehlerText } from "../api/client";
import type {
  Anmerkung,
  AnmerkungAenderung,
  AnmerkungAdapter,
  AnmerkungEingabe,
} from "./annotations";

export function useAnmerkungen(
  adapter: AnmerkungAdapter,
  bandId: string,
  songId: number,
  versionId: number | null,
  onSitzungAbgelaufen?: () => void,
) {
  const [liste, setListe] = useState<Anmerkung[]>([]);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [neuLaden, setNeuLaden] = useState(0);

  useEffect(() => {
    if (versionId === null) {
      setListe([]);
      setLaedt(false);
      setFehler(null);
      return;
    }
    let aktiv = true;
    setLaedt(true);
    setFehler(null);
    adapter
      .lade(bandId, songId, versionId)
      .then((geladen) => {
        if (aktiv) {
          setListe(geladen);
          setLaedt(false);
        }
      })
      .catch((ursache: unknown) => {
        if (!aktiv) {
          return;
        }
        setLaedt(false);
        setFehler(behandleFehler(ursache, onSitzungAbgelaufen) ?? fehlerText(ursache));
      });
    return () => {
      aktiv = false;
    };
  }, [adapter, bandId, songId, versionId, neuLaden, onSitzungAbgelaufen]);

  async function erstelle(eingabe: AnmerkungEingabe): Promise<Anmerkung> {
    if (versionId === null) {
      throw new Error("Keine Version ausgewählt.");
    }
    const neu = await adapter.erstelle(bandId, songId, versionId, eingabe);
    setListe((vorher) => (vorher.some((eintrag) => eintrag.id === neu.id) ? vorher : [...vorher, neu]));
    return neu;
  }

  async function aendere(
    id: number,
    revision: number,
    aenderung: AnmerkungAenderung,
  ): Promise<Anmerkung> {
    if (versionId === null) {
      throw new Error("Keine Version ausgewählt.");
    }
    const neu = await adapter.aendere(bandId, songId, versionId, id, revision, aenderung);
    setListe((vorher) =>
      vorher.map((eintrag) => (eintrag.id === neu.id ? neu : eintrag)),
    );
    return neu;
  }

  async function loesche(id: number, revision: number): Promise<void> {
    if (versionId === null) {
      return;
    }
    await adapter.loesche(bandId, songId, versionId, id, revision);
    setListe((vorher) => vorher.filter((eintrag) => eintrag.id !== id));
  }

  return {
    liste,
    laedt,
    fehler,
    erstelle,
    aendere,
    loesche,
    neuLaden: () => setNeuLaden((wert) => wert + 1),
    setListe,
  };
}
