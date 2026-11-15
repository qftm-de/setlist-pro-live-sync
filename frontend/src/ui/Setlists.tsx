import { useEffect, useRef, useState } from "react";
import { behandleFehler, istApiFehler } from "../api/client";
import "../setlists/setlists.css";
import type { Song } from "../bands/bands";
import type { Setlist, SetlistAdapter, SetlistKurz } from "../setlists/setlists";
import { SetlistEditor } from "./SetlistEditor";
import { StatusAnzeige } from "./StatusAnzeige";

interface SetlistsProps {
  bandId: string;
  songs: Song[];
  adapter: SetlistAdapter;
  initialSetlistId?: number | null;
  onSitzungAbgelaufen?: () => void;
}

export function Setlists({
  bandId,
  songs,
  adapter,
  initialSetlistId = null,
  onSitzungAbgelaufen,
}: SetlistsProps) {
  const [liste, setListe] = useState<SetlistKurz[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  const [detail, setDetail] = useState<Setlist | null>(null);
  const initialRef = useRef(initialSetlistId);
  const listeGeladen = useRef(false);

  useEffect(() => {
    const vorher = initialRef.current;
    initialRef.current = initialSetlistId;
    if (
      vorher !== null &&
      initialSetlistId === null &&
      listeGeladen.current
    ) {
      // Reiterklick aus dem Direktlink: Auswahl und Entwurf behalten.
      return;
    }
    let aktiv = true;
    listeGeladen.current = false;
    setListe(null);
    setFehler(null);
    setGewaehlt(null);
    setDetail(null);
    adapter
      .ladeSetlists(bandId)
      .then((geladen) => {
        if (!aktiv) {
          return;
        }
        listeGeladen.current = true;
        setListe(geladen);
        if (initialSetlistId === null) {
          setGewaehlt(geladen[0]?.id ?? null);
        } else if (geladen.some((setlist) => setlist.id === initialSetlistId)) {
          setGewaehlt(initialSetlistId);
        } else {
          setGewaehlt(null);
          setFehler("Diese Setlist existiert nicht.");
        }
      })
      .catch((ursache: unknown) => {
        if (aktiv) {
          setFehler(behandleFehler(ursache, onSitzungAbgelaufen));
        }
      });
    return () => {
      aktiv = false;
    };
  }, [adapter, bandId, initialSetlistId, onSitzungAbgelaufen]);

  useEffect(() => {
    if (gewaehlt === null) {
      setDetail(null);
      return;
    }
    let aktiv = true;
    setDetail(null);
    adapter
      .ladeSetlist(bandId, gewaehlt)
      .then((geladen) => {
        if (aktiv) {
          setDetail(geladen);
        }
      })
      .catch((ursache: unknown) => {
        if (!aktiv) {
          return;
        }
        const text = behandleFehler(ursache, onSitzungAbgelaufen);
        if (text) {
          setFehler(
            istApiFehler(ursache) && ursache.code === "not_found"
              ? "Diese Setlist existiert nicht."
              : text,
          );
        }
      });
    return () => {
      aktiv = false;
    };
  }, [adapter, bandId, gewaehlt, onSitzungAbgelaufen]);

  async function anlegen(ereignis: React.FormEvent) {
    ereignis.preventDefault();
    const sauber = name.trim();
    if (!sauber) {
      setFehler("Bitte einen Namen eintragen.");
      return;
    }
    setFehler(null);
    setLaeuft(true);
    try {
      const neu = await adapter.erstelleSetlist(bandId, sauber);
      // Ohne geladene Liste würde die neue Setlist die Ansicht ersetzen.
      if (liste === null) return;
      setListe((vorher) => [...(vorher ?? []), { id: neu.id, name: neu.name }]);
      setGewaehlt(neu.id);
      setDetail(neu);
      setName("");
    } catch (ursache) {
      setFehler(behandleFehler(ursache, onSitzungAbgelaufen));
    } finally {
      setLaeuft(false);
    }
  }

  async function loeschen(setlist: SetlistKurz) {
    setFehler(null);
    setLaeuft(true);
    try {
      await adapter.loescheSetlist(bandId, setlist.id);
      const rest = (liste ?? []).filter((eintrag) => eintrag.id !== setlist.id);
      setListe(rest);
      if (gewaehlt === setlist.id) {
        setGewaehlt(rest[0]?.id ?? null);
      }
    } catch (ursache) {
      setFehler(behandleFehler(ursache, onSitzungAbgelaufen));
    } finally {
      setLaeuft(false);
    }
  }

  if (liste === null && fehler === null) {
    return <StatusAnzeige zustand="laedt" />;
  }

  return (
    <section className="setlists" aria-labelledby="setlists-titel">
      <h2 id="setlists-titel">Setlists</h2>
      {fehler ? <p role="alert">{fehler}</p> : null}
      {liste === null ? null : liste.length === 0 ? (
        <p>Noch keine Setlist. Lege die erste an.</p>
      ) : (
        <ul className="setlist-liste">
          {liste.map((setlist) => (
            <li key={setlist.id}>
              <button
                type="button"
                className="setlist-wahl"
                aria-pressed={gewaehlt === setlist.id}
                onClick={() => {
                  setFehler(null);
                  setGewaehlt(setlist.id);
                }}
              >
                {setlist.name}
              </button>
              <button
                type="button"
                disabled={laeuft}
                onClick={() => loeschen(setlist)}
              >
                {`${setlist.name} löschen`}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="setlist-formular" onSubmit={anlegen}>
        <label>
          Neue Setlist
          <input
            name="setlist-name"
            value={name}
            maxLength={120}
            onChange={(ereignis) => setName(ereignis.target.value)}
          />
        </label>
        <button type="submit" disabled={laeuft || liste === null}>
          {laeuft ? "Legt an …" : "Setlist anlegen"}
        </button>
      </form>

      {gewaehlt !== null && detail === null && fehler === null ? (
        <StatusAnzeige zustand="laedt" />
      ) : null}
      {detail ? (
        <SetlistEditor
          key={detail.id}
          bandId={bandId}
          setlist={detail}
          songs={songs}
          adapter={adapter}
          onSitzungAbgelaufen={onSitzungAbgelaufen}
        />
      ) : null}
    </section>
  );
}
