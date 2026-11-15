import { useCallback, useEffect, useState } from "react";
import { appName } from "./app-info";
import { ladeKonfiguration, type LaufzeitKonfiguration } from "./api/config";
import { fehlerText, istApiFehler } from "./api/client";
import { apiBands, type Band, type BandAdapter } from "./bands/bands";
import { useAktiveBand } from "./bands/useAktiveBand";
import { useBandDaten } from "./bands/useBandDaten";
import { apiGigs, type GigAdapter } from "./gigs/gigs";
import { parseRoute } from "./routing";
import { apiSitzung, type SessionAdapter } from "./session/session";
import { apiSetlists, type SetlistAdapter } from "./setlists/setlists";
import { AnmeldeFormular } from "./ui/AnmeldeFormular";
import { AppShell } from "./ui/AppShell";
import { Auftritte } from "./ui/Auftritte";
import { BandFormular } from "./ui/BandFormular";
import { FehlerAnzeige } from "./ui/FehlerAnzeige";
import { Setlists } from "./ui/Setlists";
import { Songs } from "./ui/Songs";
import { StatusAnzeige } from "./ui/StatusAnzeige";

interface AppProps {
  konfigurationLaden?: () => Promise<LaufzeitKonfiguration>;
  sessionAdapter?: SessionAdapter;
  bandAdapter?: BandAdapter;
  setlistAdapter?: SetlistAdapter;
  gigAdapter?: GigAdapter;
}

type KonfigurationZustand =
  | { status: "laedt" }
  | { status: "fehler"; fehler: string }
  | { status: "fertig"; konfiguration: LaufzeitKonfiguration };

type SitzungZustand =
  | { status: "laedt" }
  | { status: "fehler"; fehler: string }
  | { status: "anonym" }
  | { status: "angemeldet"; benutzername: string };

type BandsZustand =
  | { status: "laedt" }
  | { status: "fehler"; fehler: string }
  | { status: "fertig"; bands: Band[] };

export function App({
  konfigurationLaden = ladeKonfiguration,
  sessionAdapter = apiSitzung,
  bandAdapter = apiBands,
  setlistAdapter = apiSetlists,
  gigAdapter = apiGigs,
}: AppProps) {
  const [pfad, setPfad] = useState(() => window.location.pathname);
  const [versuch, setVersuch] = useState(0);
  const [konfiguration, setKonfiguration] = useState<KonfigurationZustand>({ status: "laedt" });
  const [sitzung, setSitzung] = useState<SitzungZustand>({ status: "laedt" });
  const [bands, setBands] = useState<BandsZustand>({ status: "laedt" });
  const [bandId, setBandId] = useState<string | null>(null);
  const [datenVersion, setDatenVersion] = useState(0);
  const route = parseRoute(pfad);

  useEffect(() => {
    const beiZurueck = () => setPfad(window.location.pathname);
    window.addEventListener("popstate", beiZurueck);
    return () => window.removeEventListener("popstate", beiZurueck);
  }, []);

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

  useEffect(() => {
    if (bandDaten.status === "fehler" && bandDaten.code === "unauthenticated") {
      setSitzung({ status: "anonym" });
    }
  }, [bandDaten]);

  const titel =
    konfiguration.status === "fertig" ? konfiguration.konfiguration.instanceName : appName;

  function navigiere(ziel: string) {
    window.history.pushState({}, "", ziel);
    setPfad(ziel);
  }

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
            {route.bereich === "setlists" ? (
              <Setlists
                key={bandDaten.daten.bandId}
                bandId={bandDaten.daten.bandId}
                songs={bandDaten.daten.songs}
                adapter={setlistAdapter}
                initialSetlistId={route.setlistId}
                onSitzungAbgelaufen={sitzungAbgelaufen}
              />
            ) : route.bereich === "gigs" ? (
              <Auftritte
                key={bandDaten.daten.bandId}
                bandId={bandDaten.daten.bandId}
                adapter={gigAdapter}
                setlistAdapter={setlistAdapter}
                onNavigieren={navigiere}
                onSitzungAbgelaufen={sitzungAbgelaufen}
              />
            ) : (
              <Songs
                key={bandDaten.daten.bandId}
                bandId={bandDaten.daten.bandId}
                adapter={bandAdapter}
                songs={bandDaten.daten.songs}
                onGeaendert={() => setDatenVersion((wert) => wert + 1)}
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
      onNavigieren={navigiere}
    >
      {inhalt}
    </AppShell>
  );
}
