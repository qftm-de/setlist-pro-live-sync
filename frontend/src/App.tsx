import { useCallback, useEffect, useState } from "react";
import { appName } from "./app-info";
import { ladeKonfiguration } from "./api/config";
import { apiBands } from "./bands/bands";
import { useAktiveBand } from "./bands/useAktiveBand";
import { useAppStart } from "./app/useAppStart";
import { useBuehnenEinstieg } from "./app/useBuehnenEinstieg";
import { useNavigationsWaechter } from "./useNavigationsWaechter";
import { useBandDaten } from "./bands/useBandDaten";
import { apiAnmerkungen } from "./annotations/annotations";
import { apiDokumente } from "./documents/documents";
import { apiGigs } from "./gigs/gigs";
import { useBandSync } from "./realtime/useBandSync";
import type { Ereignis } from "./realtime/typen";
import type { SyncDaten } from "./realtime/daten";
import { parseRoute } from "./routing";
import { apiSitzung } from "./session/session";
import { apiSetlists } from "./setlists/setlists";
import { useTextEreignisse } from "./collaboration/useTextEreignisse";
import { AnmeldeFormular } from "./ui/AnmeldeFormular";
import { AppShell } from "./ui/AppShell";
import { BandBereich } from "./ui/BandBereich";
import { BandFormular } from "./ui/BandFormular";
import { FehlerAnzeige } from "./ui/FehlerAnzeige";
import { StatusAnzeige } from "./ui/StatusAnzeige";
import type { AppProps } from "./App.types";

export function App({
  konfigurationLaden = ladeKonfiguration,
  sessionAdapter = apiSitzung,
  bandAdapter = apiBands,
  setlistAdapter = apiSetlists,
  gigAdapter = apiGigs,
  dokumentAdapter = apiDokumente,
  anmerkungAdapter = apiAnmerkungen,
  dokumentViewer,
}: AppProps) {
  const [pfad, setPfad] = useState(() => window.location.pathname);
  const [datenVersion, setDatenVersion] = useState(0);
  const [ereignisMarke, setEreignisMarke] = useState(0);
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
  } = useAppStart(konfigurationLaden, sessionAdapter, bandAdapter);

  useEffect(() => {
    const beiZurueck = () => {
      const ziel = window.location.pathname;
      let ausgefuehrt = false;
      const geschuetzt = istGeschuetzt();
      mitWaechter(() => {
        ausgefuehrt = true;
        if (window.location.pathname !== ziel) {
          window.history.pushState({}, "", ziel);
        }
        setPfad(ziel);
      });
      if (geschuetzt && !ausgefuehrt) {
        // Bewusster Kompromiss: Der zusätzliche Eintrag hält die URL bis zur
        // Entscheidung stabil. Ein replaceState würde das Ziel verwerfen.
        window.history.pushState({}, "", pfad);
      }
    };
    window.addEventListener("popstate", beiZurueck);
    return () => window.removeEventListener("popstate", beiZurueck);
  }, [istGeschuetzt, mitWaechter, pfad]);

  const aktiveBands = bands.status === "fertig" ? bands.bands : null;
  const { direktFehler, bandWechseln } = useAktiveBand(
    aktiveBands,
    route,
    bandId,
    setBandId,
    navigiere,
  );

  const bandDaten = useBandDaten(bandAdapter, bandId, datenVersion);

  const beiEchtzeitEreignis = useCallback(
    (ereignis: Ereignis) => {
      if (ereignis.event.startsWith("stage.")) {
        setStageMarke((wert) => wert + 1);
        return;
      }
      setSyncStand(null);
      setEreignisMarke((wert) => wert + 1);
      if (ereignis.stream === "band") {
        setDatenVersion((wert) => wert + 1);
      }
      if (
        ereignis.event.startsWith("annotation.") ||
        ereignis.event.startsWith("document.")
      ) {
        setDokumentMarke((wert) => wert + 1);
      }
      if (ereignis.event.startsWith("setlist.")) {
        setSetlistMarke((wert) => wert + 1);
      }
      if (ereignis.event === "text.updated") {
        textEreignisSpeichern(ereignis);
      }
    },
    [textEreignisSpeichern],
  );

  const beiAbgleich = useCallback(
    (daten: unknown) => {
      const stand = daten as SyncDaten | undefined;
      if (!stand || !stand.band) {
        return;
      }
      textEreignisseLeeren();
      setSyncStand(stand);
      setSyncMarke((wert) => wert + 1);
      if (stand.stage) {
        setStageMarke((wert) => wert + 1);
      }
      setEreignisMarke((wert) => wert + 1);
      setDokumentMarke((wert) => wert + 1);
      setSetlistMarke((wert) => wert + 1);
    },
    [textEreignisseLeeren],
  );

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
  );

  useEffect(() => {
    setSyncStand(null);
    textEreignisseLeeren();
  }, [bandId, textEreignisseLeeren]);

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
    <p className="konto">
      Angemeldet als {sitzung.status === "angemeldet" ? sitzung.benutzername : ""}
      <button type="button" className="abmelden" onClick={abmelden}>
        Abmelden
      </button>
    </p>
  );

  let inhalt;

  if (konfiguration.status === "laedt") {
    inhalt = <StatusAnzeige zustand="laedt" />;
  } else if (konfiguration.status === "fehler") {
    inhalt = <FehlerAnzeige text={konfiguration.fehler} onWiederholen={erneutVersuchen} />;
  } else if (sitzung.status === "laedt") {
    inhalt = <StatusAnzeige zustand="laedt" />;
  } else if (sitzung.status === "fehler") {
    inhalt = <FehlerAnzeige text={sitzung.fehler} onWiederholen={erneutVersuchen} />;
  } else if (sitzung.status === "anonym") {
    inhalt = <AnmeldeFormular onAnmelden={anmelden} />;
  } else if (bands.status === "laedt") {
    inhalt = <StatusAnzeige zustand="laedt" />;
  } else if (bands.status === "fehler") {
    inhalt = (
      <>
        {kontoZeile}
        <FehlerAnzeige text={bands.fehler} onWiederholen={erneutVersuchen} />
      </>
    );
  } else if (bands.bands.length === 0) {
    inhalt = (
      <>
        {kontoZeile}
        {direktFehler ? <FehlerAnzeige text={direktFehler} /> : null}
        <p>Noch keine Band. Lege die erste an.</p>
        <BandFormular onAnlegen={bandAnlegen} onSitzungAbgelaufen={sitzungAbgelaufen} />
      </>
    );
  } else {
    inhalt = (
      <BandBereich
        pfad={pfad}
        route={route}
        bands={bands.bands}
        bandId={bandId}
        bandDaten={bandDaten}
        direktFehler={direktFehler}
        buehnenFehler={buehnenFehler}
        kontoZeile={kontoZeile}
        bandAdapter={bandAdapter}
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
        dokumentMarke={dokumentMarke}
        syncMarke={syncMarke}
        stageMarke={stageMarke}
        stageAntwort={stageAntwort}
        textEreignisse={textEreignisse}
        onBandWechseln={bandWechseln}
        onErneutVersuchen={erneutVersuchen}
        onSitzungAbgelaufen={sitzungAbgelaufen}
        onNavigieren={navigiere}
        onBuehneOeffnen={buehneOeffnen}
        onSongsGeaendert={() => {
          setSyncStand(null);
          setDatenVersion((wert) => wert + 1);
        }}
      />
    );
  }

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
