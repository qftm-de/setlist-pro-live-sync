import type { Verbindungszustand } from "./typen";
import "./realtime.css";

const TEXTE: Record<Verbindungszustand, string> = {
  verbinden: "Verbindung wird aufgebaut.",
  verbunden: "Verbunden. Änderungen werden abgeglichen.",
  unterbrochen: "Verbindung unterbrochen.",
  abgleich: "Abgleich läuft.",
  "abgleich-fehlgeschlagen": "Abgleich fehlgeschlagen.",
};

interface VerbindungsStatusProps {
  zustand: Verbindungszustand;
  onErneutVersuchen: () => void;
}

export function VerbindungsStatus({
  zustand,
  onErneutVersuchen,
}: VerbindungsStatusProps) {
  return (
    <p
      className={`echtzeit-status echtzeit-${zustand}`}
      aria-live="polite"
      data-echtzeit-status={zustand}
    >
      {TEXTE[zustand]}
      {zustand === "unterbrochen" || zustand === "abgleich-fehlgeschlagen" ? (
        <button type="button" className="echtzeit-erneut" onClick={onErneutVersuchen}>
          Erneut versuchen
        </button>
      ) : null}
    </p>
  );
}
