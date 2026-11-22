import { behandleFehler, fehlerText } from "../api/client";
import { useEffect, useState } from "react";
import type { Anmerkung } from "./annotations";

interface AnmerkungLesenProps {
  anmerkung: Anmerkung;
  geloescht?: boolean;
  onLoeschen: () => Promise<void>;
  onSchliessen: () => void;
  onSitzungAbgelaufen?: () => void;
}

export function AnmerkungLesen({
  anmerkung,
  geloescht = false,
  onLoeschen,
  onSchliessen,
  onSitzungAbgelaufen,
}: AnmerkungLesenProps) {
  const [bestaetigen, setBestaetigen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    setBestaetigen(false);
    setFehler(null);
  }, [anmerkung.id]);

  async function entfernen() {
    if (!bestaetigen) {
      setBestaetigen(true);
      return;
    }
    setLaeuft(true);
    setFehler(null);
    try {
      await onLoeschen();
      setBestaetigen(false);
    } catch (e) {
      setFehler(behandleFehler(e, onSitzungAbgelaufen) ?? fehlerText(e));
    } finally {
      setLaeuft(false);
    }
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
      {fehler ? <p role="alert">{fehler}</p> : null}
      <div className="anmerkung-aktionen">
        {anmerkung.can_delete && !geloescht ? (
          bestaetigen ? (
            <>
              <button type="button" disabled={laeuft} onClick={() => void entfernen()}>
                Löschen bestätigen
              </button>
              <button
                type="button"
                disabled={laeuft}
                onClick={() => setBestaetigen(false)}
              >
                Löschen abbrechen
              </button>
            </>
          ) : (
            <button type="button" disabled={laeuft} onClick={() => setBestaetigen(true)}>
              Anmerkung löschen
            </button>
          )
        ) : null}
        <button type="button" disabled={laeuft} onClick={onSchliessen}>
          Schließen
        </button>
      </div>
    </section>
  );
}
