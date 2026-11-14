import { useEffect, useState } from "react";
import { appName } from "./app-info";
import { ladeKonfiguration, type LaufzeitKonfiguration } from "./api/config";
import { fehlerText, istApiFehler } from "./api/client";
import { apiBands, type Band, type BandAdapter } from "./bands/bands";
import { useBandDaten } from "./bands/useBandDaten";
import { apiSitzung, type SessionAdapter } from "./session/session";
import { AppShell } from "./ui/AppShell";
import { FehlerAnzeige } from "./ui/FehlerAnzeige";
import { StatusAnzeige } from "./ui/StatusAnzeige";

interface AppProps {
  konfigurationLaden?: () => Promise<LaufzeitKonfiguration>;
  sessionAdapter?: SessionAdapter;
  bandAdapter?: BandAdapter;
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
}: AppProps) {
  const [pfad, setPfad] = useState(() => window.location.pathname);
  const [versuch, setVersuch] = useState(0);
  const [konfiguration, setKonfiguration] = useState<KonfigurationZustand>({ status: "laedt" });
  const [sitzung, setSitzung] = useState<SitzungZustand>({ status: "laedt" });
  const [bands, setBands] = useState<BandsZustand>({ status: "laedt" });
  const [bandId, setBandId] = useState<string | null>(null);

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

  const bandDaten = useBandDaten(bandAdapter, bandId);

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
    inhalt = (
      <section className="anmeldung" aria-labelledby="anmeldung-titel">
        <h1 id="anmeldung-titel">Anmeldung erforderlich</h1>
        <p>Bitte melde dich am Core an. Konten vergibt der Betreiber oder eine Einladung.</p>
      </section>
    );
  } else if (bands.status === "laedt") {
    inhalt = <StatusAnzeige zustand="laedt" />;
  } else if (bands.status === "fehler") {
    inhalt = <FehlerAnzeige text={bands.fehler} onWiederholen={erneutVersuchen} />;
  } else if (bands.bands.length === 0) {
    inhalt = <p>Keine Band vorhanden. Eine Einladung oder ein neues Konto schafft Zugang.</p>;
  } else {
    const gewaehlteBand = bands.bands.find((band) => band.id === bandId);
    inhalt = (
      <>
        <label className="bandwechsel">
          Band
          <select
            value={bandId ?? ""}
            onChange={(ereignis) => setBandId(ereignis.target.value)}
          >
            {bands.bands.map((band) => (
              <option key={band.id} value={band.id}>
                {band.name}
              </option>
            ))}
          </select>
        </label>
        <p className="konto">Angemeldet als {sitzung.benutzername}</p>
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
            {bandDaten.daten.songs.length === 0 ? (
              <p>Keine Songs in dieser Band.</p>
            ) : (
              <ul>
                {bandDaten.daten.songs.map((song) => (
                  <li key={song}>{song}</li>
                ))}
              </ul>
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
