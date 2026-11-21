import { Startseite } from "./Startseite";
import type { ComponentType, ReactNode } from "react";
import type { Band, BandAdapter, Song } from "../bands/bands";
import type { BandDatenZustand } from "../bands/useBandDaten";
import type { AnmerkungAdapter } from "../annotations/annotations";
import type { DokumentAdapter } from "../documents/documents";
import type { PdfViewerProps } from "../documents/PdfViewer";
import type { GigAdapter } from "../gigs/gigs";
import type { BandSyncZustand } from "../realtime/useBandSync";
import type { SyncDaten } from "../realtime/daten";
import type { AppRoute } from "../routing";
import type { NavigationsWaechter } from "../useNavigationsWaechter";
import type { SetlistAdapter } from "../setlists/setlists";
import type { TextEreignis } from "../collaboration/texte";
import { DokumentRoute } from "../documents/DokumentRoute";
import { ExportKnopf } from "../export/ExportKnopf";
import { StageRoute } from "../stage/StageRoute";
import { VerbindungsStatus } from "../realtime/VerbindungsStatus";
import { Auftritte } from "./Auftritte";
import { FehlerAnzeige } from "./FehlerAnzeige";
import { Setlists } from "./Setlists";
import { Songs } from "./Songs";
import { StatusAnzeige } from "./StatusAnzeige";

type BandDatenZustandOderLeer =
  | BandDatenZustand
  | { bandId: null; status: "leer" };

export interface BandBereichProps {
  pfad: string;
  route: AppRoute;
  bands: Band[];
  bandId: string | null;
  bandDaten: BandDatenZustandOderLeer;
  direktFehler: string | null;
  buehnenFehler: string | null;
  kontoZeile: ReactNode;
  bandAdapter: BandAdapter;
  registriereWaechter: (waechter: NavigationsWaechter | null) => void;
  echtzeit: BandSyncZustand;
  songsFuerListe: Song[];
  syncPasst: boolean;
  syncStand: SyncDaten | null;
  setlistAdapter: SetlistAdapter;
  gigAdapter: GigAdapter;
  dokumentAdapter: DokumentAdapter;
  anmerkungAdapter: AnmerkungAdapter;
  dokumentViewer?: ComponentType<PdfViewerProps>;
  setlistMarke: number;
  ereignisMarke: number;
  dokumentMarke: number;
  syncMarke: number;
  stageMarke: number;
  stageAntwort: Record<string, unknown> | null;
  textEreignisse: Record<string, TextEreignis>;
  onBandWechseln: (wert: string) => void;
  onErneutVersuchen: () => void;
  onSitzungAbgelaufen: () => void;
  onNavigieren: (pfad: string) => void;
  onBuehneOeffnen: (setlistId: number) => void;
  onSongsGeaendert: () => void;
}

