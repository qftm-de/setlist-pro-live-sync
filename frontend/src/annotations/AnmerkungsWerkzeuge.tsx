import {
  FARBEN,
  SCHRIFTGROESSEN,
  farbName,
  type AnmerkungsFarbe,
  type Schriftgroesse,
} from "./annotations";
import type { AnmerkungsWerkzeug } from "./PdfAnmerkungsEbene";

interface WerkzeugeProps {
  werkzeug: AnmerkungsWerkzeug;
  setWerkzeug: (wert: AnmerkungsWerkzeug) => void;
  farbe: AnmerkungsFarbe;
  setFarbe: (wert: AnmerkungsFarbe) => void;
  schriftgroesse: Schriftgroesse;
  setSchriftgroesse: (wert: Schriftgroesse) => void;
  ebeneEigene: boolean;
  setEbeneEigene: (wert: boolean) => void;
  ebeneBand: boolean;
  setEbeneBand: (wert: boolean) => void;
  onNeuerText: () => void;
  onNeuerMarker: () => void;
}

const WERKZEUGE: Array<{ wert: AnmerkungsWerkzeug; name: string }> = [
  { wert: "lesen", name: "Lesen" },
  { wert: "text", name: "Text setzen" },
  { wert: "marker", name: "Marker zeichnen" },
];

export function AnmerkungsWerkzeuge({
  werkzeug,
  setWerkzeug,
  farbe,
  setFarbe,
  schriftgroesse,
  setSchriftgroesse,
  ebeneEigene,
  setEbeneEigene,
  ebeneBand,
  setEbeneBand,
  onNeuerText,
  onNeuerMarker,
}: WerkzeugeProps) {
  return (
    <section className="anmerkung-werkzeuge" aria-labelledby="anmerkung-werkzeuge-titel">
      <h3 id="anmerkung-werkzeuge-titel">Anmerkungen</h3>
      <div role="group" aria-label="Werkzeug">
        {WERKZEUGE.map((eintrag) => (
          <button
            key={eintrag.wert}
            type="button"
            aria-pressed={werkzeug === eintrag.wert}
            onClick={() => setWerkzeug(eintrag.wert)}
          >
            {eintrag.name}
          </button>
        ))}
      </div>
      <button type="button" onClick={onNeuerText}>
        Neue Textanmerkung
      </button>
      <button type="button" onClick={onNeuerMarker}>
        Neue Markeranmerkung
      </button>
      <div role="group" aria-label="Farbe">
        {FARBEN.map((wert) => (
          <button
            key={wert}
            type="button"
            aria-pressed={farbe === wert}
            onClick={() => setFarbe(wert)}
          >
            {farbName(wert)}
          </button>
        ))}
      </div>
      <label>
        Schriftgröße
        <select
          value={String(schriftgroesse)}
          onChange={(ereignis) =>
            setSchriftgroesse(Number(ereignis.target.value) as Schriftgroesse)
          }
        >
          {SCHRIFTGROESSEN.map((wert) => (
            <option key={wert} value={wert}>
              {(wert * 100).toFixed(2)} %
            </option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={ebeneEigene}
          onChange={(ereignis) => setEbeneEigene(ereignis.target.checked)}
        />
        Eigene persönliche Anmerkungen anzeigen
      </label>
      <label>
        <input
          type="checkbox"
          checked={ebeneBand}
          onChange={(ereignis) => setEbeneBand(ereignis.target.checked)}
        />
        Bandweite Anmerkungen anzeigen
      </label>
      <p className="songmeta">
        Lesen ist der Standard. Marker zeichnest du mit Maus, Finger oder Stift.
        Die Schaltflächen für neue Anmerkungen funktionieren auch per Tastatur.
        Text und Geometrie lassen sich im Formular eintragen.
      </p>
    </section>
  );
}
