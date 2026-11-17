import { useCallback, useEffect, useState } from "react";
import { appName } from "./app-info";
import { ladeKonfiguration } from "./api/config";
import { fehlerText, istApiFehler } from "./api/client";
import { apiBands } from "./bands/bands";
import { useAktiveBand } from "./bands/useAktiveBand";
import { useNavigationsWaechter } from "./useNavigationsWaechter";
import { useBandDaten } from "./bands/useBandDaten";
import { apiAnmerkungen } from "./annotations/annotations";
import { DokumentRoute } from "./documents/DokumentRoute";
import { apiDokumente } from "./documents/documents";
import { apiGigs } from "./gigs/gigs";
import { useBandSync } from "./realtime/useBandSync";
import { VerbindungsStatus } from "./realtime/VerbindungsStatus";
import type { Ereignis } from "./realtime/typen";
import type { SyncDaten } from "./realtime/daten";
import { parseRoute } from "./routing";
import { apiStage } from "./stage/stage";
import { StageRoute } from "./stage/StageRoute";
import type { TextEreignis } from "./collaboration/texte";
import { apiSitzung } from "./session/session";
import { apiSetlists } from "./setlists/setlists";
import { AnmeldeFormular } from "./ui/AnmeldeFormular";
import { AppShell } from "./ui/AppShell";
import { Auftritte } from "./ui/Auftritte";
import { BandFormular } from "./ui/BandFormular";
import { FehlerAnzeige } from "./ui/FehlerAnzeige";
import { Setlists } from "./ui/Setlists";
import { Songs } from "./ui/Songs";
import { StatusAnzeige } from "./ui/StatusAnzeige";

