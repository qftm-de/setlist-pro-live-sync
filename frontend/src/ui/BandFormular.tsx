import { useState } from "react";
import { behandleFehler } from "../api/client";
import { BandListenAbgleichFehler } from "../app/useAppStart";

interface BandFormularProps {
  onAnlegen: (name: string) => Promise<void>;
  onSitzungAbgelaufen?: () => void;
}

interface AngelegteBand {
  name: string;
  wiederholen: () => Promise<void>;
}

export function BandFormular({ onAnlegen, onSitzungAbgelaufen }: BandFormularProps) {
  const [name, setName] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [angelegt, setAngelegt] = useState<AngelegteBand | null>(null);

  async function absenden(ereignis: React.FormEvent) {
    ereignis.preventDefault();
    const sauber = name.trim();
    if (!sauber) {
      setFehler("Bitte einen Bandnamen eintragen.");
      return;
    }
    setLaeuft(true);
    setFehler(null);
    try {
      await onAnlegen(sauber);
      setName("");
      setAngelegt(null);
    } catch (ursache) {
      if (ursache instanceof BandListenAbgleichFehler) {
        setName("");
        setAngelegt({ name: ursache.bandName, wiederholen: ursache.wiederholen });
        setFehler(behandleFehler(ursache.ursache, onSitzungAbgelaufen));
      } else {
        setFehler(behandleFehler(ursache, onSitzungAbgelaufen));
      }
    } finally {
      setLaeuft(false);
    }
  }

  async function listeErneutLaden() {
    if (!angelegt) {
      return;
    }
    setLaeuft(true);
    setFehler(null);
    try {
      await angelegt.wiederholen();
      setAngelegt(null);
    } catch (ursache) {
      if (ursache instanceof BandListenAbgleichFehler) {
        setAngelegt({ name: ursache.bandName, wiederholen: ursache.wiederholen });
        setFehler(behandleFehler(ursache.ursache, onSitzungAbgelaufen));
      } else {
        setFehler(behandleFehler(ursache, onSitzungAbgelaufen));
      }
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <section className="bandformular" aria-labelledby="bandformular-titel">
      <h2 id="bandformular-titel">Band anlegen</h2>
      {angelegt ? (
        <div className="hinweis">
          <p role="status">
            Band „{angelegt.name}“ wurde angelegt. Die Bandliste konnte noch
            nicht geladen werden.
          </p>
          {fehler ? <p role="alert">{fehler}</p> : null}
          <div className="aktionsgruppe">
            <button
              type="button"
              disabled={laeuft}
              onClick={() => void listeErneutLaden()}
            >
              {laeuft ? "Lädt …" : "Bandliste erneut laden"}
            </button>
            <button
              type="button"
              disabled={laeuft}
              onClick={() => {
                setAngelegt(null);
                setFehler(null);
              }}
            >
              Weitere Band anlegen
            </button>
          </div>
        </div>
      ) : (
        <>
          <form onSubmit={absenden}>
            <label>
              Bandname
              <input
                name="bandname"
                value={name}
                required
                maxLength={120}
                disabled={laeuft}
                onChange={(ereignis) => setName(ereignis.target.value)}
              />
            </label>
            <button type="submit" disabled={laeuft}>
              {laeuft ? "Legt an …" : "Anlegen"}
            </button>
          </form>
          {fehler ? <p role="alert">{fehler}</p> : null}
        </>
      )}
    </section>
  );
}
