import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { fehlerText, istApiFehler } from "../api/client";
import type { LaufzeitKonfiguration } from "../api/config";
import type { BandAdapter } from "../bands/bands";
import type { SessionAdapter } from "../session/session";
import type { BandsZustand, KonfigurationZustand, SitzungZustand } from "../App.types";

export class BandListenAbgleichFehler extends Error {
  readonly bandId: string;
  readonly bandName: string;
  readonly ursache: unknown;
  readonly wiederholen: () => Promise<void>;

  constructor(
    bandId: string,
    bandName: string,
    ursache: unknown,
    wiederholen: () => Promise<void>,
  ) {
    super("Bandliste konnte nicht geladen werden.");
    this.bandId = bandId;
    this.bandName = bandName;
    this.ursache = ursache;
    this.wiederholen = wiederholen;
  }
}

export function useAppStart(
  konfigurationLaden: () => Promise<LaufzeitKonfiguration>,
  sessionAdapter: SessionAdapter,
  bandAdapter: BandAdapter,
) {
  const [versuch, setVersuch] = useState(0);
  const [konfiguration, setKonfiguration] = useState<KonfigurationZustand>({ status: "laedt" });
  const [sitzung, setSitzung] = useState<SitzungZustand>({ status: "laedt" });
  const [bands, setBands] = useState<BandsZustand>({ status: "laedt" });
  const [bandId, setBandIdRoh] = useState<string | null>(null);
  const sitzungLauf = useRef(0);
  const bandListenLauf = useRef(0);
  const ausstehendesZiel = useRef<
    { bandId: string | null; erlaubt?: () => boolean } | undefined
  >(undefined);

  const setBandId = useCallback((wert: SetStateAction<string | null>) => {
    ausstehendesZiel.current = undefined;
    setBandIdRoh(wert);
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
    const sitzungNr = ++sitzungLauf.current;
    ausstehendesZiel.current = undefined;
    setSitzung({ status: "laedt" });
    setBands({ status: "laedt" });
    setBandIdRoh(null);
    sessionAdapter
      .ladeSitzung()
      .then((geladen) => {
        if (!aktiv || sitzungNr !== sitzungLauf.current) {
          return;
        }
        if (!geladen.angemeldet) {
          setSitzung({ status: "anonym" });
          return;
        }
        setSitzung({ status: "angemeldet", benutzername: geladen.benutzername ?? "" });
        const lauf = ++bandListenLauf.current;
        bandAdapter
          .ladeBands()
          .then((liste) => {
            if (!aktiv || lauf !== bandListenLauf.current) {
              return;
            }
            setBands({ status: "fertig", bands: liste });
            const ziel = ausstehendesZiel.current;
            ausstehendesZiel.current = undefined;
            if (ziel !== undefined && (!ziel.erlaubt || ziel.erlaubt())) {
              const vorhanden =
                ziel.bandId !== null && liste.some((band) => band.id === ziel.bandId);
              setBandIdRoh(vorhanden ? ziel.bandId : (liste[0]?.id ?? null));
            } else {
              setBandIdRoh((aktuell) => aktuell ?? (liste[0]?.id ?? null));
            }
          })
          .catch((fehler: unknown) => {
            if (!aktiv || lauf !== bandListenLauf.current) {
              return;
            }
            if (istApiFehler(fehler) && fehler.code === "unauthenticated") {
              sitzungLauf.current += 1;
              setSitzung({ status: "anonym" });
              return;
            }
            setBands({ status: "fehler", fehler: fehlerText(fehler) });
          });
      })
      .catch((fehler: unknown) => {
        if (aktiv && sitzungNr === sitzungLauf.current) {
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

  const sitzungAbgelaufen = useCallback(() => {
    sitzungLauf.current += 1;
    bandListenLauf.current += 1;
    ausstehendesZiel.current = undefined;
    setSitzung({ status: "anonym" });
  }, []);

  const bandsNeuLaden = useCallback(
    async (zielBandId?: string | null, darfAuswaehlen?: () => boolean) => {
      if (zielBandId !== undefined) {
        ausstehendesZiel.current = { bandId: zielBandId, erlaubt: darfAuswaehlen };
      }
      const lauf = ++bandListenLauf.current;
      const liste = await bandAdapter.ladeBands();
      if (lauf !== bandListenLauf.current) {
        return { liste, angewendet: false };
      }
      setBands({ status: "fertig", bands: liste });
      const ziel = ausstehendesZiel.current;
      if (ziel !== undefined) {
        ausstehendesZiel.current = undefined;
        if (!ziel.erlaubt || ziel.erlaubt()) {
          const vorhanden =
            ziel.bandId !== null && liste.some((band) => band.id === ziel.bandId);
          setBandIdRoh(vorhanden ? ziel.bandId : (liste[0]?.id ?? null));
        }
      }
      return { liste, angewendet: true };
    },
    [bandAdapter],
  );

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

  async function einladungAngenommen(
    neueBandId: string,
    darfAuswaehlen?: () => boolean,
  ) {
    const sitzungNr = ++sitzungLauf.current;
    const geladen = await sessionAdapter.ladeSitzung();
    if (sitzungNr !== sitzungLauf.current) {
      return;
    }
    if (geladen.angemeldet) {
      setSitzung({ status: "angemeldet", benutzername: geladen.benutzername ?? "" });
    }
    await bandsNeuLaden(
      !darfAuswaehlen || darfAuswaehlen() ? neueBandId : undefined,
      darfAuswaehlen,
    );
  }

  async function bandAnlegen(name: string) {
    const band = await bandAdapter.erstelleBand(name);
    const nachladen = async () => {
      try {
        await bandsNeuLaden(band.id);
      } catch (ursache) {
        throw new BandListenAbgleichFehler(band.id, band.name, ursache, nachladen);
      }
    };
    await nachladen();
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
    bandsNeuLaden,
    einladungAngenommen,
  };
}
