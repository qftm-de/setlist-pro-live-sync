import { useEffect, useRef, useState, type ComponentType } from "react";
import { behandleFehler, fehlerText, istApiFehler } from "../api/client";
import {
  AnmerkungsBereich,
  type AnmerkungsBereichHandle,
} from "../annotations/AnmerkungsBereich";
import { apiAnmerkungen, type AnmerkungAdapter } from "../annotations/annotations";
import { FehlerAnzeige } from "../ui/FehlerAnzeige";
import { StatusAnzeige } from "../ui/StatusAnzeige";
import { PdfViewer, type PdfViewerProps } from "./PdfViewer";
import { UploadFormular } from "./UploadFormular";
import { VersionsListe } from "./VersionsListe";
import {
  naechsteVersion,
  type Dokument,
  type DokumentAdapter,
  type DokumentVersion,
} from "./documents";
import "./documents.css";

interface DokumentAnsichtProps {
  bandId: string;
  songId: number;
  songTitel?: string;
  initialVersionId?: number | null;
  adapter: DokumentAdapter;
  anmerkungAdapter?: AnmerkungAdapter;
  viewer?: ComponentType<PdfViewerProps>;
  aktualisierung?: number;
  registriereWaechter?: (waechter: ((weiter: () => void) => void) | null) => void;
  onSitzungAbgelaufen?: () => void;
}

type DateiZustand = "leer" | "laedt" | "fertig" | "fehler";