export function BandBereich({
  pfad,
  route,
  bands,
  bandId,
  bandDaten,
  direktFehler,
  buehnenFehler,
  kontoZeile,
  bandAdapter,
  registriereWaechter,
  echtzeit,
  songsFuerListe,
  syncPasst,
  syncStand,
  setlistAdapter,
  gigAdapter,
  dokumentAdapter,
  anmerkungAdapter,
  dokumentViewer,
  setlistMarke,
  ereignisMarke,
  dokumentMarke,
  syncMarke,
  stageMarke,
  stageAntwort,
  textEreignisse,
  onBandWechseln,
  onErneutVersuchen,
  onSitzungAbgelaufen,
  onNavigieren,
  onBuehneOeffnen,
  onSongsGeaendert,
}: BandBereichProps) {
  const gewaehlteBand = bands.find((band) => band.id === bandId);
  const verbunden =
    echtzeit.zustand !== "unterbrochen" &&
    echtzeit.zustand !== "abgleich-fehlgeschlagen";

  return (
    <>
      <details className="band-menue"><summary>Band und Konto</summary><div className="band-kopf">
        <label className="bandwechsel">
          Band
          <select
            value={bandId ?? ""}
            onChange={(ereignis) => onBandWechseln(ereignis.target.value)}
          >
            {bandId === null ? <option value="">Keine Band</option> : null}
            {bands.map((band) => (
              <option key={band.id} value={band.id}>
                {band.name}
              </option>
            ))}
          </select>
        </label>
        {kontoZeile}
        {bandDaten.status === "fertig" ? (
            <ExportKnopf
              key={bandDaten.daten.bandId}
              bandId={bandDaten.daten.bandId}
              onSitzungAbgelaufen={onSitzungAbgelaufen}
            />
        ) : null}
      </div></details>
      {direktFehler ? <FehlerAnzeige text={direktFehler} /> : null}
      {buehnenFehler ? <FehlerAnzeige text={buehnenFehler} /> : null}
      {bandDaten.status === "laedt" ? <StatusAnzeige zustand="laedt" /> : null}
      {bandDaten.status === "fehler" ? (
        <FehlerAnzeige text={bandDaten.fehler} onWiederholen={onErneutVersuchen} />
      ) : null}
      {bandDaten.status === "fertig" ? (
        <section aria-labelledby="band-titel">
          <div className="band-kopf">
            <h1 id="band-titel">{gewaehlteBand?.name}</h1>
            <VerbindungsStatus
              zustand={echtzeit.zustand}
              onErneutVersuchen={echtzeit.erneutVersuchen}
            />
          </div>
          <p
            className="band-id visuell-verborgen"
            data-band-id={bandDaten.daten.bandId}
          >
            Bereich {pfad}
          </p>
          {route.bereich === "start" ? (
            <Startseite key={bandId} bandId={bandDaten.daten.bandId} adapter={gigAdapter} onNavigieren={onNavigieren} onSitzungAbgelaufen={onSitzungAbgelaufen} />
          ) : route.bereich === "stage" ? (
            <StageRoute
              bandId={bandDaten.daten.bandId}
              sessionId={route.stageSessionId ?? null}
              verbindungId={echtzeit.verbindungId}
              verbunden={verbunden}
              sende={echtzeit.sende}
              antwort={stageAntwort}
              stageMarke={stageMarke}
              anmerkungsMarke={dokumentMarke}
              onNavigieren={onNavigieren}
              onSitzungAbgelaufen={onSitzungAbgelaufen}
            />
          ) : route.bereich === "setlists" ? (
            <Setlists
              key={bandDaten.daten.bandId}
              bandId={bandDaten.daten.bandId}
              songs={songsFuerListe}
              vorgabe={syncPasst && syncStand ? syncStand.setlists : null}
              adapter={setlistAdapter}
              initialSetlistId={route.setlistId}
              aktualisierung={setlistMarke}
              verbunden={verbunden}
              syncMarke={syncMarke}
              textEreignisse={textEreignisse}
              onBuehneOeffnen={onBuehneOeffnen}
              onSitzungAbgelaufen={onSitzungAbgelaufen}
            />
          ) : route.bereich === "gigs" ? (
            <Auftritte
              key={bandDaten.daten.bandId}
              bandId={bandDaten.daten.bandId}
              adapter={gigAdapter}
              setlistAdapter={setlistAdapter}
              aktualisierung={ereignisMarke}
              vorgabe={syncPasst && syncStand ? syncStand.gigs : null}
              onNavigieren={onNavigieren}
              onBuehneOeffnen={onBuehneOeffnen}
              onSitzungAbgelaufen={onSitzungAbgelaufen}
            />
          ) : route.bereich === "document" ? (
            <DokumentRoute
              bandId={bandDaten.daten.bandId}
              songId={route.songId}
              versionId={route.versionId}
              songs={bandDaten.daten.songs}
              adapter={dokumentAdapter}
              anmerkungAdapter={anmerkungAdapter}
              viewer={dokumentViewer}
              aktualisierung={dokumentMarke}
              registriereWaechter={registriereWaechter}
              onSitzungAbgelaufen={onSitzungAbgelaufen}
            />
          ) : (
            <Songs
              key={bandDaten.daten.bandId}
              bandId={bandDaten.daten.bandId}
              adapter={bandAdapter}
              songs={songsFuerListe}
              onNavigieren={onNavigieren}
              onGeaendert={onSongsGeaendert}
              onSitzungAbgelaufen={onSitzungAbgelaufen}
            />
          )}
        </section>
      ) : null}
    </>
  );
}
