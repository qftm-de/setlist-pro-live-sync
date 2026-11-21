import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Geometrie } from "./annotations";
import type { Punkt } from "./geometrie";

interface Props {
  geometrie: Geometrie;
  punkt: (e: PointerEvent) => Punkt | null;
  onAendern: (g: Geometrie) => void;
  groesse?: boolean;
}
/** Ein Griff verändert nur den lokalen Entwurf. Die Speicherung bleibt beim Formular. */
export function AnmerkungsGriff({ geometrie, punkt, onAendern, groesse = false }: Props) {
  const start = useRef<{p: Punkt; g: Geometrie; id: number} | null>(null);
  const [aktiv, setAktiv] = useState(false);
  useEffect(() => () => { start.current = null; }, []);
  function abbrechen() {
    if (start.current) onAendern(start.current.g);
    start.current = null;
    setAktiv(false);
  }
  return <button type="button" className={`anmerkung-griff ${groesse ? "griff-groesse" : "griff-position"}`}
    aria-label={groesse ? "Größe ändern" : "Anmerkung verschieben"} aria-pressed={aktiv}
    onPointerDown={e => {
      e.stopPropagation();
      if (!e.isPrimary && e.pointerType === "touch") { abbrechen(); return; }
      const p = punkt(e); if (!p) return;
      start.current = {p, g: geometrie, id: e.pointerId};
      e.currentTarget.setPointerCapture?.(e.pointerId); setAktiv(true);
    }}
    onPointerMove={e => {
      e.stopPropagation();
      const s = start.current, p = punkt(e); if (!s || !p || s.id !== e.pointerId) return;
      const dx = p.x - s.p.x, dy = p.y - s.p.y;
      const g = groesse ? {...s.g, width: Math.min(1-s.g.x, Math.max(.02, s.g.width+dx)), height: Math.min(1-s.g.y, Math.max(.02, s.g.height+dy))}
        : {...s.g, x: Math.max(0, Math.min(1-s.g.width, s.g.x+dx)), y: Math.max(0, Math.min(1-s.g.height, s.g.y+dy))};
      onAendern(g);
    }}
    onPointerUp={e => { e.stopPropagation(); start.current = null; setAktiv(false); }}
    onPointerCancel={abbrechen}
    onKeyDown={e => {
      const richtung = {ArrowLeft: [-.005,0], ArrowRight: [.005,0], ArrowUp: [0,-.005], ArrowDown: [0,.005]}[e.key];
      if (!richtung) return;
      e.preventDefault(); const [dx,dy] = richtung;
      onAendern(groesse ? {...geometrie, width: Math.min(1-geometrie.x,Math.max(.02,geometrie.width+dx)),height: Math.min(1-geometrie.y,Math.max(.02,geometrie.height+dy))}
        : {...geometrie,x:Math.max(0,Math.min(1-geometrie.width,geometrie.x+dx)),y:Math.max(0,Math.min(1-geometrie.height,geometrie.y+dy))});
    }}>{groesse ? "↘" : "✥"}</button>;
}
