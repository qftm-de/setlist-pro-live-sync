import { useCallback, useEffect, useRef, useState } from "react";
import { behandleFehler, istApiFehler } from "../api/client";
import type { Song } from "../bands/bands";
import {
  artName,
  bloeckeAusSetlist,
  eingabeAusBloecken,
  neuerSchluessel,
  verschiebe,
  type Block,
  type Zeile,
} from "../setlists/inhalt";
import {
  bloeckeZusammenfuehren,
  mergeBasis,
  type MergeBasis,
} from "../setlists/zusammenfuehren";
import type { Setlist, SetlistAdapter } from "../setlists/setlists";
import {
  dokumentAusStand,
  textAusDokument,
  textSchluessel,
  type TextAntwort,
  type TextEreignis,
  type TextStand,
} from "../collaboration/texte";
import type { SpeicherZustand } from "../ui/StatusAnzeige";

interface Optionen {
  bandId: string;
  setlist: Setlist;
  songs: Song[];
  adapter: SetlistAdapter;
  verbunden: boolean;
  syncMarke?: number;
  textEreignisse: Record<string, TextEreignis>;
  onSitzungAbgelaufen?: () => void;
  onGespeichert?: (setlist: Setlist) => void;
}

const TEXTSPERRE = "Textstände fehlen. Bitte erneut laden.";

function textAusStand(stand: TextStand | undefined): string | null {
  if (!stand?.state) {
    return null;
  }
  try {
    return textAusDokument(dokumentAusStand(stand));
  } catch {
    return null;
  }
}

