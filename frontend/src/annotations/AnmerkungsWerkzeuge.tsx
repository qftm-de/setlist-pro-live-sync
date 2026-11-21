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

const WERKZEUG_HINWEIS: Record<AnmerkungsWerkzeug, string> = {
  lesen: "Tippe eine Anmerkung zum Bearbeiten an oder wähle oben ein Werkzeug.",
  text: "Tippe auf die gewünschte Stelle im PDF, um Text einzufügen.",
  marker: "Ziehe mit dem Finger über das PDF oder tippe eine Stelle an.",
};

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
      <h3 id="anmerkung-werkzeuge-titel" className="visuell-verborgen">
        Anmerkungen
      </h3>
      <div className="werkzeuge-hauptleiste">
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
        <div role="group" aria-label="Farbe">
          {FARBEN.map((wert) => (
            <button
              key={wert}
              type="button"
              className="farb-knopf"
              aria-pressed={farbe === wert}
              onClick={() => setFarbe(wert)}
            >
              <span className={`farb-punkt farbe-${wert}`} aria-hidden="true" />
              {farbName(wert)}
            </button>
          ))}
        </div>
        <label className="werkzeug-schrift">
          Schriftgröße
          <select
            value={String(schriftgroesse)}
            onChange={(ereignis) =>
              setSchriftgroesse(Number(ereignis.target.value) as Schriftgroesse)
            }
          >
            {SCHRIFTGROESSEN.map((wert) => (
              <option key={wert} value={wert}>
                {wert === 0.015 ? "Klein" : wert === 0.03 ? "Groß" : "Mittel"}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="werkzeug-hinweis">{WERKZEUG_HINWEIS[werkzeug]}</p>
      <div className="werkzeuge-zusatzleiste">
        <div className="ebenen-filter">
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
        </div>
        <div className="tastatur-aktionen">
          <button type="button" className="sekundaer-knopf" onClick={onNeuerText}>
            Neue Textanmerkung
          </button>
          <button type="button" className="sekundaer-knopf" onClick={onNeuerMarker}>
            Neue Markeranmerkung
          </button>
        </div>
      </div>
    </section>
  );
}
