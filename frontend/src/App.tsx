import { useCallback, useEffect, useRef, useState } from "react";
import { appName } from "./app-info";
import { ladeKonfiguration } from "./api/config";
import { apiBands } from "./bands/bands";
import { apiBandVerwaltung } from "./bands/verwaltung";
import { useAktiveBand } from "./bands/useAktiveBand";
import { useAppStart } from "./app/useAppStart";
import { useBandEreignisse } from "./app/useBandEreignisse";
import { useBandRechte } from "./bands/useBandRechte";
import { startInhalt } from "./app/startInhalt";
import { useBuehnenEinstieg } from "./app/useBuehnenEinstieg";
import { useZurueckNavigation } from "./app/useZurueckNavigation";
import { useNavigationsWaechter } from "./useNavigationsWaechter";
import { useBandDaten } from "./bands/useBandDaten";
import { apiAnmerkungen } from "./annotations/annotations";
import { apiDokumente } from "./documents/documents";
import { apiGigs } from "./gigs/gigs";
import { useBandSync } from "./realtime/useBandSync";
import type { SyncDaten } from "./realtime/daten";
import { parseRoute } from "./routing";
import { apiSitzung } from "./session/session";
import { apiSetlists } from "./setlists/setlists";
import { useTextEreignisse } from "./collaboration/useTextEreignisse";
import { AppShell } from "./ui/AppShell";
import { BandBereich } from "./ui/BandBereich";
import { KontoZeile } from "./ui/KontoZeile";
import type { AppProps } from "./App.types";

