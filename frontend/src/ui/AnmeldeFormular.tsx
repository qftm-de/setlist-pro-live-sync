import { useState } from "react";
import { fehlerText } from "../api/client";

interface AnmeldeFormularProps {
  onAnmelden: (benutzer: string, passwort: string) => Promise<void>;
}

export function AnmeldeFormular({ onAnmelden }: AnmeldeFormularProps) {
  const [benutzer, setBenutzer] = useState("");
  const [passwort, setPasswort] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function absenden(ereignis: React.FormEvent) {
    ereignis.preventDefault();
    setLaeuft(true);
    setFehler(null);
    try {
      await onAnmelden(benutzer.trim(), passwort);
    } catch (ursache) {
      setFehler(fehlerText(ursache));
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <section className="anmeldung" aria-labelledby="anmeldung-titel">
      <img className="anmeldung-motiv" src="/bandmotiv.jpg" alt="Band mit Gesang, Gitarre und Schlagzeug" />
      <h1 id="anmeldung-titel">Anmeldung erforderlich</h1>
      <p>Konten vergibt der Betreiber dieser Instanz.</p>
      <form onSubmit={absenden}>
        <label>
          Benutzername
          <input
            name="username"
            autoComplete="username"
            value={benutzer}
            required
            onChange={(ereignis) => setBenutzer(ereignis.target.value)}
          />
        </label>
        <label>
          Passwort
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            value={passwort}
            required
            onChange={(ereignis) => setPasswort(ereignis.target.value)}
          />
        </label>
        <button type="submit" disabled={laeuft}>
          {laeuft ? "Meldet an …" : "Anmelden"}
        </button>
      </form>
      {fehler ? <p role="alert">{fehler}</p> : null}
    </section>
  );
}
