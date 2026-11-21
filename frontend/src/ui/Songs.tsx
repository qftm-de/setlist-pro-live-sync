import { useState } from "react";
import { behandleFehler } from "../api/client";
import type { BandAdapter, Song } from "../bands/bands";
import { SongZeile } from "./SongZeile";
import { StatusAnzeige, type SpeicherZustand } from "./StatusAnzeige";

interface SongsProps {
  bandId: string;
  adapter: BandAdapter;
  songs: Song[];
  onGeaendert?: () => void;
  onNavigieren?: (pfad: string) => void;
  onSitzungAbgelaufen?: () => void;
}

export function Songs({
  bandId,
  adapter,
  songs,
  onGeaendert,
  onNavigieren,
  onSitzungAbgelaufen,
}: SongsProps) {
  const [suche, setSuche] = useState("");
  const [titel, setTitel] = useState("");
  const [interpret, setInterpret] = useState("");
  const [tonart, setTonart] = useState("");
  const [bpm, setBpm] = useState("");
  const [notiz, setNotiz] = useState("");
  const [zustand, setZustand] = useState<SpeicherZustand>("entwurf");
  const [fehler, setFehler] = useState<string | null>(null);
  const [offeneSongs, setOffeneSongs] = useState<Record<number, Song>>({});

  async function anlegen(ereignis: React.FormEvent) {
    ereignis.preventDefault();
    const sauber = titel.trim();
    if (!sauber) {
      setFehler("Bitte einen Titel eintragen.");
      return;
    }
    const zahl = bpm.trim() ? Number(bpm) : null;
    if (zahl !== null && (!Number.isInteger(zahl) || zahl < 20 || zahl > 400)) {
      setFehler("BPM muss eine ganze Zahl zwischen 20 und 400 sein.");
      return;
    }
    setZustand("speichert");
    setFehler(null);
    try {
      await adapter.erstelleSong(bandId, {
        title: sauber,
        artist: interpret.trim(),
        key: tonart.trim(),
        bpm: zahl,
        notes: notiz.trim(),
      });
      onGeaendert?.();
      setTitel("");
      setInterpret("");
      setTonart("");
      setBpm("");
      setNotiz("");
      setZustand("gespeichert");
    } catch (ursache) {
      setFehler(behandleFehler(ursache, onSitzungAbgelaufen));
      setZustand("fehler");
    }
  }

  async function loeschen(song: Song) {
    setZustand("speichert");
    setFehler(null);
    try {
      await adapter.loescheSong(bandId, song.id);
      onGeaendert?.();
      setZustand("entwurf");
    } catch (ursache) {
      setFehler(behandleFehler(ursache, onSitzungAbgelaufen));
      setZustand("fehler");
    }
  }

  const vermisste = Object.values(offeneSongs).filter(
    (song) => !songs.some((eintrag) => eintrag.id === song.id),
  );
  const anzeige = [...songs, ...vermisste];

  function merkeBearbeitung(song: Song, offen: boolean) {
    setOffeneSongs((vorher) => {
      if (offen) {
        return { ...vorher, [song.id]: song };
      }
      const rest = { ...vorher };
      delete rest[song.id];
      return rest;
    });
  }

  return (
    <section className="songs" aria-labelledby="songs-titel">
      <h2 id="songs-titel">Songs</h2>
      <label className="song-suche">Songs suchen<input type="search" placeholder="Titel oder Interpret" value={suche} onChange={e => setSuche(e.target.value)} /></label>
      {anzeige.length === 0 ? (
        <p>Keine Songs in dieser Band.</p>
      ) : (
        <ul className="songliste">
          {anzeige.filter(song => offeneSongs[song.id] || `${song.title} ${song.artist}`.toLocaleLowerCase("de").includes(suche.toLocaleLowerCase("de"))).map((song) => (
            <SongZeile
              key={song.id}
              bandId={bandId}
              song={song}
              adapter={adapter}
              gesperrt={zustand === "speichert"}
              onAendern={() => onGeaendert?.()}
              onLoeschen={loeschen}
              onOeffnen={onNavigieren}
              geloescht={
                offeneSongs[song.id] !== undefined &&
                !songs.some((eintrag) => eintrag.id === song.id)
              }
              onBearbeitung={merkeBearbeitung}
              onSitzungAbgelaufen={onSitzungAbgelaufen}
            />
          ))}
        </ul>
      )}
      <details className="anlegen-menue"><summary>Song hinzufügen</summary>
      <form className="songformular" onSubmit={anlegen}>
        <label>
          Titel
          <input
            name="titel"
            value={titel}
            required
            maxLength={200}
            onChange={(ereignis) => setTitel(ereignis.target.value)}
          />
        </label>
        <label>
          Interpret
          <input
            name="interpret"
            value={interpret}
            maxLength={200}
            onChange={(ereignis) => setInterpret(ereignis.target.value)}
          />
        </label>
        <label>
          Tonart
          <input
            name="tonart"
            value={tonart}
            maxLength={20}
            onChange={(ereignis) => setTonart(ereignis.target.value)}
          />
        </label>
        <label>
          BPM
          <input
            name="bpm"
            type="number"
            min={20}
            max={400}
            value={bpm}
            onChange={(ereignis) => setBpm(ereignis.target.value)}
          />
        </label>
        <label>
          Notiz
          <textarea
            name="notiz"
            value={notiz}
            onChange={(ereignis) => setNotiz(ereignis.target.value)}
          />
        </label>
        <button type="submit" disabled={zustand === "speichert"}>
          {zustand === "speichert" ? "Speichert …" : "Song hinzufügen"}
        </button>
      </form>
      </details>
      <StatusAnzeige zustand={zustand} />
      {fehler ? <p role="alert">{fehler}</p> : null}
    </section>
  );
}
