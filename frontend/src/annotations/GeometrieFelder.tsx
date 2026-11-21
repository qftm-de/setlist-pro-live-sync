import type { Geometrie } from "./annotations";
interface GeometrieFelderProps {
  geometrie: Geometrie; seite: number; seiten: number; disabled: boolean;
  onGeometrie: (geometrie: Geometrie) => void; onSeite: (seite: number) => void;
}
export function GeometrieFelder({ seite, seiten, disabled, onSeite }: GeometrieFelderProps) {
  return <label>Seite<select value={seite} disabled={disabled} onChange={e => onSeite(Number(e.target.value))}>
    {Array.from({length: seiten}, (_, i) => <option key={i + 1}>{i + 1}</option>)}
  </select><span className="songmeta">Position direkt auf dem Blatt ändern: gedrückt halten und ziehen.</span></label>;
}
