import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy, PageViewport, RenderTask } from "pdfjs-dist";
import {
  PdfAnmerkungsEbene,
  type AnmerkungsWerkzeug,
} from "../annotations/PdfAnmerkungsEbene";
import type { Anmerkung, Geometrie } from "../annotations/annotations";
import "./documents.css";

export interface PdfViewerProps {
  daten: ArrayBuffer;
  titel: string;
  annotationen?: Anmerkung[];
  werkzeug?: AnmerkungsWerkzeug;
  ausgewaehlteId?: number | null;
  onMarkierung?: (geometrie: Geometrie) => void;
  onTextPlatzieren?: (geometrie: Geometrie) => void;
  onAnmerkungAuswahl?: (id: number) => void;
  onBevorSeiteWechsel?: (ziel: number) => boolean;
  onSeiteGeaendert?: (seite: number) => void;
  seitenSprung?: { ziel: number; token: number } | null;
}

const MIN_ZOOM = 50;
const MAX_ZOOM = 300;
const ZOOM_SCHRITT = 25;

export function PdfViewer({
  daten,
  titel,
  annotationen = [],
  werkzeug = "lesen",
  ausgewaehlteId = null,
  onMarkierung,
  onTextPlatzieren,
  onAnmerkungAuswahl,
  onBevorSeiteWechsel,
  onSeiteGeaendert,
  seitenSprung = null,
}: PdfViewerProps) {
  const behaelter = useRef<HTMLDivElement>(null);
  const leinwand = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [seite, setSeite] = useState(1);
  const [seiten, setSeiten] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [breite, setBreite] = useState(true);
  const [drehung, setDrehung] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ansicht, setAnsicht] = useState<{
    basis: PageViewport;
    aktuell: PageViewport;
    breite: number;
    hoehe: number;
  } | null>(null);

  useEffect(() => {
    let abgebrochen = false;
    let aufgabe: { destroy: () => Promise<void> } | null = null;
    setPdf(null);
    setFehler(null);
    setSeite(1);
    setSeiten(0);
    setAnsicht(null);

    (async () => {
      const pdfjs = await import("pdfjs-dist");
      const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      if (abgebrochen) {
        return;
      }
      pdfjs.GlobalWorkerOptions.workerSrc = worker;
      const lade = pdfjs.getDocument({
        data: new Uint8Array(daten.slice(0)),
        cMapUrl: "/pdfjs/cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "/pdfjs/standard_fonts/",
        wasmUrl: "/pdfjs/wasm/",
      });
      aufgabe = lade;
      try {
        const geladen = await lade.promise;
        if (abgebrochen) {
          await lade.destroy();
          return;
        }
        setPdf(geladen);
        setSeiten(geladen.numPages);
      } catch {
        if (!abgebrochen) {
          setFehler("Die PDF konnte nicht angezeigt werden.");
        }
      }
    })();

    return () => {
      abgebrochen = true;
      aufgabe?.destroy().catch(() => undefined);
    };
  }, [daten]);

  useEffect(() => {
    if (!pdf || !leinwand.current) {
      return;
    }
    let abgebrochen = false;
    let render: RenderTask | null = null;
    let pdfSeite: PDFPageProxy | null = null;

    (async () => {
      pdfSeite = await pdf.getPage(seite);
      if (abgebrochen || !leinwand.current) {
        return;
      }
      const gesamtDrehung = ((pdfSeite.rotate ?? 0) + drehung) % 360;
      const grund = pdfSeite.getViewport({ scale: 1, rotation: gesamtDrehung });
      const verfuegbar = behaelter.current?.clientWidth ?? grund.width;
      const skalierung = breite
        ? Math.max(verfuegbar / grund.width, 0.1)
        : zoom / 100;
      const viewport = pdfSeite.getViewport({
        scale: skalierung,
        rotation: gesamtDrehung,
      });
      const basis = pdfSeite.getViewport({
        scale: 1,
        rotation: (pdfSeite.rotate ?? 0) % 360,
      });
      setAnsicht({
        basis,
        aktuell: viewport,
        breite: viewport.width,
        hoehe: viewport.height,
      });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const renderViewport = pdfSeite.getViewport({
        scale: skalierung * ratio,
        rotation: gesamtDrehung,
      });
      const canvas = leinwand.current;
      if (!canvas) {
        return;
      }
      canvas.width = Math.floor(renderViewport.width);
      canvas.height = Math.floor(renderViewport.height);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      render = pdfSeite.render({
        canvas,
        viewport: renderViewport,
      });
      try {
        await render.promise;
      } catch (ursache) {
        const name = (ursache as { name?: string })?.name;
        if (!abgebrochen && name !== "RenderingCancelledException") {
          setFehler("Die PDF konnte nicht gezeichnet werden.");
        }
      }
    })();

    return () => {
      abgebrochen = true;
      render?.cancel();
      pdfSeite?.cleanup();
    };
  }, [annotationen, pdf, seite, zoom, breite, drehung]);

  useEffect(() => {
    onSeiteGeaendert?.(seite);
  }, [onSeiteGeaendert, seite]);

  useEffect(() => {
    if (seitenSprung) {
      setSeite(seitenSprung.ziel);
    }
  }, [seitenSprung]);

  function seiteWechseln(ziel: number) {
    if (ziel < 1 || ziel > seiten) {
      return;
    }
    if (onBevorSeiteWechsel && !onBevorSeiteWechsel(ziel)) {
      return;
    }
    setSeite(ziel);
  }

  function zoome(delta: number) {
    setBreite(false);
    setZoom((wert) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, wert + delta)));
  }

  return (
    <div className="pdf-viewer">
      <div className="pdf-werkzeuge" role="toolbar" aria-label={`PDF ${titel}`}>
        <button type="button" onClick={() => seiteWechseln(seite - 1)} disabled={seite <= 1}>
          Vorherige Seite
        </button>
        <span role="status">
          Seite {seiten === 0 ? "…" : seite} von {seiten || "…"}
        </span>
        <button
          type="button"
          onClick={() => seiteWechseln(seite + 1)}
          disabled={seiten === 0 || seite >= seiten}
        >
          Nächste Seite
        </button>
        <button type="button" onClick={() => zoome(-ZOOM_SCHRITT)} disabled={!breite && zoom <= MIN_ZOOM}>
          Verkleinern
        </button>
        <label>
          Zoom
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={ZOOM_SCHRITT}
            value={zoom}
            aria-label="Zoom in Prozent"
            onChange={(ereignis) => {
              setBreite(false);
              setZoom(Number(ereignis.target.value));
            }}
          />
        </label>
        <button type="button" onClick={() => zoome(ZOOM_SCHRITT)} disabled={!breite && zoom >= MAX_ZOOM}>
          Vergrößern
        </button>
        <button type="button" onClick={() => setBreite(true)} aria-pressed={breite}>
          An Breite anpassen
        </button>
        <button type="button" onClick={() => setDrehung((wert) => (wert + 90) % 360)}>
          Drehen
        </button>
        <span className="songmeta">{breite ? "Breite" : `${zoom} %`}</span>
      </div>
      {fehler ? <p role="alert">{fehler}</p> : null}
      <div className="pdf-flaeche" ref={behaelter}>
        {pdf ? null : <p role="status">PDF lädt …</p>}
        <div
          className="pdf-seite"
          style={ansicht ? { width: ansicht.breite, height: ansicht.hoehe } : undefined}
        >
          <canvas ref={leinwand} aria-label={`Seite ${seite} von ${titel}`} />
          {ansicht ? (
            <PdfAnmerkungsEbene
              annotationen={annotationen.filter(
                (anmerkung) => anmerkung.page_number === seite,
              )}
              basis={ansicht.basis}
              aktuell={ansicht.aktuell}
              breite={ansicht.breite}
              hoehe={ansicht.hoehe}
              werkzeug={werkzeug}
              ausgewaehlteId={ausgewaehlteId}
              onMarkierung={onMarkierung ?? (() => undefined)}
              onTextPlatzieren={onTextPlatzieren ?? (() => undefined)}
              onAuswahl={onAnmerkungAuswahl ?? (() => undefined)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
