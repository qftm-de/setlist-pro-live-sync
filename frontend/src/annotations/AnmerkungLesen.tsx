import { fehlerText } from "../api/client";
import { useState } from "react";
import type { Anmerkung } from "./annotations";

interface AnmerkungLesenProps {
  anmerkung: Anmerkung;
  geloescht?: boolean;
  onLoeschen: () => Promise<void>;
  onSchliessen: () => void;
}

export function AnmerkungLesen({
  anmerkung,
  geloescht = false,
  onLoeschen,
  onSchliessen,
}: AnmerkungLesenProps) {
  const [bestaetigen,setBestaetigen] = useState(false);
  const [fehler,setFehler] = useState<string | null>(null);
  const [laeuft,setLaeuft] = useState(false);
  async function entfernen() {
    if (!bestaetigen) { setBestaetigen(true); return; }
    setLaeuft(true); setFehler(null);
    try { await onLoeschen(); } catch (e) { setFehler(fehlerText(e)); } finally { setLaeuft(false); }
  }
  return (
    <section className="anmerkung-formular" aria-label="Anmerkung lesen">
      <h4>Bandweite Anmerkung</h4>
      <p>{anmerkung.kind === "text" ? anmerkung.text : "Marker"}</p>
      <p className="songmeta">
        Nur der Autor kann diese Anmerkung ändern. Aktuelle Owner dürfen
        bandweite Anmerkungen löschen.
      </p>
      {geloescht ? (
        <p role="alert">
          Diese Anmerkung wurde inzwischen gelöscht. Dein Entwurf bleibt erhalten.
        </p>
      ) : null}
      {anmerkung.can_delete && !geloescht ? (
        <button type="button" disabled={laeuft} onClick={() => void entfernen()}>
          {bestaetigen ? "Löschen bestätigen" : "Anmerkung löschen"}
        </button>
      ) : null}
      {fehler ? <p role="alert">{fehler}</p> : null}
      <button type="button" disabled={laeuft} onClick={onSchliessen}>Schließen</button>
    </section>
  );
}
