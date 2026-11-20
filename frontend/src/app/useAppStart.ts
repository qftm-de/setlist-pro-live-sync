import { useCallback, useEffect, useState } from "react";
import { fehlerText, istApiFehler } from "../api/client";
import type { LaufzeitKonfiguration } from "../api/config";
import type { BandAdapter } from "../bands/bands";
import type { SessionAdapter } from "../session/session";
import type { BandsZustand, KonfigurationZustand, SitzungZustand } from "../App.types";

export function useAppStart(
  konfigurationLaden: () => Promise<LaufzeitKonfiguration>,
  sessionAdapter: SessionAdapter,
  bandAdapter: BandAdapter,
) {
  const [versuch, setVersuch] = useState(0);
  const [konfiguration, setKonfiguration] = useState<KonfigurationZustand>({ status: "laedt" });
  const [sitzung, setSitzung] = useState<SitzungZustand>({ status: "laedt" });
  const [bands, setBands] = useState<BandsZustand>({ status: "laedt" });
  const [bandId, setBandId] = useState<string | null>(null);

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

  return {
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
  };
}
