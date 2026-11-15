import { useState } from "react";
import { behandleFehler } from "../api/client";
import type { Song } from "../bands/bands";
import type { Setlist, SetlistAdapter } from "../setlists/setlists";
import {
  artName,
  bloeckeAusSetlist,
  eingabeAusBloecken,
  neuerSchluessel,
  verschiebe,
  type Block,
} from "../setlists/inhalt";
import { StatusAnzeige, type SpeicherZustand } from "./StatusAnzeige";

interface SetlistEditorProps {
  bandId: string;
  setlist: Setlist;
  songs: Song[];
  adapter: SetlistAdapter;
  geloescht?: boolean;
  onSitzungAbgelaufen?: () => void;
  onGespeichert?: (setlist: Setlist) => void;
}

export function SetlistEditor({
  bandId,
  setlist,
  songs,
  adapter,
  geloescht = false,
  onSitzungAbgelaufen,
  onGespeichert,
}: SetlistEditorProps) {
  const [bloecke, setBloecke] = useState<Block[]>(() => bloeckeAusSetlist(setlist));
  const [zustand, setZustand] = useState<SpeicherZustand>("gespeichert");
  const [fehler, setFehler] = useState<string | null>(null);
  const [songWahl, setSongWahl] = useState<string>(String(songs[0]?.id ?? ""));
  const [notizen, setNotizen] = useState<Record<string, string>>({});

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

  function zeileHinzufuegen(schluessel: string, zeile: Block["zeilen"][number]) {
    aendern(
      bloecke.map((block) =>
        block.schluessel === schluessel
          ? { ...block, zeilen: [...block.zeilen, zeile] }
          : block,
      ),
    );
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

  async function speichern() {
    setZustand("speichert");
    setFehler(null);
    try {
      const gespeichert = await adapter.speichereInhalt(
        bandId,
        setlist.id,
        eingabeAusBloecken(bloecke),
      );
      setBloecke(bloeckeAusSetlist(gespeichert));
      setZustand("gespeichert");
      onGespeichert?.(gespeichert);
    } catch (ursache) {
      setFehler(behandleFehler(ursache, onSitzungAbgelaufen));
      setZustand("fehler");
    }
  }

  return (
    <section className="setlist-editor" aria-labelledby="setlist-titel">
      <h2 id="setlist-titel">{setlist.name}</h2>
      {geloescht ? (
        <p role="alert">
          Diese Setlist wurde inzwischen gelöscht. Dein Entwurf bleibt erhalten.
        </p>
      ) : null}
      <fieldset className="setlist-feld" disabled={zustand === "speichert"}>
      {bloecke.length === 0 ? (
        <p>Noch keine Abschnitte. Beginne mit einem Set.</p>
      ) : null}
      {bloecke.map((block, blockIndex) => (
        <article className="setlist-block" key={block.schluessel}>
          <header>
            <label>
              {`Abschnitt ${blockIndex + 1}`}
              <input
                name={`abschnitt-${blockIndex}`}
                value={block.name}
                maxLength={120}
                onChange={(ereignis) =>
                  blockAendern(block.schluessel, { name: ereignis.target.value })
                }
              />
            </label>
            <span className="songmeta">{artName(block.kind)}</span>
            <button
              type="button"
              onClick={() =>
                aendern(verschiebe(bloecke, blockIndex, blockIndex - 1))
              }
              disabled={blockIndex === 0}
            >
              {`Abschnitt ${blockIndex + 1} nach oben`}
            </button>
            <button
              type="button"
              onClick={() =>
                aendern(verschiebe(bloecke, blockIndex, blockIndex + 1))
              }
              disabled={blockIndex === bloecke.length - 1}
            >
              {`Abschnitt ${blockIndex + 1} nach unten`}
            </button>
            <button
              type="button"
              onClick={() =>
                aendern(bloecke.filter((eintrag) => eintrag !== block))
              }
            >
              {`Abschnitt ${blockIndex + 1} entfernen`}
            </button>
          </header>

          {block.zeilen.length === 0 ? (
            <p className="songmeta">Noch keine Einträge.</p>
          ) : (
            <ol className="setlist-eintraege">
              {block.zeilen.map((zeile, zeilenIndex) => (
                <li key={zeile.schluessel}>
                  <span className="songtitel">{zeile.titel}</span>
                  <span className="songmeta">{zeile.art}</span>
                  {zeile.art === "song" && zeile.songId ? (
                    <a
                      href={`/songs/${encodeURIComponent(bandId)}/${zeile.songId}/pdf`}
                      target="_blank"
                      rel="noopener"
                    >
                      {`${zeile.titel} PDF in neuem Tab öffnen`}
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => zeileVerschieben(block, zeilenIndex, -1)}
                    disabled={zeilenIndex === 0}
                  >
                    {`${zeile.titel} an Position ${zeilenIndex + 1} nach oben`}
                  </button>
                  <button
                    type="button"
                    onClick={() => zeileVerschieben(block, zeilenIndex, 1)}
                    disabled={zeilenIndex === block.zeilen.length - 1}
                  >
                    {`${zeile.titel} an Position ${zeilenIndex + 1} nach unten`}
                  </button>
                  <button
                    type="button"
                    onClick={() => zeileEntfernen(block, zeilenIndex)}
                  >
                    {`${zeile.titel} an Position ${zeilenIndex + 1} entfernen`}
                  </button>
                </li>
              ))}
            </ol>
          )}

          <div className="setlist-hinzufuegen">
            <label>
              Song
              <select
                value={songWahl}
                onChange={(ereignis) => setSongWahl(ereignis.target.value)}
              >
                {songs.length === 0 ? <option value="">Keine Songs</option> : null}
                {songs.map((song) => (
                  <option key={song.id} value={song.id}>
                    {song.title}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => songHinzufuegen(block)}>
              {`Song in Abschnitt ${blockIndex + 1}`}
            </button>
            <label>
              {`Notiz für Abschnitt ${blockIndex + 1} (leer ergibt Pause)`}
              <input
                name={`notiz-${blockIndex}`}
                value={notizen[block.schluessel] ?? ""}
                maxLength={200}
                onChange={(ereignis) =>
                  setNotizen((vorher) => ({
                    ...vorher,
                    [block.schluessel]: ereignis.target.value,
                  }))
                }
              />
            </label>
            <button type="button" onClick={() => notizHinzufuegen(block)}>
              {`Eintrag in Abschnitt ${blockIndex + 1}`}
            </button>
          </div>
        </article>
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
          disabled={zustand === "speichert" || geloescht}
        >
          {zustand === "speichert" ? "Speichert …" : "Setlist speichern"}
        </button>
      </div>
      <StatusAnzeige zustand={zustand} />
      {fehler ? <p role="alert">{fehler}</p> : null}
    </section>
  );
}
