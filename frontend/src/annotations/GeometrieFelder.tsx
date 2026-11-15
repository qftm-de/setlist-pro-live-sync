import type { Geometrie } from "./annotations";

interface GeometrieFelderProps {
  geometrie: Geometrie;
  seite: number;
  seiten: number;
  disabled: boolean;
  onGeometrie: (geometrie: Geometrie) => void;
  onSeite: (seite: number) => void;
}

function zahlen(wert: string, standard: number): number {
  const zahl = Number(wert.replace(",", "."));
  return Number.isFinite(zahl) ? zahl : standard;
}

export function GeometrieFelder({
  geometrie,
  seite,
  seiten,
  disabled,
  onGeometrie,
  onSeite,
}: GeometrieFelderProps) {
  function feld(name: keyof Geometrie, wert: string) {
    onGeometrie({ ...geometrie, [name]: zahlen(wert, geometrie[name]) });
  }

  return (
    <div className="anmerkung-geometrie">
      <label>
        Seite
        <input
          type="number"
          min={1}
          max={seiten}
          value={seite}
          disabled={disabled}
          onChange={(ereignis) => onSeite(Number(ereignis.target.value))}
        />
      </label>
      {(["x", "y", "width", "height"] as const).map((name) => (
        <label key={name}>
          {name === "x"
            ? "x (0–1)"
            : name === "y"
              ? "y (0–1)"
              : name === "width"
                ? "Breite (0–1)"
                : "Höhe (0–1)"}
          <input
            type="number"
            step="0.01"
            min={0}
            max={1}
            value={geometrie[name]}
            disabled={disabled}
            onChange={(ereignis) => feld(name, ereignis.target.value)}
          />
        </label>
      ))}
    </div>
  );
}
