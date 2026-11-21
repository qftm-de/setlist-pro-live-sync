import { AnmerkungsGriff } from "./AnmerkungsGriff";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { PageViewport } from "pdfjs-dist";
import {
  begrenze,
  markerGeometrieAusPunkten,
  textGeometrieAusPunkten,
  type Punkt,
} from "./geometrie";
import type { Anmerkung, Geometrie } from "./annotations";

export type AnmerkungsWerkzeug = "lesen" | "text" | "marker";

interface EbeneProps {
  annotationen: Anmerkung[];
  basis: PageViewport;
  aktuell: PageViewport;
  breite: number;
  hoehe: number;
  werkzeug: AnmerkungsWerkzeug;
  ausgewaehlteId: number | null;
  entwurf?: Geometrie | null;
  onGeometrie?: (id: number, geometrie: Geometrie) => void;
  onMarkierung: (geometrie: Geometrie) => void;
  onTextPlatzieren: (geometrie: Geometrie) => void;
  onAuswahl: (id: number) => void;
}

interface Position {
  left: number;
  top: number;
  width: number;
  height: number;
}

function positionImViewport(
  geometrie: Geometrie,
  basis: PageViewport,
  aktuell: PageViewport,
): Position {
  const ecken: Array<[number, number]> = [
    [geometrie.x, geometrie.y],
    [geometrie.x + geometrie.width, geometrie.y],
    [geometrie.x, geometrie.y + geometrie.height],
    [geometrie.x + geometrie.width, geometrie.y + geometrie.height],
  ].map(([nx, ny]) => {
    const [pdfX, pdfY] = basis.convertToPdfPoint(nx * basis.width, ny * basis.height);
    const [vx, vy] = aktuell.convertToViewportPoint(pdfX, pdfY);
    return [vx, vy] as [number, number];
  });
  const xs = ecken.map(([x]) => x);
  const ys = ecken.map(([, y]) => y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return {
    left,
    top,
    width: Math.max(...xs) - left,
    height: Math.max(...ys) - top,
  };
}

export function PdfAnmerkungsEbene({
  annotationen,
  basis,
  aktuell,
  breite,
  hoehe,
  werkzeug,
  ausgewaehlteId,
  entwurf = null,
  onGeometrie,
  onMarkierung,
  onTextPlatzieren,
  onAuswahl,
}: EbeneProps) {
  const ziehen = useRef<{id:number; p:Punkt; g:Geometrie} | null>(null);
  const halten = useRef<ReturnType<typeof setTimeout> | null>(null);
  const beruehrung = useRef<{x:number;y:number} | null>(null);
  useEffect(() => () => { if (halten.current) clearTimeout(halten.current); }, []);
  const flaeche = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = flaeche.current;
    const bewegen = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        abbrechen();
        if (halten.current) clearTimeout(halten.current);
        if (ziehen.current) onGeometrie?.(ziehen.current.id, ziehen.current.g);
        ziehen.current = null;
      } else if (ziehen.current) e.preventDefault();
    };
    element?.addEventListener("touchmove", bewegen, {passive:false});
    element?.addEventListener("touchstart", bewegen, {passive:false});
    return () => { element?.removeEventListener("touchmove", bewegen); element?.removeEventListener("touchstart", bewegen); };
  }, [onGeometrie]);
  const start = useRef<Punkt | null>(null);
  const [vorschau, setVorschau] = useState<Geometrie | null>(null);

  const positionen = useMemo(
    () =>
      annotationen.map((anmerkung) => ({
        anmerkung,
        position: positionImViewport(anmerkung.geometry, basis, aktuell),
      })),
    [aktuell, annotationen, basis],
  );

  function punkt(ereignis: React.PointerEvent): Punkt | null {
    const element = flaeche.current;
    if (!element) {
      return null;
    }
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return null;
    }
    const x = ((ereignis.clientX - rect.left) / rect.width) * aktuell.width;
    const y = ((ereignis.clientY - rect.top) / rect.height) * aktuell.height;
    const [pdfX, pdfY] = aktuell.convertToPdfPoint(x, y);
    const [ix, iy] = basis.convertToViewportPoint(pdfX, pdfY);
    return { x: begrenze(ix / basis.width), y: begrenze(iy / basis.height) };
  }

  function unten(ereignis: React.PointerEvent) {
    if (werkzeug === "lesen") {
      return;
    }
    if (start.current) { abbrechen(); return; }
    const punktStart = punkt(ereignis);
    if (!punktStart) {
      return;
    }
    start.current = punktStart;
    setVorschau(
      werkzeug === "text"
        ? textGeometrieAusPunkten(punktStart, punktStart)
        : markerGeometrieAusPunkten(punktStart, punktStart),
    );
    try {
      ereignis.currentTarget.setPointerCapture(ereignis.pointerId);
    } catch {
      // Synthetische Touch-Ereignisse haben keinen aktiven Pointer.
    }
  }

  function bewegen(ereignis: React.PointerEvent) {
    if (!start.current || werkzeug === "lesen") {
      return;
    }
    const jetzt = punkt(ereignis);
    if (jetzt) {
      setVorschau(
        werkzeug === "text"
          ? textGeometrieAusPunkten(start.current, jetzt)
          : markerGeometrieAusPunkten(start.current, jetzt),
      );
    }
  }

  function oben(ereignis: React.PointerEvent) {
    if (!start.current || werkzeug === "lesen") {
      return;
    }
    const jetzt = punkt(ereignis) ?? start.current;
    const startPunkt = start.current;
    start.current = null;
    setVorschau(null);
    try {
      ereignis.currentTarget.releasePointerCapture?.(ereignis.pointerId);
    } catch {
      // Synthetische Touch-Ereignisse haben keinen aktiven Pointer.
    }
    if (werkzeug === "text") {
      onTextPlatzieren(textGeometrieAusPunkten(startPunkt, jetzt));
    } else {
      onMarkierung(markerGeometrieAusPunkten(startPunkt, jetzt));
    }
  }

  function abbrechen() {
    start.current = null;
    setVorschau(null);
  }

  const aktiveVorschau = vorschau ?? entwurf ?? null;
  const vorschauPosition =
    aktiveVorschau && basis && aktuell
      ? positionImViewport(aktiveVorschau, basis, aktuell)
      : null;

  return (
    <div
      ref={flaeche}
      className={`pdf-ebene werkzeug-${werkzeug}`}
      style={{ width: breite, height: hoehe }}
      onPointerDown={werkzeug === "lesen" ? undefined : unten}
      onPointerMove={bewegen}
      onPointerUp={oben}
      onPointerCancel={abbrechen}
      data-testid="pdf-ebene"
    >
      {positionen.map(({ anmerkung, position }) => (
        <Fragment key={anmerkung.id}><button
          type="button"
          className={`pdf-anmerkung farbe-${anmerkung.color} art-${anmerkung.kind}`}
          style={{
            left: position.left,
            top: position.top,
            width: position.width,
            height: position.height,
            fontSize:
              anmerkung.kind === "text"
                ? (anmerkung.font_size ?? 0.0225) * basis.height * aktuell.scale
                : undefined,
          }}
          aria-pressed={ausgewaehlteId === anmerkung.id}
          aria-label={
            anmerkung.kind === "text"
              ? `Textanmerkung ${anmerkung.id}`
              : `Marker ${anmerkung.id}`
          }
          onContextMenu={e => e.preventDefault()}
          onPointerDown={e => {
            e.stopPropagation();
            beruehrung.current = {x:e.clientX,y:e.clientY};
            const p = punkt(e), target = e.currentTarget, pointerId = e.pointerId;
            if (anmerkung.can_edit && p) halten.current = setTimeout(() => {
              onAuswahl(anmerkung.id);
              ziehen.current = {id:anmerkung.id,p,g:anmerkung.geometry};
              try { target.setPointerCapture(pointerId); } catch { /* Pointer bereits beendet. */ }
            }, 400);
          }}
          onPointerMove={e => {
            const z = ziehen.current, p = punkt(e);
            if (z && p) {
              e.stopPropagation();
              onGeometrie?.(z.id,{...z.g,x:Math.max(0,Math.min(1-z.g.width,z.g.x+p.x-z.p.x)),y:Math.max(0,Math.min(1-z.g.height,z.g.y+p.y-z.p.y))});
              return;
            }
            if (beruehrung.current && Math.hypot(e.clientX-beruehrung.current.x,e.clientY-beruehrung.current.y)>8 && halten.current) clearTimeout(halten.current);
          }}
          onPointerUp={() => { if (halten.current) clearTimeout(halten.current); ziehen.current = null; }}
          onPointerCancel={() => { if (halten.current) clearTimeout(halten.current); if (ziehen.current) onGeometrie?.(ziehen.current.id,ziehen.current.g); ziehen.current = null; }}
          onClick={() => onAuswahl(anmerkung.id)}
        >
          {anmerkung.kind === "text" ? anmerkung.text : null}
        </button>
        {ausgewaehlteId === anmerkung.id && anmerkung.can_edit && onGeometrie ? (
          <div className="anmerkung-griffe" style={{left:position.left,top:position.top,width:position.width,height:position.height}}>
            <AnmerkungsGriff geometrie={anmerkung.geometry} punkt={punkt} onAendern={g => onGeometrie(anmerkung.id,g)} />
            <AnmerkungsGriff groesse geometrie={anmerkung.geometry} punkt={punkt} onAendern={g => onGeometrie(anmerkung.id,g)} />
          </div>
        ) : null}</Fragment>
      ))}
      {vorschauPosition ? (
        <div
          className="pdf-anmerkung-vorschau"
          data-testid="pdf-anmerkung-vorschau"
          style={{
            left: vorschauPosition.left,
            top: vorschauPosition.top,
            width: vorschauPosition.width,
            height: vorschauPosition.height,
          }}
        />
      ) : null}
    </div>
  );
}
