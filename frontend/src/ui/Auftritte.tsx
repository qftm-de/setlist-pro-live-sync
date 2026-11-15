import { useCallback, useEffect, useRef, useState } from "react";
import { behandleFehler } from "../api/client";
import "../gigs/gigs.css";
import type { Gig, GigAdapter, GigEingabe } from "../gigs/gigs";
import { useGigs } from "../gigs/useGigs";
import type { SetlistAdapter, SetlistKurz } from "../setlists/setlists";
import { AuftrittFormular } from "./AuftrittFormular";
import { AuftrittZeile } from "./AuftrittZeile";
import { FehlerAnzeige } from "./FehlerAnzeige";
import { StatusAnzeige } from "./StatusAnzeige";

interface AuftritteProps {
  bandId: string;
  adapter: GigAdapter;
  setlistAdapter: SetlistAdapter;
  onNavigieren: (pfad: string) => void;
  aktualisierung?: number;
  onSitzungAbgelaufen?: () => void;
}

export function Auftritte({
  bandId,
  adapter,
  setlistAdapter,
  onNavigieren,
  aktualisierung = 0,
  onSitzungAbgelaufen,
}: AuftritteProps) {
  const { zustand, abgleichFehler, ladeNeu } = useGigs(
    adapter,
    bandId,
    onSitzungAbgelaufen,
  );
  const [setlists, setSetlists] = useState<SetlistKurz[] | null>(null);
  const [setlistFehler, setSetlistFehler] = useState<string | null>(null);
  const [schreibt, setSchreibt] = useState(false);
  const [meldung, setMeldung] = useState(false);
  const [schreibFehler, setSchreibFehler] = useState<string | null>(null);
  const [offenerGig, setOffenerGig] = useState<{
    gig: Gig;
    gruppe: "upcoming" | "past";
  } | null>(null);
  const setlistLauf = useRef(0);
  const aktiv = useRef(true);
  const markeRef = useRef(aktualisierung);

  useEffect(() => {
    aktiv.current = true;
    return () => {
      aktiv.current = false;
    };
  }, []);

  useEffect(() => {
    if (aktualisierung === markeRef.current) {
      return;
    }
    markeRef.current = aktualisierung;
    void ladeNeu();
  }, [aktualisierung, ladeNeu]);

  const ladeSetlists = useCallback(async () => {
    const token = ++setlistLauf.current;
    setSetlistFehler(null);
    setSetlists(null);
    try {
      const liste = await setlistAdapter.ladeSetlists(bandId);
      if (token === setlistLauf.current) {
        setSetlists(liste);
      }
    } catch (ursache: unknown) {
      if (token !== setlistLauf.current) {
        return;
      }
      const text = behandleFehler(ursache, onSitzungAbgelaufen);
      if (text) {
        setSetlistFehler(text);
      }
    }
  }, [bandId, onSitzungAbgelaufen, setlistAdapter]);

  useEffect(() => {
    void ladeSetlists();
    return () => {
      setlistLauf.current += 1;
    };
  }, [ladeSetlists]);

  async function schreibe(aktion: () => Promise<unknown>) {
    setSchreibt(true);
    setMeldung(false);
    setSchreibFehler(null);
    try {
      await aktion();
      if (!aktiv.current) {
        return;
      }
      setMeldung(true);
      await ladeNeu();
    } finally {
      if (aktiv.current) {
        setSchreibt(false);
      }
    }
  }

  async function speichern(gig: Gig | null, eingabe: GigEingabe) {
    await schreibe(() =>
      gig
        ? adapter.aendereGig(bandId, gig.id, eingabe)
        : adapter.erstelleGig(bandId, eingabe),
    );
  }

  async function loeschen(gig: Gig) {
    try {
      await schreibe(() => adapter.loescheGig(bandId, gig.id));
    } catch (ursache: unknown) {
      const text = behandleFehler(ursache, onSitzungAbgelaufen);
      if (text && aktiv.current) {
        setSchreibFehler(text);
      }
    }
  }

  function oeffneSetlist(setlistId: number) {
    onNavigieren(`/setlists/${encodeURIComponent(bandId)}/${setlistId}`);
  }

  const alleGigs =
    zustand.status === "fertig"
      ? [...zustand.gruppen.upcoming, ...zustand.gruppen.past]
      : [];
  const offenEntfernt =
    offenerGig !== null &&
    !alleGigs.some((eintrag) => eintrag.id === offenerGig.gig.id);

  function listeMit(gruppe: "upcoming" | "past"): Gig[] {
    const basis = zustand.status === "fertig" ? zustand.gruppen[gruppe] : [];
    if (offenerGig?.gruppe === gruppe && offenEntfernt) {
      return [...basis, offenerGig.gig];
    }
    return basis;
  }

  return (
    <section className="auftritte" aria-labelledby="auftritte-titel">
      <h2 id="auftritte-titel">Auftritte</h2>
      {zustand.status === "laedt" ? <StatusAnzeige zustand="laedt" /> : null}
      {zustand.status === "fehler" ? (
        <FehlerAnzeige
          text={zustand.fehler}
          onWiederholen={() => void ladeNeu()}
        />
      ) : null}
      {zustand.status === "fertig" ? (
        <>
          <div className="auftritt-gruppe">
            <h3>Kommende Auftritte</h3>
            {listeMit("upcoming").length === 0 ? (
              <p>Keine kommenden Auftritte.</p>
            ) : (
              <ul className="auftritt-liste">
                {listeMit("upcoming").map((gig) => (
                  <AuftrittZeile
                    key={gig.id}
                    bandId={bandId}
                    gig={gig}
                    setlists={setlists}
                    setlistFehler={setlistFehler}
                    onSetlistsErneutLaden={() => void ladeSetlists()}
                    gesperrt={schreibt || offenEntfernt}
                    geloescht={offenEntfernt && offenerGig?.gig.id === gig.id}
                    onBearbeitung={(gewaehlt) =>
                      setOffenerGig(
                        gewaehlt ? { gig: gewaehlt, gruppe: "upcoming" } : null,
                      )
                    }
                    onSpeichern={speichern}
                    onLoeschen={(eintrag) => void loeschen(eintrag)}
                    onSetlistOeffnen={oeffneSetlist}
                    onSitzungAbgelaufen={onSitzungAbgelaufen}
                  />
                ))}
              </ul>
            )}
          </div>
          <div className="auftritt-gruppe">
            <h3>Vergangene Auftritte</h3>
            {listeMit("past").length === 0 ? (
              <p>Keine vergangenen Auftritte.</p>
            ) : (
              <ul className="auftritt-liste">
                {listeMit("past").map((gig) => (
                  <AuftrittZeile
                    key={gig.id}
                    bandId={bandId}
                    gig={gig}
                    setlists={setlists}
                    setlistFehler={setlistFehler}
                    onSetlistsErneutLaden={() => void ladeSetlists()}
                    gesperrt={schreibt || offenEntfernt}
                    geloescht={offenEntfernt && offenerGig?.gig.id === gig.id}
                    onBearbeitung={(gewaehlt) =>
                      setOffenerGig(
                        gewaehlt ? { gig: gewaehlt, gruppe: "past" } : null,
                      )
                    }
                    onSpeichern={speichern}
                    onLoeschen={(eintrag) => void loeschen(eintrag)}
                    onSetlistOeffnen={oeffneSetlist}
                    onSitzungAbgelaufen={onSitzungAbgelaufen}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
      {schreibt ? <StatusAnzeige zustand="speichert" /> : null}
      {!schreibt && meldung ? <StatusAnzeige zustand="gespeichert" /> : null}
      {schreibFehler ? <p role="alert">{schreibFehler}</p> : null}
      {abgleichFehler && zustand.status === "fertig" ? (
        <FehlerAnzeige
          text={`Gespeichert, Liste nicht aktualisiert: ${abgleichFehler}`}
          onWiederholen={() => void ladeNeu()}
        />
      ) : null}
      <AuftrittFormular
        modus="anlegen"
        setlists={setlists}
        setlistFehler={setlistFehler}
        onSetlistsErneutLaden={() => void ladeSetlists()}
        gesperrt={schreibt}
        onSpeichern={(eingabe) => speichern(null, eingabe)}
        onSitzungAbgelaufen={onSitzungAbgelaufen}
      />
    </section>
  );
}
