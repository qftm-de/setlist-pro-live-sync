import { useState } from "react";
import { behandleFehler } from "../api/client";
import type { BandAdapter, Song } from "../bands/bands";

interface SongZeileProps {
  bandId: string;
  song: Song;
  adapter: BandAdapter;
  gesperrt?: boolean;
  onAendern: (song: Song) => void;
  onLoeschen: (song: Song) => void;
  onOeffnen?: (pfad: string) => void;
  geloescht?: boolean;
  onBearbeitung?: (song: Song | null) => void;
  onSitzungAbgelaufen?: () => void;
}

function alsBpm(wert: string): number | null {
  return wert.trim() ? Number(wert) : null;
}

export function SongZeile({
  bandId,
  song,
  adapter,
  gesperrt = false,
  onAendern,
  onLoeschen,
  onOeffnen,
  geloescht = false,
  onBearbeitung,
  onSitzungAbgelaufen,
}: SongZeileProps) {
  const [bearbeiten, setBearbeiten] = useState(false);
  const [titel, setTitel] = useState(song.title);
  const [interpret, setInterpret] = useState(song.artist ?? "");
  const [tonart, setTonart] = useState(song.key ?? "");
  const [bpm, setBpm] = useState(song.bpm ? String(song.bpm) : "");
  const [notiz, setNotiz] = useState(song.notes ?? "");
  const [fehler, setFehler] = useState<string | null>(null);

  function bearbeitenOeffnen() {
    setTitel(song.title);
    setInterpret(song.artist ?? "");
    setTonart(song.key ?? "");
    setBpm(song.bpm ? String(song.bpm) : "");
    setNotiz(song.notes ?? "");
    setFehler(null);
    setBearbeiten(true);
    onBearbeitung?.(song);
  }

  async function speichern(ereignis: React.FormEvent) {
    ereignis.preventDefault();
    const sauber = titel.trim();
    if (!sauber) {
      setFehler("Bitte einen Titel eintragen.");
      return;
    }
    const zahl = alsBpm(bpm);
    if (zahl !== null && (!Number.isInteger(zahl) || zahl < 20 || zahl > 400)) {
      setFehler("BPM muss eine ganze Zahl zwischen 20 und 400 sein.");
      return;
    }
    setFehler(null);
    try {
      const geaendert = await adapter.aendereSong(bandId, song.id, {
        title: sauber,
        artist: interpret.trim(),
        key: tonart.trim(),
        bpm: zahl,
        notes: notiz.trim(),
      });
      onAendern({ ...song, ...geaendert });
      setBearbeiten(false);
      onBearbeitung?.(null);
    } catch (ursache) {
      setFehler(behandleFehler(ursache, onSitzungAbgelaufen));
    }
  }

  function abbrechen() {
    setTitel(song.title);
    setInterpret(song.artist ?? "");
    setTonart(song.key ?? "");
    setBpm(song.bpm ? String(song.bpm) : "");
    setNotiz(song.notes ?? "");
    setFehler(null);
    setBearbeiten(false);
    onBearbeitung?.(null);
  }

  if (bearbeiten) {
    return (
      <li className="songzeile">
        <form className="songbearbeiten" onSubmit={speichern}>
          {geloescht ? (
            <p role="alert">
              Dieser Song wurde inzwischen gelöscht. Dein Entwurf bleibt erhalten.
            </p>
          ) : null}
          <label>
            Titel (ändern)
            <input
              name="aendern-titel"
              value={titel}
              required
              maxLength={200}
              onChange={(ereignis) => setTitel(ereignis.target.value)}
            />
          </label>
          <label>
            Interpret (ändern)
            <input
              name="aendern-interpret"
              value={interpret}
              maxLength={200}
              onChange={(ereignis) => setInterpret(ereignis.target.value)}
            />
          </label>
          <label>
            Tonart (ändern)
            <input
              name="aendern-tonart"
              value={tonart}
              maxLength={20}
              onChange={(ereignis) => setTonart(ereignis.target.value)}
            />
          </label>
          <label>
            BPM (ändern)
            <input
              name="aendern-bpm"
              type="number"
              min={20}
              max={400}
              value={bpm}
              onChange={(ereignis) => setBpm(ereignis.target.value)}
            />
          </label>
          <label>
            Notiz (ändern)
            <textarea
              name="aendern-notiz"
              value={notiz}
              onChange={(ereignis) => setNotiz(ereignis.target.value)}
            />
          </label>
          <button type="submit" disabled={geloescht}>
            Änderung speichern
          </button>
          <button type="button" onClick={abbrechen}>
            Abbrechen
          </button>
        </form>
        {fehler ? <p role="alert">{fehler}</p> : null}
      </li>
    );
  }

  return (
    <li className="songzeile">
      <span className="songtitel">{song.title}</span>
      {song.artist ? <span className="songmeta">{song.artist}</span> : null}
      {song.key ? <span className="songmeta">Tonart {song.key}</span> : null}
      {song.bpm ? <span className="songmeta">{song.bpm} BPM</span> : null}
      {song.notes ? <span className="songmeta">{song.notes}</span> : null}
      <a
        className="song-pdf"
        href={`/songs/${encodeURIComponent(bandId)}/${song.id}/pdf`}
        onClick={(ereignis) => {
          if (!onOeffnen) {
            return;
          }
          ereignis.preventDefault();
          onOeffnen(`/songs/${encodeURIComponent(bandId)}/${song.id}/pdf`);
        }}
      >
        {`${song.title} PDF öffnen`}
      </a>
      <button type="button" disabled={gesperrt} onClick={bearbeitenOeffnen}>
        {`${song.title} ändern`}
      </button>
      <button type="button" disabled={gesperrt} onClick={() => onLoeschen(song)}>
        {`${song.title} löschen`}
      </button>
      {fehler ? <p role="alert">{fehler}</p> : null}
    </li>
  );
}
