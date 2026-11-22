import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy, PageViewport, RenderTask } from "pdfjs-dist";
import { PdfAnmerkungsEbene } from "../annotations/PdfAnmerkungsEbene";
import type { Anmerkung } from "../annotations/annotations";
import type { PdfVorrat } from "../documents/pdfLaden";
import type { StageEintrag } from "./stage";

interface StagePdfProps {
  bandId: string;
  eintrag: StageEintrag | null;
  seite: number | null;
  vorrat: PdfVorrat;
  annotationen: Anmerkung[];
}

const ZOOM_MIN = 60;
const ZOOM_MAX = 220;

export function StagePdf({ bandId, eintrag, seite, vorrat, annotationen }: StagePdfProps) {
  const behaelter = useRef<HTMLDivElement>(null);
  const leinwand = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [drehung, setDrehung] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [breite, setBreite] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ansicht, setAnsicht] = useState<{
    basis: PageViewport;
    aktuell: PageViewport;
    breite: number;
    hoehe: number;
  } | null>(null);

  const versionId = eintrag?.document?.version_id ?? null;
  const songId = eintrag?.song?.id ?? null;
  const seitenzahl = eintrag?.document?.page_count ?? 0;
  const zielSeite = Math.min(Math.max(seite ?? 1, 1), Math.max(seitenzahl, 1));

  useEffect(() => {
    setDrehung(0);
    setZoom(100);
    setBreite(true);
    setFehler(null);
    if (!versionId || !songId) {
      setPdf(null);
      setAnsicht(null);
      return;
    }
    let aktiv = true;
    const vorhanden = vorrat.get(versionId);
    if (vorhanden) {
      setPdf(vorhanden);
      return;
    }
    vorrat
      .lade({
        versionId,
        byteSize: eintrag?.document?.byte_size ?? 0,
        url: `/api/bands/${encodeURIComponent(bandId)}/songs/${songId}/document/versions/${versionId}/file/`,
      })
      .then((geladen) => {
        if (aktiv) {
          setPdf(geladen);
        }
      })
      .catch(() => {
        if (aktiv) {
          setFehler("Diese PDF ist nicht vorbereitet. Bitte Verbindung prüfen.");
        }
      });
    return () => {
      aktiv = false;
    };
  }, [bandId, eintrag?.document?.byte_size, songId, versionId, vorrat]);

  useEffect(() => {
    if (!pdf || !leinwand.current) {
      return;
    }
    let abgebrochen = false;
    let render: RenderTask | null = null;
    let pdfSeite: PDFPageProxy | null = null;
    (async () => {
      pdfSeite = await pdf.getPage(zielSeite);
      if (abgebrochen || !leinwand.current) {
        return;
      }
      const gesamtDrehung = ((pdfSeite.rotate ?? 0) + drehung) % 360;
      const grund = pdfSeite.getViewport({ scale: 1, rotation: gesamtDrehung });
      const verfuegbar = behaelter.current?.clientWidth ?? grund.width;
      const skalierung = breite ? Math.max(verfuegbar / grund.width, 0.1) : zoom / 100;
      const viewport = pdfSeite.getViewport({ scale: skalierung, rotation: gesamtDrehung });
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
      render = pdfSeite.render({ canvas, viewport: renderViewport });
      try {
        await render.promise;
      } catch (ursache) {
        const name = (ursache as { name?: string })?.name;
        if (!abgebrochen && name !== "RenderingCancelledException") {
          setFehler("Die Seite konnte nicht gezeichnet werden.");
        }
      }
    })();
    return () => {
      abgebrochen = true;
      render?.cancel();
      pdfSeite?.cleanup();
    };
  }, [breite, drehung, pdf, zoom, zielSeite]);

  if (!eintrag) {
    return <p className="buehne-hinweis">Kein Song ausgewählt.</p>;
  }

  if (!eintrag.document) {
    return (
      <article className="buehne-songinfo" aria-label={`Songinformation ${eintrag.song?.title ?? eintrag.label}`}>
        <h2>{eintrag.song?.title ?? eintrag.label}</h2>
        <dl>
          {eintrag.song?.artist ? (
            <>
              <dt>Interpret</dt>
              <dd>{eintrag.song.artist}</dd>
            </>
          ) : null}
          {eintrag.song?.key ? (
            <>
              <dt>Tonart</dt>
              <dd>{eintrag.song.key}</dd>
            </>
          ) : null}
          {eintrag.song?.bpm ? (
            <>
              <dt>BPM</dt>
              <dd>{eintrag.song.bpm}</dd>
            </>
          ) : null}
        </dl>
        {eintrag.song?.notes ? <p>{eintrag.song.notes}</p> : null}
        <p className="buehne-hinweis">Für diesen Song gibt es keine PDF.</p>
      </article>
    );
  }

  return (
    <div className="buehne-pdf">
      <div className="buehne-pdf-werkzeuge" role="toolbar" aria-label="PDF-Werkzeuge">
        <button
          type="button"
          onClick={() => {
            setBreite(false);
            setZoom((wert) => Math.max(ZOOM_MIN, wert - 10));
          }}
        >
          Verkleinern
        </button>
        <button
          type="button"
          onClick={() => {
            setBreite(false);
            setZoom((wert) => Math.min(ZOOM_MAX, wert + 10));
          }}
        >
          Vergrößern
        </button>
        <button type="button" onClick={() => setDrehung((wert) => (wert + 90) % 360)}>
          Drehen
        </button>
        <button type="button" onClick={() => setBreite(true)} aria-pressed={breite}>
          Breite anpassen
        </button>
      </div>
      <div className="buehne-blatt" ref={behaelter}>
        <canvas ref={leinwand} aria-label="PDF-Seite" />
        {ansicht ? (
          <PdfAnmerkungsEbene
            annotationen={annotationen.filter(
              (anmerkung) => anmerkung.page_number === zielSeite,
            )}
            basis={ansicht.basis}
            aktuell={ansicht.aktuell}
            breite={ansicht.breite}
            hoehe={ansicht.hoehe}
            werkzeug="lesen"
            ausgewaehlteId={null}
            onMarkierung={() => undefined}
            onTextPlatzieren={() => undefined}
            onAuswahl={() => undefined}
          />
        ) : null}
      </div>
      {fehler ? <p role="alert">{fehler}</p> : null}
    </div>
  );
}
