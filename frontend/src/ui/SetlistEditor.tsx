import { CrdtTextFeld } from "../collaboration/CrdtTextFeld";
import { textSchluessel, type TextEreignis } from "../collaboration/texte";
import { verschiebe } from "../setlists/inhalt";
import type { Setlist, SetlistAdapter } from "../setlists/setlists";
import { useSetlistBearbeitung } from "../setlists/useSetlistBearbeitung";
import type { Song } from "../bands/bands";
import { SetlistBlock } from "./SetlistBlock";
import { StatusAnzeige } from "./StatusAnzeige";

interface SetlistEditorProps {
  bandId: string;
  setlist: Setlist;
  songs: Song[];
  adapter: SetlistAdapter;
  geloescht?: boolean;
  verbunden?: boolean;
  textEreignisse?: Record<string, TextEreignis>;
  onSitzungAbgelaufen?: () => void;
  onGespeichert?: (setlist: Setlist) => void;
}

export function SetlistEditor({
  bandId,
  setlist,
  songs,
  adapter,
  geloescht = false,
  verbunden = true,
  textEreignisse = {},
  onSitzungAbgelaufen,
  onGespeichert,
}: SetlistEditorProps) {
  const bearbeitung = useSetlistBearbeitung({
    bandId,
    setlist,
    songs,
    adapter,
    verbunden,
    textEreignisse,
    onSitzungAbgelaufen,
    onGespeichert,
  });
  const {
    bloecke,
    name,
    setName,
    zustand,
    fehler,
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
  } = bearbeitung;

  const sendeSetlistName = setlist.uuid
    ? sendeFuer("setlist", setlist.uuid, "name")
    : undefined;

  return (
    <section className="setlist-editor" aria-labelledby="setlist-titel">
      <h2 id="setlist-titel">{name}</h2>
      {geloescht ? (
        <p role="alert">
          Diese Setlist wurde inzwischen gelöscht. Dein Entwurf bleibt erhalten.
        </p>
      ) : null}
      {!verbunden ? (
        <p className="songmeta" role="status">
          Ohne Verbindung ist die gemeinsame Bearbeitung pausiert. Der Entwurf
          bleibt in diesem Tab.
        </p>
      ) : null}
      <div className="setlist-name">
        <CrdtTextFeld
          label="Setlist-Name"
          wert={name}
          stand={
            setlist.uuid
              ? texte[textSchluessel("setlist", setlist.uuid, "name")] ?? null
              : null
          }
          aktiv={verbunden && !geloescht}
          senden={sendeSetlistName}
          onWert={setName}
          onStand={setName}
          onKonflikt={ladeTexte}
          remote={setlist.uuid ? remoteFuer(setlist.uuid, "name") : null}
          maxLength={120}
          disabled={geloescht}
        />
      </div>
      <fieldset className="setlist-feld" disabled={zustand === "speichert"}>
        {bloecke.length === 0 ? (
          <p>Noch keine Abschnitte. Beginne mit einem Set.</p>
        ) : null}
        {bloecke.map((block, blockIndex) => (
          <SetlistBlock
            key={block.schluessel}
            bandId={bandId}
            block={block}
            blockIndex={blockIndex}
            anzahlBloecke={bloecke.length}
            songs={songs}
            songWahl={songWahl}
            notiz={notizen[block.schluessel] ?? ""}
            texte={texte}
            verbunden={verbunden}
            senden={sendeFuer}
            remote={remoteFuer}
            onKonflikt={ladeTexte}
            onBlockAendern={(aenderung) =>
              blockAendern(block.schluessel, aenderung)
            }
            onBlockStand={(neuerName) => blockStand(block.schluessel, neuerName)}
            onZeileStand={(index, label) => zeileStand(block, index, label)}
            onZeileAendern={(index, aenderung) =>
              zeileAendern(block, index, aenderung)
            }
            onZeileVerschieben={(index, delta) =>
              zeileVerschieben(block, index, delta)
            }
            onZeileEntfernen={(index) => zeileEntfernen(block, index)}
            onSongWahl={setSongWahl}
            onSongHinzufuegen={() => songHinzufuegen(block)}
            onNotizWert={(wert) =>
              setNotizen((vorher) => ({ ...vorher, [block.schluessel]: wert }))
            }
            onNotizHinzufuegen={() => notizHinzufuegen(block)}
            onBlockVerschieben={(delta) =>
              aendern(verschiebe(bloecke, blockIndex, blockIndex + delta))
            }
            onBlockEntfernen={() =>
              aendern(bloecke.filter((eintrag) => eintrag !== block))
            }
          />
        ))}

        <div className="setlist-werkzeuge">
          <button type="button" onClick={() => blockHinzufuegen("set")}>
            Set hinzufügen
          </button>
          <button type="button" onClick={() => blockHinzufuegen("pause")}>
            Pause hinzufügen
          </button>
          <button type="button" onClick={() => blockHinzufuegen("zugabe")}>
            Zugabe hinzufügen
          </button>
        </div>
      </fieldset>
      <div className="setlist-werkzeuge">
        <button
          type="button"
          className="setlist-speichern"
          onClick={speichern}
          disabled={zustand === "speichert" || geloescht || !verbunden}
        >
          {zustand === "speichert" ? "Speichert …" : "Setlist speichern"}
        </button>
        {konflikt ? (
          <button type="button" onClick={zusammenfuehren}>
            Mit Serverstand zusammenführen
          </button>
        ) : null}
      </div>
      <StatusAnzeige zustand={zustand} />
      {fehler ? <p role="alert">{fehler}</p> : null}
    </section>
  );
}
