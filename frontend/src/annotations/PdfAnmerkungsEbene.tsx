import { useMemo, useRef, useState } from "react";
import type { PageViewport } from "pdfjs-dist";
import {
  begrenze,
  rechteckAusPunkten,
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
  onMarkierung,
  onTextPlatzieren,
  onAuswahl,
}: EbeneProps) {
  const flaeche = useRef<HTMLDivElement>(null);
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
    const punktStart = punkt(ereignis);
    if (!punktStart) {
      return;
    }
    if (werkzeug === "text") {
      const geometrie = rechteckAusPunkten(punktStart, {
        x: begrenze(punktStart.x + 0.28),
        y: begrenze(punktStart.y + 0.07),
      });
      if (geometrie) {
        onTextPlatzieren(geometrie);
      }
      return;
    }
    start.current = punktStart;
    setVorschau(null);
    try {
      ereignis.currentTarget.setPointerCapture(ereignis.pointerId);
    } catch {
      // Synthetische Touch-Ereignisse haben keinen aktiven Pointer.
    }
  }

  function bewegen(ereignis: React.PointerEvent) {
    if (!start.current || werkzeug !== "marker") {
      return;
    }
    const jetzt = punkt(ereignis);
    if (jetzt) {
      setVorschau(rechteckAusPunkten(start.current, jetzt));
    }
  }

  function oben(ereignis: React.PointerEvent) {
    if (!start.current || werkzeug !== "marker") {
      return;
    }
    const jetzt = punkt(ereignis) ?? start.current;
    const geometrie = rechteckAusPunkten(start.current, jetzt);
    start.current = null;
    setVorschau(null);
    try {
      ereignis.currentTarget.releasePointerCapture?.(ereignis.pointerId);
    } catch {
      // Synthetische Touch-Ereignisse haben keinen aktiven Pointer.
    }
    if (geometrie) {
      onMarkierung(geometrie);
    }
  }

  function abbrechen() {
    start.current = null;
    setVorschau(null);
  }

  const vorschauPosition =
    vorschau && basis && aktuell
      ? positionImViewport(vorschau, basis, aktuell)
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
        <button
          key={anmerkung.id}
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
          onClick={() => onAuswahl(anmerkung.id)}
        >
          {anmerkung.kind === "text" ? anmerkung.text : null}
        </button>
      ))}
      {vorschauPosition ? (
        <div
          className="pdf-anmerkung-vorschau"
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