export function App({
  konfigurationLaden = ladeKonfiguration,
  sessionAdapter = apiSitzung,
  bandAdapter = apiBands,
  verwaltungAdapter = apiBandVerwaltung,
  setlistAdapter = apiSetlists,
  gigAdapter = apiGigs,
  dokumentAdapter = apiDokumente,
  anmerkungAdapter = apiAnmerkungen,
  dokumentViewer,
}: AppProps) {
  const [pfad, setPfad] = useState(() => window.location.pathname);
  const pfadRef = useRef(pfad);
  pfadRef.current = pfad;
  const [datenVersion, setDatenVersion] = useState(0);
  const [ereignisMarke, setEreignisMarke] = useState(0);
  const [bandMarke, setBandMarke] = useState(0);
  const [dokumentMarke, setDokumentMarke] = useState(0);
  const [setlistMarke, setSetlistMarke] = useState(0);
  const [stageMarke, setStageMarke] = useState(0);
  const [syncMarke, setSyncMarke] = useState(0);
  const [stageAntwort, setStageAntwort] = useState<Record<string, unknown> | null>(null);
  const [syncStand, setSyncStand] = useState<SyncDaten | null>(null);
  const {
    textEreignisse,
    verlust: textEreignisVerlust,
    textEreignisSpeichern,
    leeren: textEreignisseLeeren,
  } = useTextEreignisse();
  const { navigiere, registriereWaechter, mitWaechter, istGeschuetzt } =
    useNavigationsWaechter((ziel) => {
      window.history.pushState({}, "", ziel);
      setPfad(ziel);
    });
  const route = parseRoute(pfad);
  const {
    konfiguration,
    sitzung,
    bands,
    bandId,
    setBandId,
    erneutVersuchen,
    sitzungAbgelaufen,
    anmelden,
    abmelden,
    bandAnlegen,
    bandsNeuLaden,
    einladungAngenommen,
  } = useAppStart(konfigurationLaden, sessionAdapter, bandAdapter);

  useZurueckNavigation(pfad, setPfad, istGeschuetzt, mitWaechter);

  const bandDaten = useBandDaten(bandAdapter, bandId, datenVersion);
  const aktuelleBandId =
    bandDaten.status === "fertig" ? bandDaten.daten.bandId : bandId;

  const {
    sichtbareBands,
    bandListenFehler,
    setBandListenFehler,
    bandEntsperren,
    alleBandsEntsperren,
    bandListenFehlerMelden,
    beiRechtVerlust,
    bandVerlassen,
  } = useBandRechte({
    bands: bands.status === "fertig" ? bands.bands : null,
    aktuelleBandId,
    setBandId,
    bandsNeuLaden,
    sitzungAbgelaufen,
    textEreignisseLeeren,
    setSyncStand,
    setDatenVersion,
  });

  const bandListenFehlerLoeschen = useCallback(() => {
    setBandListenFehler(null);
  }, [setBandListenFehler]);

  const { direktFehler, bandWechseln } = useAktiveBand(
    sichtbareBands,
    route,
    bandId,
    setBandId,
    navigiere,
  );

  const { beiEchtzeitEreignis, beiAbgleich } = useBandEreignisse({
    bandsNeuLaden,
    bandListenFehlerMelden,
    bandListenFehlerLoeschen,
    textEreignisSpeichern,
    textEreignisseLeeren,
    setStageMarke,
    setSyncStand,
    setDatenVersion,
    setEreignisMarke,
    setDokumentMarke,
    setSetlistMarke,
    setBandMarke,
    setSyncMarke,
  });

  const beiBuehnenAntwort = useCallback((nachricht: Record<string, unknown>) => {
    if (nachricht.type === "stage.result") {
      setStageAntwort(nachricht);
    }
  }, []);

  const echtzeit = useBandSync(
    bandDaten.status === "fertig" ? bandDaten.daten.bandId : null,
    beiEchtzeitEreignis,
    beiAbgleich,
    sitzungAbgelaufen,
    sitzung.status === "angemeldet",
    beiBuehnenAntwort,
    beiRechtVerlust,
  );

  useEffect(() => {
    setSyncStand(null);
    if (bandId !== null) {
      setBandListenFehler(null);
    }
    textEreignisseLeeren();
  }, [bandId, setBandListenFehler, textEreignisseLeeren]);

  useEffect(() => {
    if (textEreignisVerlust === 0) {
      return;
    }
    // Ein verworfener Textstand wird über den Serverstand nachgeladen.
    setSyncMarke((wert) => wert + 1);
    setSetlistMarke((wert) => wert + 1);
  }, [textEreignisVerlust]);

  useEffect(() => {
    if (bandDaten.status === "fehler" && bandDaten.code === "unauthenticated") {
      sitzungAbgelaufen();
    }
  }, [bandDaten, sitzungAbgelaufen]);

  const syncPasst =
    bandDaten.status === "fertig" &&
    syncStand !== null &&
    String(syncStand.band.id) === bandDaten.daten.bandId;
  const songsFuerListe =
    syncPasst && syncStand
      ? syncStand.songs
      : bandDaten.status === "fertig"
        ? bandDaten.daten.songs
        : [];

  const titel =
    konfiguration.status === "fertig" ? konfiguration.konfiguration.instanceName : appName;

  const { buehnenFehler, buehneOeffnen } = useBuehnenEinstieg(
    bandDaten,
    echtzeit.verbindungId,
    navigiere,
  );

  const kontoZeile = (
    <KontoZeile
      benutzername={sitzung.status === "angemeldet" ? sitzung.benutzername : ""}
      onAbmelden={abmelden}
    />
  );

  const start = startInhalt({
    konfiguration,
    sitzung,
    bands,
    sichtbareBands,
    route,
    verwaltungAdapter,
    sitzungAbgelaufen,
    einladungAngenommen: async (neueBandId, quellPfad) => {
      bandEntsperren(neueBandId);
      const nochAufEinladung = () => pfadRef.current === quellPfad;
      await einladungAngenommen(neueBandId, nochAufEinladung);
      if (nochAufEinladung()) {
        navigiere("/");
      }
    },
    // Instanz-Einladung: nach der Kontoanlage neu laden, damit die Sitzung
    // frisch gelesen wird und die Band-Erstellung erscheint.
    beitrittFertig: () => window.location.assign("/"),
    pfad,
    kontoZeile,
    direktFehler,
    bandListenFehler,
    erneutVersuchen,
    alleBandsEntsperren,
    setBandListenFehler,
    bandAnlegen,
    anmelden,
  });

  const inhalt = start ?? (
    <BandBereich
      pfad={pfad}
      route={route}
      bands={
        sichtbareBands ?? (bands.status === "fertig" ? bands.bands : [])
      }
      bandId={bandId}
      bandDaten={bandDaten}
      direktFehler={bandListenFehler ?? direktFehler}
      buehnenFehler={buehnenFehler}
      kontoZeile={kontoZeile}
      bandAdapter={bandAdapter}
      verwaltungAdapter={verwaltungAdapter}
      registriereWaechter={registriereWaechter}
      echtzeit={echtzeit}
      songsFuerListe={songsFuerListe}
      syncPasst={syncPasst}
      syncStand={syncStand}
      setlistAdapter={setlistAdapter}
      gigAdapter={gigAdapter}
      dokumentAdapter={dokumentAdapter}
      anmerkungAdapter={anmerkungAdapter}
      dokumentViewer={dokumentViewer}
      setlistMarke={setlistMarke}
      ereignisMarke={ereignisMarke}
      bandMarke={bandMarke}
      dokumentMarke={dokumentMarke}
      syncMarke={syncMarke}
      stageMarke={stageMarke}
      stageAntwort={stageAntwort}
      textEreignisse={textEreignisse}
      onBandWechseln={(wert) => {
        setBandListenFehler(null);
        bandWechseln(wert);
      }}
      onErneutVersuchen={erneutVersuchen}
      onSitzungAbgelaufen={sitzungAbgelaufen}
      onNavigieren={navigiere}
      onBuehneOeffnen={buehneOeffnen}
      onBandGeaendert={async () => {
        setSyncStand(null);
        setDatenVersion((wert) => wert + 1);
        setBandMarke((wert) => wert + 1);
        try {
          const { angewendet } = await bandsNeuLaden();
          if (angewendet) {
            setBandListenFehler(null);
          }
        } catch (fehler: unknown) {
          bandListenFehlerMelden(fehler);
        }
      }}
      onBandVerlassen={(verlasseneId) =>
        bandVerlassen(verlasseneId, () => navigiere("/"))
      }
      onBandAngelegt={bandAnlegen}
      onSongsGeaendert={() => {
        setSyncStand(null);
        setDatenVersion((wert) => wert + 1);
      }}
    />
  );

  return (
    <AppShell
      titel={titel}
      pfad={pfad}
      communityUrl={
        konfiguration.status === "fertig" ? konfiguration.konfiguration.communityUrl : null
      }
      buehne={route.bereich === "stage"}
      onNavigieren={navigiere}
    >
      {inhalt}
    </AppShell>
  );
}