import type {
  AppProps,
  BandsZustand,
  KonfigurationZustand,
  SitzungZustand,
} from "./App.types";

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
  const [versuch, setVersuch] = useState(0);
  const [konfiguration, setKonfiguration] = useState<KonfigurationZustand>({ status: "laedt" });
  const [sitzung, setSitzung] = useState<SitzungZustand>({ status: "laedt" });
  const [bands, setBands] = useState<BandsZustand>({ status: "laedt" });
  const [bandId, setBandId] = useState<string | null>(null);
  const [datenVersion, setDatenVersion] = useState(0);
  const [ereignisMarke, setEreignisMarke] = useState(0);
  const [dokumentMarke, setDokumentMarke] = useState(0);
  const [setlistMarke, setSetlistMarke] = useState(0);
  const [textEreignisse, setTextEreignisse] = useState<
    Record<string, TextEreignis>
  >({});
  const [stageMarke, setStageMarke] = useState(0);
  const [syncMarke, setSyncMarke] = useState(0);
  const [stageAntwort, setStageAntwort] = useState<Record<string, unknown> | null>(null);
  const [buehnenFehler, setBuehnenFehler] = useState<string | null>(null);
  const [syncStand, setSyncStand] = useState<SyncDaten | null>(null);
  const { navigiere, registriereWaechter, mitWaechter, istGeschuetzt } =
    useNavigationsWaechter((ziel) => {
      window.history.pushState({}, "", ziel);
      setPfad(ziel);
    });
  const route = parseRoute(pfad);

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

  useEffect(() => {
    let aktiv = true;
    setKonfiguration({ status: "laedt" });
    konfigurationLaden()
      .then((geladen) => {
        if (aktiv) {
          setKonfiguration({ status: "fertig", konfiguration: geladen });
        }
      })
      .catch((fehler: unknown) => {
        if (aktiv) {
          setKonfiguration({ status: "fehler", fehler: fehlerText(fehler) });
        }
      });
    return () => {
      aktiv = false;
    };
  }, [konfigurationLaden, versuch]);

  useEffect(() => {
    if (konfiguration.status !== "fertig") {
      return;
    }
    let aktiv = true;
    setSitzung({ status: "laedt" });
    setBands({ status: "laedt" });
    setBandId(null);
    sessionAdapter
      .ladeSitzung()
      .then((geladen) => {
        if (!aktiv) {
          return;
        }
        if (!geladen.angemeldet) {
          setSitzung({ status: "anonym" });
          return;
        }
        setSitzung({ status: "angemeldet", benutzername: geladen.benutzername ?? "" });
        bandAdapter
          .ladeBands()
          .then((liste) => {
            if (!aktiv) {
              return;
            }
            setBands({ status: "fertig", bands: liste });
            setBandId(liste[0]?.id ?? null);
          })
          .catch((fehler: unknown) => {
            if (!aktiv) {
              return;
            }
            if (istApiFehler(fehler) && fehler.code === "unauthenticated") {
              setSitzung({ status: "anonym" });
              return;
            }
            setBands({ status: "fehler", fehler: fehlerText(fehler) });
          });
      })
      .catch((fehler: unknown) => {
        if (aktiv) {
          setSitzung({ status: "fehler", fehler: fehlerText(fehler) });
        }
      });
    return () => {
      aktiv = false;
    };
  }, [bandAdapter, konfiguration.status, sessionAdapter, versuch]);

  const aktiveBands = bands.status === "fertig" ? bands.bands : null;
  const { direktFehler, bandWechseln } = useAktiveBand(aktiveBands, route, bandId, setBandId, navigiere);

  const bandDaten = useBandDaten(bandAdapter, bandId, datenVersion);

  const beiEchtzeitEreignis = useCallback((ereignis: Ereignis) => {
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
      const objectUuid = String(ereignis.data.object_uuid ?? "");
      const field = String(ereignis.data.field ?? "");
      setTextEreignisse((vorher) => ({
        ...vorher,
        [`${objectUuid}:${field}`]: {
          object_uuid: objectUuid,
          field,
          update: String(ereignis.data.update ?? ""),
          epoch: Number(ereignis.data.epoch ?? 0),
          revision: Number(ereignis.data.revision ?? 0),
          setlist_revision: Number(ereignis.data.setlist_revision ?? 0) || undefined,
        },
      }));
    }
  }, []);

  const beiAbgleich = useCallback((daten: unknown) => {
    const stand = daten as SyncDaten | undefined;
    if (!stand || !stand.band) {
      return;
    }
    setSyncStand(stand);
    setSyncMarke((wert) => wert + 1);
    if (stand.stage) {
      setStageMarke((wert) => wert + 1);
    }
    setEreignisMarke((wert) => wert + 1);
    setDokumentMarke((wert) => wert + 1);
    setSetlistMarke((wert) => wert + 1);
  }, []);

  const beiBuehnenAntwort = useCallback((nachricht: Record<string, unknown>) => {
    if (nachricht.type === "stage.result") {
      setStageAntwort(nachricht);
    }
  }, []);

  const echtzeit = useBandSync(
    bandDaten.status === "fertig" ? bandDaten.daten.bandId : null,
    beiEchtzeitEreignis,
    beiAbgleich,
    () => setSitzung({ status: "anonym" }),
    sitzung.status === "angemeldet",
    beiBuehnenAntwort,
  );

  useEffect(() => {
    setSyncStand(null);
  }, [bandId]);

  useEffect(() => {
    if (bandDaten.status === "fehler" && bandDaten.code === "unauthenticated") {
      setSitzung({ status: "anonym" });
    }
  }, [bandDaten]);

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

  function erneutVersuchen() {
    setVersuch((wert) => wert + 1);
  }

  const sitzungAbgelaufen = useCallback(() => setSitzung({ status: "anonym" }), []);

  async function anmelden(benutzer: string, passwort: string) {
    await sessionAdapter.anmelden(benutzer, passwort);
    erneutVersuchen();
  }

  async function abmelden() {
    try {
      await sessionAdapter.abmelden();
    } catch (ursache) {
      setSitzung({ status: "fehler", fehler: fehlerText(ursache) });
      return;
    }
    erneutVersuchen();
  }

  async function buehneOeffnen(setlistId: number) {
    const bandIdJetzt = bandDaten.status === "fertig" ? bandDaten.daten.bandId : null;
    if (!bandIdJetzt || !echtzeit.verbindungId) {
      setBuehnenFehler("Die Verbindung ist noch nicht bereit. Bitte kurz warten.");
      return;
    }
    setBuehnenFehler(null);
    try {
      const sitzung = await apiStage.start(
        bandIdJetzt,
        setlistId,
        echtzeit.verbindungId,
      );
      navigiere(`/stage/${encodeURIComponent(bandIdJetzt)}/${sitzung.id}`);
    } catch (ursache) {
      if (istApiFehler(ursache) && ursache.code === "conflict") {
        try {
          const aktiv = await apiStage.aktive(bandIdJetzt, echtzeit.verbindungId);
          if (aktiv) {
            navigiere(`/stage/${encodeURIComponent(bandIdJetzt)}/${aktiv.id}`);
            return;
          }
        } catch {
          // unten als sichtbarer Fehler
        }
      }
      setBuehnenFehler(fehlerText(ursache));
    }
  }

  async function bandAnlegen(name: string) {
    const band = await bandAdapter.erstelleBand(name);
    const liste = await bandAdapter.ladeBands();
    setBands({ status: "fertig", bands: liste });
    setBandId(band.id);
  }

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
    const gewaehlteBand = bands.bands.find((band) => band.id === bandId);
    inhalt = (
      <>
        <label className="bandwechsel">
          Band
          <select
            value={bandId ?? ""}
            onChange={(ereignis) => bandWechseln(ereignis.target.value)}
          >
            {bandId === null ? <option value="">Keine Band</option> : null}
            {bands.bands.map((band) => (
              <option key={band.id} value={band.id}>
                {band.name}
              </option>
            ))}
          </select>
        </label>
        {kontoZeile}
        {direktFehler ? <FehlerAnzeige text={direktFehler} /> : null}
        {buehnenFehler ? <FehlerAnzeige text={buehnenFehler} /> : null}
        {bandDaten.status === "laedt" ? <StatusAnzeige zustand="laedt" /> : null}
        {bandDaten.status === "fehler" ? (
          <FehlerAnzeige text={bandDaten.fehler} onWiederholen={erneutVersuchen} />
        ) : null}
        {bandDaten.status === "fertig" ? (
          <section aria-labelledby="band-titel">
            <h1 id="band-titel">{gewaehlteBand?.name}</h1>
            <p className="band-id" data-band-id={bandDaten.daten.bandId}>
              Bereich {pfad}
            </p>
            <VerbindungsStatus
              zustand={echtzeit.zustand}
              onErneutVersuchen={echtzeit.erneutVersuchen}
            />
            {route.bereich === "stage" ? (
              <StageRoute
                bandId={bandDaten.daten.bandId}
                sessionId={route.stageSessionId ?? null}
                verbindungId={echtzeit.verbindungId}
                verbunden={
                  echtzeit.zustand !== "unterbrochen" &&
                  echtzeit.zustand !== "abgleich-fehlgeschlagen"
                }
                sende={echtzeit.sende}
                antwort={stageAntwort}
                stageMarke={stageMarke}
                anmerkungsMarke={dokumentMarke}
                onNavigieren={navigiere}
                onSitzungAbgelaufen={sitzungAbgelaufen}
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
                verbunden={
                  echtzeit.zustand !== "unterbrochen" &&
                  echtzeit.zustand !== "abgleich-fehlgeschlagen"
                }
                syncMarke={syncMarke}
                textEreignisse={textEreignisse}
                onBuehneOeffnen={buehneOeffnen}
                onSitzungAbgelaufen={sitzungAbgelaufen}
              />
            ) : route.bereich === "gigs" ? (
              <Auftritte
                key={bandDaten.daten.bandId}
                bandId={bandDaten.daten.bandId}
                adapter={gigAdapter}
                setlistAdapter={setlistAdapter}
                aktualisierung={ereignisMarke}
                vorgabe={syncPasst && syncStand ? syncStand.gigs : null}
                onNavigieren={navigiere}
                onBuehneOeffnen={buehneOeffnen}
                onSitzungAbgelaufen={sitzungAbgelaufen}
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
                onSitzungAbgelaufen={sitzungAbgelaufen}
              />
            ) : (
              <Songs
                key={bandDaten.daten.bandId}
                bandId={bandDaten.daten.bandId}
                adapter={bandAdapter}
                songs={songsFuerListe}
                onNavigieren={navigiere}
                onGeaendert={() => {
                  setSyncStand(null);
                  setDatenVersion((wert) => wert + 1);
                }}
                onSitzungAbgelaufen={sitzungAbgelaufen}
              />
            )}
          </section>
        ) : null}
      </>
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