export function useSetlistBearbeitung({
  bandId,
  setlist,
  songs,
  adapter,
  verbunden,
  syncMarke = 0,
  textEreignisse,
  onSitzungAbgelaufen,
  onGespeichert,
}: Optionen) {
  const [bloecke, setBloecke] = useState<Block[]>(() => bloeckeAusSetlist(setlist));
  const [name, setName] = useState(setlist.name);
  const [revision, setRevision] = useState(setlist.revision ?? 0);
  const [zustand, setZustand] = useState<SpeicherZustand>("gespeichert");
  const [fehler, setFehler] = useState<string | null>(null);
  const [textFehler, setTextFehler] = useState<string | null>(null);
  const zustandRef = useRef<SpeicherZustand>("gespeichert");
  const [konflikt, setKonflikt] = useState(false);
  const [texte, setTexte] = useState<Record<string, TextStand>>({});
  const texteRef = useRef<Record<string, TextStand>>({});
  texteRef.current = texte;
  const ladeSequenzRef = useRef(0);
  const [songWahl, setSongWahl] = useState<string>(String(songs[0]?.id ?? ""));
  const [notizen, setNotizen] = useState<Record<string, string>>({});

  const basisRef = useRef<MergeBasis>(mergeBasis(bloeckeAusSetlist(setlist)));
  zustandRef.current = zustand;
  const setIdRef = useRef(setlist.id);
  useEffect(() => {
    if (setIdRef.current !== setlist.id) {
      setIdRef.current = setlist.id;
      const frisch = bloeckeAusSetlist(setlist);
      basisRef.current = mergeBasis(frisch);
      setBloecke(frisch);
      setName(setlist.name);
      setRevision(setlist.revision ?? 0);
      setZustand("gespeichert");
      setFehler(null);
      setKonflikt(false);
      return;
    }
    if (zustand === "gespeichert") {
      setRevision(setlist.revision ?? 0);
      setName(setlist.name);
      basisRef.current = mergeBasis(bloeckeAusSetlist(setlist));
    }
    // Ein später eintreffendes Detail darf einen Entwurf nicht ersetzen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setlist.id, setlist.revision, setlist.name]);

  const ladeTexte = useCallback(async () => {
    if (!adapter.ladeTexte) {
      return;
    }
    const sequenz = ladeSequenzRef.current + 1;
    ladeSequenzRef.current = sequenz;
    try {
      const antwort = await adapter.ladeTexte(bandId, setlist.id);
      if (sequenz !== ladeSequenzRef.current) {
        // Ein älterer Ladevorgang darf einen neueren Stand nicht ersetzen.
        return;
      }
      const karte: Record<string, TextStand> = {};
      for (const stand of antwort.texts) {
        karte[textSchluessel(stand.object_type, stand.object_uuid, stand.field)] = stand;
      }
      const alt = texteRef.current;
      setBloecke((vorher) =>
        vorher.map((block) => {
          const nameSchluessel = block.uuid
            ? textSchluessel("section", block.uuid, "name")
            : "";
          const neuerName = nameSchluessel ? textAusStand(karte[nameSchluessel]) : null;
          const alterName = nameSchluessel ? textAusStand(alt[nameSchluessel]) : null;
          const name =
            neuerName !== null && (alterName === null || block.name === alterName)
              ? neuerName
              : block.name;
          return {
            ...block,
            name,
            zeilen: block.zeilen.map((zeile) => {
              // Songs tragen ihren Titel selbst; der Label-Stand ist dort leer.
              const labelSchluessel =
                zeile.art !== "song" && zeile.uuid
                  ? textSchluessel("entry", zeile.uuid, "label")
                  : "";
              const neuesLabel = labelSchluessel
                ? textAusStand(karte[labelSchluessel])
                : null;
              const altesLabel = labelSchluessel
                ? textAusStand(alt[labelSchluessel])
                : null;
              const titel =
                neuesLabel !== null &&
                (altesLabel === null || zeile.titel === altesLabel)
                  ? neuesLabel
                  : zeile.titel;
              return { ...zeile, titel };
            }),
          };
        }),
      );
      setTexte(karte);
      setTextFehler(null);
      setFehler((vorher) => (vorher === TEXTSPERRE ? null : vorher));
    } catch {
      if (sequenz !== ladeSequenzRef.current) {
        return;
      }
      // Ohne Textzustand bleiben die Felder lokal bearbeitbar, aber sichtbar.
      setTextFehler("Textstände konnten nicht geladen werden.");
    }
  }, [adapter, bandId, setlist.id]);

  useEffect(() => {
    void ladeTexte();
  }, [ladeTexte]);

  const ladeAlles = useCallback(async () => {
    if (zustandRef.current !== "gespeichert") {
      // Ein lokaler Entwurf bleibt erhalten; die Revision wird nicht
      // angehoben, damit der nächste PUT nicht still überschreibt.
      await ladeTexte();
      return;
    }
    try {
      const server = await adapter.ladeSetlist(bandId, setlist.id);
      const frisch = bloeckeAusSetlist(server);
      basisRef.current = mergeBasis(frisch);
      setBloecke(frisch);
      setRevision(server.revision ?? 0);
      setName(server.name);
      await ladeTexte();
    } catch {
      setTextFehler("Setlist konnte nicht neu geladen werden.");
    }
  }, [adapter, bandId, ladeTexte, setlist.id]);

  const warVerbundenRef = useRef(verbunden);
  useEffect(() => {
    if (!warVerbundenRef.current && verbunden) {
      // Nach einer Lücke den vollständigen Stand nachladen, bevor ein PUT
      // veraltete Strukturen oder Namen zurückschreibt.
      void ladeAlles();
    }
    warVerbundenRef.current = verbunden;
  }, [ladeAlles, verbunden]);

  useEffect(() => {
    if (syncMarke > 0) {
      // Ein vollständiger Abgleich kann gepufferte Ereignisse überholen.
      void ladeAlles();
    }
  }, [ladeAlles, syncMarke]);

  function aendern(neu: Block[]) {
    setBloecke(neu);
    setZustand("entwurf");
  }

  function blockHinzufuegen(kind: Block["kind"]) {
    aendern([
      ...bloecke,
      { schluessel: neuerSchluessel(), name: artName(kind), kind, zeilen: [] },
    ]);
  }

  function blockAendern(schluessel: string, aenderung: Partial<Block>) {
    aendern(
      bloecke.map((block) =>
        block.schluessel === schluessel ? { ...block, ...aenderung } : block,
      ),
    );
  }

  function blockStand(schluessel: string, neuerName: string) {
    setBloecke((vorher) =>
      vorher.map((block) =>
        block.schluessel === schluessel ? { ...block, name: neuerName } : block,
      ),
    );
  }

  function zeileStand(block: Block, index: number, label: string) {
    setBloecke((vorher) =>
      vorher.map((eintrag) =>
        eintrag.schluessel === block.schluessel
          ? {
              ...eintrag,
              zeilen: eintrag.zeilen.map((zeile, position) =>
                position === index ? { ...zeile, titel: label } : zeile,
              ),
            }
          : eintrag,
      ),
    );
  }

  function zeileHinzufuegen(schluessel: string, zeile: Zeile) {
    aendern(
      bloecke.map((block) =>
        block.schluessel === schluessel
          ? { ...block, zeilen: [...block.zeilen, zeile] }
          : block,
      ),
    );
  }

  function zeileAendern(block: Block, index: number, aenderung: Partial<Zeile>) {
    blockAendern(block.schluessel, {
      zeilen: block.zeilen.map((zeile, position) =>
        position === index ? { ...zeile, ...aenderung } : zeile,
      ),
    });
  }

  function songHinzufuegen(block: Block) {
    const song = songs.find((eintrag) => String(eintrag.id) === songWahl);
    if (!song) {
      setFehler("Bitte einen Song wählen.");
      return;
    }
    setFehler(null);
    zeileHinzufuegen(block.schluessel, {
      schluessel: neuerSchluessel(),
      art: "song",
      songId: song.id,
      titel: song.title,
    });
  }

  function notizHinzufuegen(block: Block) {
    const text = (notizen[block.schluessel] ?? "").trim();
    zeileHinzufuegen(block.schluessel, {
      schluessel: neuerSchluessel(),
      art: text ? "notiz" : "pause",
      titel: text || "Pause",
    });
    setNotizen((vorher) => ({ ...vorher, [block.schluessel]: "" }));
  }

  function zeileVerschieben(block: Block, index: number, delta: number) {
    blockAendern(block.schluessel, {
      zeilen: verschiebe(block.zeilen, index, index + delta),
    });
  }

  function zeileEntfernen(block: Block, index: number) {
    blockAendern(block.schluessel, {
      zeilen: block.zeilen.filter((_, position) => position !== index),
    });
  }

  function sendeFuer(
    typ: TextStand["object_type"],
    uuid: string,
    feld: TextStand["field"],
  ): ((update: string, epoch: number) => Promise<TextAntwort>) | undefined {
    if (!adapter.sendeText) {
      return undefined;
    }
    return (update, epoch) =>
      adapter.sendeText!(bandId, setlist.id, {
        object_type: typ,
        object_uuid: uuid,
        field: feld,
        epoch,
        update,
      });
  }

  function remoteFuer(uuid: string, feld: string) {
    const ereignis = textEreignisse[`${uuid}:${feld}`];
    if (!ereignis) {
      return null;
    }
    return {
      update: ereignis.update,
      epoch: ereignis.epoch,
      revision: ereignis.revision,
    };
  }

  async function speichern() {
    if (!verbunden) {
      setFehler("Ohne Verbindung ist die Bearbeitung pausiert. Der Entwurf bleibt erhalten.");
      return;
    }
    if (textFehler) {
      setFehler(TEXTSPERRE);
      return;
    }
    setZustand("speichert");
    setFehler(null);
    try {
      const gespeichert = await adapter.speichereInhalt(
        bandId,
        setlist.id,
        eingabeAusBloecken(bloecke),
        revision,
      );
      const frisch = bloeckeAusSetlist(gespeichert);
      basisRef.current = mergeBasis(frisch);
      setBloecke(frisch);
      setRevision(gespeichert.revision ?? revision + 1);
      setZustand("gespeichert");
      setKonflikt(false);
      void ladeTexte();
      onGespeichert?.(gespeichert);
    } catch (ursache) {
      if (istApiFehler(ursache) && ursache.code === "conflict") {
        setKonflikt(true);
        setFehler(
          "Der Stand wurde inzwischen geändert. Entwurf und Serverstand lassen sich zusammenführen.",
        );
      } else {
        setFehler(behandleFehler(ursache, onSitzungAbgelaufen));
      }
      setZustand("fehler");
    }
  }

  async function zusammenfuehren() {
    setFehler(null);
    try {
      const server = await adapter.ladeSetlist(bandId, setlist.id);
      const serverBloecke = bloeckeAusSetlist(server);
      setBloecke(
        bloeckeZusammenfuehren(serverBloecke, bloecke, basisRef.current),
      );
      basisRef.current = mergeBasis(serverBloecke);
      setRevision(server.revision ?? 0);
      setKonflikt(false);
      setZustand("entwurf");
      void ladeTexte();
      setFehler("Zusammengeführt. Bitte erneut speichern.");
    } catch (ursache) {
      setFehler(behandleFehler(ursache, onSitzungAbgelaufen));
    }
  }

  return {
    bloecke,
    name,
    setName,
    zustand,
    fehler,
    textFehler,
    konflikt,
    texte,
    songWahl,
    setSongWahl,
    notizen,
    setNotizen,
    aendern,
    blockHinzufuegen,
    blockAendern,
    blockStand,
    zeileStand,
    zeileAendern,
    songHinzufuegen,
    notizHinzufuegen,
    zeileVerschieben,
    zeileEntfernen,
    sendeFuer,
    remoteFuer,
    speichern,
    zusammenfuehren,
    ladeTexte,
    ladeAlles,
  };
}
