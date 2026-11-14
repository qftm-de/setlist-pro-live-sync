import { useState } from "react";
import { behandleFehler } from "../api/client";

interface BandFormularProps {
  onAnlegen: (name: string) => Promise<void>;
  onSitzungAbgelaufen?: () => void;
}

export function BandFormular({ onAnlegen, onSitzungAbgelaufen }: BandFormularProps) {
  const [name, setName] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

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
    } catch (ursache) {
      setFehler(behandleFehler(ursache, onSitzungAbgelaufen));
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <section className="bandformular" aria-labelledby="bandformular-titel">
      <h2 id="bandformular-titel">Band anlegen</h2>
      <form onSubmit={absenden}>
        <label>
          Bandname
          <input
            name="bandname"
            value={name}
            required
            maxLength={120}
            onChange={(ereignis) => setName(ereignis.target.value)}
          />
        </label>
        <button type="submit" disabled={laeuft}>
          {laeuft ? "Legt an …" : "Anlegen"}
        </button>
      </form>
      {fehler ? <p role="alert">{fehler}</p> : null}
    </section>
  );
}