function dateiname(name: string): string {
  const sauber = name.replace(/[\\/:*?"<>|]/g, "_").trim();
  return sauber || "dokument.pdf";
}

export function DokumentAnsicht({
  bandId,
  songId,
  songTitel,
  initialVersionId = null,
  adapter,
  anmerkungAdapter = apiAnmerkungen,
  viewer: Viewer = PdfViewer,
  aktualisierung = 0,
  registriereWaechter,
  onSitzungAbgelaufen,
}: DokumentAnsichtProps) {
  const [uploadOffen, setUploadOffen] = useState(false);
  const anmerkungsRef = useRef<AnmerkungsBereichHandle>(null);
  const [dokument, setDokument] = useState<Dokument | null>(null);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [versionId, setVersionId] = useState<number | null>(null);
  const [versionHinweis, setVersionHinweis] = useState<string | null>(null);
  const [aktiveVersionHinweis, setAktiveVersionHinweis] = useState<string | null>(null);
  const [datei, setDatei] = useState<{ versionId: number; daten: ArrayBuffer } | null>(null);
  const [dateiZustand, setDateiZustand] = useState<DateiZustand>("leer");
  const [dateiFehler, setDateiFehler] = useState<string | null>(null);
  const [aktionsFehler, setAktionsFehler] = useState<string | null>(null);
  const [beschaeftigt, setBeschaeftigt] = useState(false);
  const [neuLaden, setNeuLaden] = useState(0);
  const markeRef = useRef(aktualisierung);
  const letzteAktive = useRef<number | null | undefined>(undefined);
  const dokumentRef = useRef<Dokument | null>(null);
  const versionIdRef = useRef<number | null>(versionId);
  versionIdRef.current = versionId;

  useEffect(() => {
    if (aktualisierung === markeRef.current) {
      return;
    }
    markeRef.current = aktualisierung;
    setNeuLaden((wert) => wert + 1);
  }, [aktualisierung]);

  useEffect(() => {
    let aktiv = true;
    if (dokumentRef.current === null) {
      setLaedt(true);
    }
    setLadeFehler(null);
    adapter
      .lade(bandId, songId)
      .then((geladen) => {
        if (!aktiv) {
          return;
        }
        const vorherAktiv = letzteAktive.current;
        const jetztAktiv = geladen.active_version_id;
        letzteAktive.current = jetztAktiv;
        if (
          vorherAktiv !== undefined &&
          vorherAktiv !== jetztAktiv &&
          jetztAktiv !== null &&
          jetztAktiv !== versionIdRef.current
        ) {
          setAktiveVersionHinweis(
            "Eine neue PDF-Version wurde aktiviert. Die geöffnete Ansicht bleibt.",
          );
        }
        dokumentRef.current = geladen;
        setDokument(geladen);
        // Vorwahl im selben Durchlauf wie das Dokument setzen. Ein spaeterer
        // Effekt wuerde die bereits gerenderten Versionsknoepfe ersetzen und
        // einen Klick in diesem Moment verschlucken.
        const vorwahl = naechsteVersion(geladen, initialVersionId);
        if (
          initialVersionId !== null &&
          !geladen.versions.some((eintrag) => eintrag.id === initialVersionId) &&
          vorwahl !== null
        ) {
          setVersionHinweis("Diese Version existiert nicht. Es wird eine verfügbare Version angezeigt.");
        }
        setVersionId((vorher) =>
          vorher !== null && geladen.versions.some((eintrag) => eintrag.id === vorher)
            ? vorher
            : vorwahl,
        );
        setLaedt(false);
      })
      .catch((ursache: unknown) => {
        if (!aktiv) {
          return;
        }
        const text = behandleFehler(ursache, onSitzungAbgelaufen);
        setLadeFehler(
          istApiFehler(ursache) && ursache.code === "not_found"
            ? "Dieser Song oder sein Dokument ist nicht sichtbar."
            : (text ?? fehlerText(ursache)),
        );
        setLaedt(false);
      });
    return () => {
      aktiv = false;
    };
  }, [adapter, bandId, neuLaden, onSitzungAbgelaufen, songId]);

  useEffect(() => {
    if (dokument && dokument.active_version_id === versionId) {
      setAktiveVersionHinweis(null);
    }
  }, [dokument, versionId]);

  useEffect(() => {
    if (!dokument) {
      return;
    }
    if (versionId !== null && dokument.versions.some((eintrag) => eintrag.id === versionId)) {
      return;
    }
    const ziel = naechsteVersion(dokument, initialVersionId);
    const fehlt =
      initialVersionId !== null &&
      !dokument.versions.some((eintrag) => eintrag.id === initialVersionId) &&
      ziel !== null;
    setVersionHinweis(
      fehlt ? "Diese Version existiert nicht. Es wird eine verfügbare Version angezeigt." : null,
    );
    // Eine bereits gueltige Auswahl bleibt stehen, damit dieser spaete Effekt
    // keinen Klick des Nutzers ueberschreibt.
    setVersionId((vorher) =>
      vorher !== null && dokument.versions.some((eintrag) => eintrag.id === vorher)
        ? vorher
        : ziel,
    );
  }, [dokument, initialVersionId, versionId]);

  useEffect(() => {
    if (versionId === null) {
      setDatei(null);
      setDateiZustand("leer");
      setDateiFehler(null);
      return;
    }
    let aktiv = true;
    setDateiZustand("laedt");
    setDateiFehler(null);
    adapter
      .ladeDatei(bandId, songId, versionId)
      .then((daten) => {
        if (aktiv) {
          setDatei({ versionId, daten });
          setDateiZustand("fertig");
        }
      })
      .catch((ursache: unknown) => {
        if (!aktiv) {
          return;
        }
        const text = behandleFehler(ursache, onSitzungAbgelaufen);
        setDateiFehler(text ?? fehlerText(ursache));
        setDateiZustand("fehler");
      });
    return () => {
      aktiv = false;
    };
  }, [adapter, bandId, onSitzungAbgelaufen, songId, versionId]);

  function wechsleVersion(zielId: number) {
    const weiter = () => setVersionId(zielId);
    if (anmerkungsRef.current) {
      anmerkungsRef.current.pruefeWechsel(weiter);
    } else {
      weiter();
    }
  }

  function aktiviereMitWaechter(zielId: number) {
    const weiter = () => {
      void aktiviere(zielId);
    };
    if (anmerkungsRef.current) {
      anmerkungsRef.current.pruefeWechsel(weiter);
    } else {
      weiter();
    }
  }

  async function aktiviere(zielId: number) {
    if (!dokument) {
      return;
    }
    setBeschaeftigt(true);
    setAktionsFehler(null);
    try {
      const neu = await adapter.aktiviere(bandId, songId, dokument.revision, zielId);
      setDokument(neu);
      setVersionId(zielId);
    } catch (ursache) {
      if (istApiFehler(ursache) && ursache.code === "conflict") {
        setAktionsFehler(
          "Der Stand wurde inzwischen geändert. Bitte die aktive Version erneut wählen.",
        );
        try {
          setDokument(await adapter.lade(bandId, songId));
        } catch {
          setAktionsFehler("Der neue Stand konnte nicht geladen werden. Bitte erneut versuchen.");
        }
      } else {
        setAktionsFehler(behandleFehler(ursache, onSitzungAbgelaufen) ?? fehlerText(ursache));
      }
    } finally {
      setBeschaeftigt(false);
    }
  }

  function hochgeladen(neu: DokumentVersion) {
    setDokument((alt) =>
      alt ? { ...alt, versions: [...alt.versions, neu] } : alt,
    );
  }

  async function herunterladen(version: DokumentVersion) {
    setAktionsFehler(null);
    try {
      const daten = await adapter.ladeDatei(bandId, songId, version.id);
      if (typeof URL.createObjectURL !== "function") {
        setAktionsFehler("Download wird in diesem Browser nicht unterstützt.");
        return;
      }
      const url = URL.createObjectURL(new Blob([daten], { type: "application/pdf" }));
      const anker = document.createElement("a");
      anker.href = url;
      anker.download = dateiname(version.original_name);
      anker.rel = "noopener";
      document.body.appendChild(anker);
      anker.click();
      anker.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (ursache) {
      setAktionsFehler(behandleFehler(ursache, onSitzungAbgelaufen) ?? fehlerText(ursache));
    }
  }

  useEffect(() => { if (dokument?.versions.length === 0) setUploadOffen(true); }, [dokument]);

  const angezeigteVersion =
    dokument?.versions.find((eintrag) => eintrag.id === versionId) ?? null;

  return (
    <section className="dokument" aria-labelledby="dokument-titel">
      <h2 id="dokument-titel">{songTitel ? `${songTitel}: PDF` : "Song-PDF"}</h2>
      {laedt ? <StatusAnzeige zustand="laedt" /> : null}
      {ladeFehler && !laedt ? (
        <FehlerAnzeige
          text={ladeFehler}
          onWiederholen={() => setNeuLaden((wert) => wert + 1)}
        />
      ) : null}
      {dokument && !laedt ? (
        <>
          {dokument.versions.length === 0 ? (
            <p>Für diesen Song ist noch keine PDF hinterlegt.</p>
          ) : null}
          {versionHinweis ? <p role="status">{versionHinweis}</p> : null}
          {aktiveVersionHinweis ? <p role="status">{aktiveVersionHinweis}</p> : null}
          {aktionsFehler ? <p role="alert">{aktionsFehler}</p> : null}
          <details className="dokument-verwaltung"><summary>PDF-Versionen und Download</summary>
          <VersionsListe
            versionen={dokument.versions}
            aktivId={dokument.active_version_id}
            betrachtetId={versionId}
            beschaeftigt={beschaeftigt}
            onAnsehen={wechsleVersion}
            onAktivieren={aktiviereMitWaechter}
            onDownload={herunterladen}
          />
          </details>
          {versionId !== null ? (
            <div className="pdf-anzeige">
              {dateiZustand === "laedt" ? <StatusAnzeige zustand="laedt" /> : null}
              {dateiFehler ? (
                <p role="alert">{dateiFehler}</p>
              ) : null}
              {datei && datei.versionId === versionId && dateiZustand === "fertig" && angezeigteVersion ? (
                <AnmerkungsBereich
                  ref={anmerkungsRef}
                  aktualisierung={aktualisierung}
                  bandId={bandId}
                  songId={songId}
                  versionId={versionId}
                  seiten={angezeigteVersion.page_count}
                  daten={datei.daten}
                  titel={`${angezeigteVersion.original_name}, Version ${angezeigteVersion.number}`}
                  Viewer={Viewer}
                  adapter={anmerkungAdapter}
                  registriereWaechter={registriereWaechter}
                  onSitzungAbgelaufen={onSitzungAbgelaufen}
                />
              ) : null}
            </div>
          ) : null}
          <details open={uploadOffen} onToggle={e => setUploadOffen(e.currentTarget.open)}><summary>PDF hochladen</summary>
          <UploadFormular
            bandId={bandId}
            songId={songId}
            adapter={adapter}
            grenzen={dokument.limits}
            onHochgeladen={hochgeladen}
            onAktivieren={aktiviereMitWaechter}
            onSitzungAbgelaufen={onSitzungAbgelaufen}
          />
          </details>
        </>
      ) : null}
    </section>
  );
}
