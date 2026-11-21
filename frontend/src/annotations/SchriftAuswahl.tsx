import { SCHRIFTGROESSEN, type Schriftgroesse } from "./annotations";
interface Props { wert: number; disabled?: boolean; onChange: (wert: Schriftgroesse) => void; }
export function SchriftAuswahl({wert,disabled = false,onChange}: Props) {
  const index = SCHRIFTGROESSEN.indexOf(wert as Schriftgroesse);
  return <div className="schrift-auswahl">
    <label>Schriftgröße<select value={String(wert)} disabled={disabled} onChange={e => onChange(Number(e.target.value) as Schriftgroesse)}>
      {SCHRIFTGROESSEN.map((g,i) => <option key={g} value={g}>{["Klein","Mittel","Groß"][i]}</option>)}
    </select></label>
    <button type="button" disabled={disabled || index <= 0} onClick={() => onChange(SCHRIFTGROESSEN[index-1])}>Kleiner</button>
    <button type="button" disabled={disabled || index >= SCHRIFTGROESSEN.length-1} onClick={() => onChange(SCHRIFTGROESSEN[index+1])}>Größer</button>
  </div>;
}
