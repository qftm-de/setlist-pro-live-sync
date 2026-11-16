import type { Song } from "../bands/bands";
import { artName, type Block, type Zeile } from "../setlists/inhalt";
import { CrdtTextFeld } from "../collaboration/CrdtTextFeld";
import { textSchluessel, type TextAntwort, type TextStand } from "../collaboration/texte";

export type SendeFuer = (
  typ: TextStand["object_type"],
  uuid: string,
  feld: TextStand["field"],
) => ((update: string, epoch: number) => Promise<TextAntwort>) | undefined;

export interface RemoteFuer {
  (
    uuid: string,
    feld: string,
  ): { update: string; epoch: number; revision?: number } | null;
}

interface SetlistBlockProps {
  bandId: string;
  block: Block;
  blockIndex: number;
  anzahlBloecke: number;
  songs: Song[];
  songWahl: string;
  notiz: string;
  texte: Record<string, TextStand>;
  verbunden: boolean;
  senden: SendeFuer;
  remote: RemoteFuer;
  onKonflikt?: () => void;
  onBlockAendern: (aenderung: Partial<Block>) => void;
  onBlockStand: (name: string) => void;
  onZeileStand: (index: number, label: string) => void;
  onZeileAendern: (index: number, aenderung: Partial<Zeile>) => void;
  onZeileVerschieben: (index: number, delta: number) => void;
  onZeileEntfernen: (index: number) => void;
  onSongWahl: (wert: string) => void;
  onSongHinzufuegen: () => void;
  onNotizWert: (wert: string) => void;
  onNotizHinzufuegen: () => void;
  onBlockVerschieben: (delta: number) => void;
  onBlockEntfernen: () => void;
}

export function SetlistBlock({
  bandId,
  block,
  blockIndex,
  anzahlBloecke,
  songs,
  songWahl,
  notiz,
  texte,
  verbunden,
  senden,
  remote,
  onKonflikt,
  onBlockAendern,
  onBlockStand,
  onZeileStand,
  onZeileAendern,
  onZeileVerschieben,
  onZeileEntfernen,
  onSongWahl,
  onSongHinzufuegen,
  onNotizWert,
  onNotizHinzufuegen,
  onBlockVerschieben,
  onBlockEntfernen,
}: SetlistBlockProps) {
  return (
    <article className="setlist-block">
      <header>
        <CrdtTextFeld
          label={`Abschnitt ${blockIndex + 1}`}
          name={`abschnitt-${blockIndex}`}
          wert={block.name}
          stand={
            block.uuid
              ? texte[textSchluessel("section", block.uuid, "name")] ?? null
              : null
          }
          aktiv={verbunden}
          senden={block.uuid ? senden("section", block.uuid, "name") : undefined}
          onWert={(wert) => onBlockAendern({ name: wert })}
          onStand={onBlockStand}
          onKonflikt={onKonflikt}
          remote={block.uuid ? remote(block.uuid, "name") : null}
          maxLength={120}
        />
        <span className="songmeta">{artName(block.kind)}</span>
        <button
          type="button"
          onClick={() => onBlockVerschieben(-1)}
          disabled={blockIndex === 0}
        >
          {`Abschnitt ${blockIndex + 1} nach oben`}
        </button>
        <button
          type="button"
          onClick={() => onBlockVerschieben(1)}
          disabled={blockIndex === anzahlBloecke - 1}
        >
          {`Abschnitt ${blockIndex + 1} nach unten`}
        </button>
        <button type="button" onClick={onBlockEntfernen}>
          {`Abschnitt ${blockIndex + 1} entfernen`}
        </button>
      </header>

      {block.zeilen.length === 0 ? (
        <p className="songmeta">Noch keine Einträge.</p>
      ) : (
        <ol className="setlist-eintraege">
          {block.zeilen.map((zeile, zeilenIndex) => (
            <li key={zeile.schluessel}>
              {zeile.art === "song" ? (
                <span className="songtitel">{zeile.titel}</span>
              ) : (
                <CrdtTextFeld
                  label={`Bezeichnung ${zeile.titel}`}
                  wert={zeile.titel}
                  stand={
                    zeile.uuid
                      ? texte[textSchluessel("entry", zeile.uuid, "label")] ?? null
                      : null
                  }
                  aktiv={verbunden}
                  senden={zeile.uuid ? senden("entry", zeile.uuid, "label") : undefined}
                  onWert={(wert) => onZeileAendern(zeilenIndex, { titel: wert })}
                  onStand={(wert) => onZeileStand(zeilenIndex, wert)}
                  onKonflikt={onKonflikt}
                  remote={zeile.uuid ? remote(zeile.uuid, "label") : null}
                  maxLength={200}
                />
              )}
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
                onClick={() => onZeileVerschieben(zeilenIndex, -1)}
                disabled={zeilenIndex === 0}
              >
                {`${zeile.titel} an Position ${zeilenIndex + 1} nach oben`}
              </button>
              <button
                type="button"
                onClick={() => onZeileVerschieben(zeilenIndex, 1)}
                disabled={zeilenIndex === block.zeilen.length - 1}
              >
                {`${zeile.titel} an Position ${zeilenIndex + 1} nach unten`}
              </button>
              <button type="button" onClick={() => onZeileEntfernen(zeilenIndex)}>
                {`${zeile.titel} an Position ${zeilenIndex + 1} entfernen`}
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className="setlist-hinzufuegen">
        <label>
          Song
          <select value={songWahl} onChange={(ereignis) => onSongWahl(ereignis.target.value)}>
            {songs.length === 0 ? <option value="">Keine Songs</option> : null}
            {songs.map((song) => (
              <option key={song.id} value={song.id}>
                {song.title}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={onSongHinzufuegen}>
          {`Song in Abschnitt ${blockIndex + 1}`}
        </button>
        <label>
          {`Notiz für Abschnitt ${blockIndex + 1} (leer ergibt Pause)`}
          <input
            name={`notiz-${blockIndex}`}
            value={notiz}
            maxLength={200}
            onChange={(ereignis) => onNotizWert(ereignis.target.value)}
          />
        </label>
        <button type="button" onClick={onNotizHinzufuegen}>
          {`Eintrag in Abschnitt ${blockIndex + 1}`}
        </button>
      </div>
    </article>
  );
}
