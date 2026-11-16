import { useCallback, useEffect, useState } from "react";
import { behandleFehler, fehlerText, istApiFehler } from "../api/client";
import { apiAnmerkungen, type Anmerkung, type AnmerkungAdapter } from "../annotations/annotations";
import { PdfVorrat, type VorratQuelle, type VorratStand } from "../documents/pdfLaden";
import { apiSetlists, type SetlistAdapter, type SetlistKurz } from "../setlists/setlists";
import { FehlerAnzeige } from "../ui/FehlerAnzeige";
import { StatusAnzeige } from "../ui/StatusAnzeige";
import { StageAnsicht, type BuehnenAktion } from "./StageAnsicht";
import { apiStage, type StageAdapter, type StageEintrag, type StageSitzung } from "./stage";
import "./stage.css";

interface StageRouteProps {
  bandId: string;
  sessionId: number | null;
  verbindungId: string | null;
  verbunden: boolean;
  sende: (nachricht: Record<string, unknown>) => void;
  antwort: Record<string, unknown> | null;
  stageMarke: number;
  anmerkungsMarke: number;
  onNavigieren: (ziel: string) => void;
  onSitzungAbgelaufen?: () => void;
  stageAdapter?: StageAdapter;
  setlistAdapter?: SetlistAdapter;
  anmerkungAdapter?: AnmerkungAdapter;
}

function songEintraege(sitzung: StageSitzung): StageEintrag[] {
  return sitzung.sections.flatMap((abschnitt) =>
    abschnitt.entries.filter((eintrag) => eintrag.entry_type === "song"),
  );
}

function pdfQuellen(bandId: string, sitzung: StageSitzung): VorratQuelle[] {
  const gesehen = new Set<number>();
  const quellen: VorratQuelle[] = [];
  for (const eintrag of songEintraege(sitzung)) {
    const dokument = eintrag.document;
    const songId = eintrag.song?.id;
    if (!dokument || !songId || gesehen.has(dokument.version_id)) {
      continue;
    }
    gesehen.add(dokument.version_id);
    quellen.push({
      versionId: dokument.version_id,
      byteSize: dokument.byte_size,
      url: `/api/bands/${encodeURIComponent(bandId)}/songs/${songId}/document/versions/${dokument.version_id}/file/`,
    });
  }
  return quellen;
}

export function StageRoute({
  bandId,
  sessionId,
  verbindungId,
  verbunden,
  sende,
  antwort,
  stageMarke,
  anmerkungsMarke,
  onNavigieren,
  onSitzungAbgelaufen,
  stageAdapter = apiStage,
  setlistAdapter = apiSetlists,
  anmerkungAdapter = apiAnmerkungen,
}: StageRouteProps) {
  const [sitzung, setSitzung] = useState<StageSitzung | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [beigetreten, setBeigetreten] = useState(false);
  const [neuLaden, setNeuLaden] = useState(0);
  const [setlists, setSetlists] = useState<SetlistKurz[] | null>(null);
  const [startFehler, setStartFehler] = useState<string | null>(null);
  const [reserve, setReserve] = useState<VorratStand | null>(null);
  const [vorrat, setVorrat] = useState(() => new PdfVorrat());
  const [anmerkungen, setAnmerkungen] = useState<Record<number, Anmerkung[]>>({});
  const [anmerkungsFehler, setAnmerkungsFehler] = useState(0);

  const ladeSitzung = useCallback(async () => {
    setLaedt(true);
    setFehler(null);
    try {
      const geladen =
        sessionId !== null
          ? await stageAdapter.detail(bandId, sessionId, verbindungId)
          : await stageAdapter.aktive(bandId, verbindungId);
      setSitzung(geladen);
    } catch (ursache) {
      const text = behandleFehler(ursache, onSitzungAbgelaufen);
      if (
        istApiFehler(ursache) &&
        ["not_found", "forbidden", "unauthenticated"].includes(ursache.code)
      ) {
        // Rechteentzug oder gelöschte Sitzung: vorgeladene Daten freigeben.
        setAnmerkungen({});
        setReserve(null);
        setVorrat((alter) => {
          void alter.gibFrei();
          return new PdfVorrat();
        });
      }
      setFehler(
        istApiFehler(ursache) && ursache.code === "not_found"
          ? "Diese Bühnensitzung ist nicht sichtbar oder existiert nicht."
          : (text ?? fehlerText(ursache)),
      );
      setSitzung(null);
    } finally {
      setLaedt(false);
    }
  }, [bandId, onSitzungAbgelaufen, sessionId, stageAdapter, verbindungId]);

  useEffect(() => {
    void ladeSitzung();
  }, [ladeSitzung, neuLaden, stageMarke]);

  // Laufende Rechteprüfung, damit ein Mitgliedschaftsentzug auch vorgeladene
  // private Daten entfernt, ohne auf einen Ereignispuffer zu warten.
  useEffect(() => {
    if (!sitzung || sitzung.state !== "active") {
      return;
    }
    const takt = window.setInterval(() => setNeuLaden((wert) => wert + 1), 30000);
    return () => window.clearInterval(takt);
  }, [sitzung]);

  useEffect(() => {
    if (sitzung !== null || sessionId !== null) {
      return;
    }
    let aktiv = true;
    if (setlists === null) {
      setlistAdapter
        .ladeSetlists(bandId)
        .then((liste) => {
          if (aktiv) {
            setSetlists(liste);
          }
        })
        .catch(() => {
          if (aktiv) {
            setSetlists([]);
          }
        });
    }
    return () => {
      aktiv = false;
    };
  }, [bandId, sessionId, setlistAdapter, setlists, sitzung]);

  // Lesereserve je Sitzung. Alle PDF-Versionen und Seite 1 werden vorbereitet.
  useEffect(() => {
    if (!sitzung) {
      return;
    }
    let abgebrochen = false;
    const neuer = new PdfVorrat();
    setVorrat((alter) => {
      void alter.gibFrei();
      return neuer;
    });
    setReserve({
      bereit: false,
      vorbereitet: 0,
      gesamt: pdfQuellen(bandId, sitzung).length,
      bytes: 0,
      grenze: 0,
      unvollstaendig: false,
      fehler: [],
      uebersprungen: [],
    });
    void neuer
      .bereiteVor(pdfQuellen(bandId, sitzung), setReserve, () => abgebrochen)
      .catch(() => undefined);
    return () => {
      abgebrochen = true;
      void neuer.gibFrei();
    };
  }, [bandId, sitzung?.id]);

  // Anmerkungen aller Sitzungsdokumente laden. Privatisierte Inhalte kommen
  // beim erneuten Laden nicht zurück.
  useEffect(() => {
    if (!sitzung) {
      return;
    }
    let aktiv = true;
    const versionen = new Map<number, number>();
    for (const eintrag of songEintraege(sitzung)) {
      const songId = eintrag.song?.id;
      const versionId = eintrag.document?.version_id;
      if (songId && versionId) {
        versionen.set(versionId, songId);
      }
    }
    void (async () => {
      const karte: Record<number, Anmerkung[]> = {};
      let fehler = 0;
      for (const [versionId, songId] of versionen) {
        if (!aktiv) {
          return;
        }
        try {
          karte[versionId] = await anmerkungAdapter.lade(bandId, songId, versionId);
        } catch {
          karte[versionId] = [];
          fehler += 1;
        }
      }
      if (aktiv) {
        setAnmerkungen(karte);
        setAnmerkungsFehler(fehler);
      }
    })();
    return () => {
      aktiv = false;
    };
  }, [anmerkungAdapter, anmerkungsMarke, bandId, sitzung]);

  async function starten(setlistId: number) {
    if (!verbindungId) {
      setStartFehler("Die Verbindung ist noch nicht bereit. Bitte kurz warten.");
      return;
    }
    setStartFehler(null);
    try {
      const neu = await stageAdapter.start(bandId, setlistId, verbindungId);
      setSitzung(neu);
      onNavigieren(`/stage/${encodeURIComponent(bandId)}/${neu.id}`);
    } catch (ursache) {
      if (istApiFehler(ursache) && ursache.code === "conflict") {
        setNeuLaden((wert) => wert + 1);
        return;
      }
      setStartFehler(behandleFehler(ursache, onSitzungAbgelaufen));
    }
  }

  async function beitreten() {
    if (!sitzung || !verbindungId) {
      return;
    }
    try {
      const neu = await stageAdapter.join(bandId, sitzung.id, verbindungId);
      setSitzung(neu);
      setBeigetreten(true);
    } catch (ursache) {
      setFehler(behandleFehler(ursache, onSitzungAbgelaufen) ?? fehlerText(ursache));
    }
  }

  async function aktion(art: BuehnenAktion, zielUserId?: number) {
    if (!sitzung || !verbindungId) {
      return;
    }
    try {
      const neu =
        art === "handover"
          ? await stageAdapter.handover(bandId, sitzung.id, verbindungId, zielUserId ?? 0)
          : art === "takeover"
            ? await stageAdapter.takeover(bandId, sitzung.id, verbindungId)
            : art === "resume"
              ? await stageAdapter.resume(bandId, sitzung.id, verbindungId)
              : await stageAdapter.beenden(bandId, sitzung.id, verbindungId);
      setSitzung(neu);
    } catch (ursache) {
      setFehler(behandleFehler(ursache, onSitzungAbgelaufen) ?? fehlerText(ursache));
      setNeuLaden((wert) => wert + 1);
    }
  }

  if (laedt) {
    return <StatusAnzeige zustand="laedt" />;
  }

  if (fehler) {
    return (
      <FehlerAnzeige
        text={fehler}
        onWiederholen={() => setNeuLaden((wert) => wert + 1)}
      />
    );
  }

  if (!sitzung) {
    return (
      <section className="buehne-start" aria-labelledby="buehne-start-titel">
        <h1 id="buehne-start-titel">Bühne</h1>
        <p>Es läuft keine Bühnensitzung. Starte eine aus einer gespeicherten Setlist.</p>
        {startFehler ? <p role="alert">{startFehler}</p> : null}
        {!verbunden ? (
          <p className="buehne-hinweis">
            Die Verbindung ist unterbrochen. Ein Start braucht eine aktuelle Verbindung.
          </p>
        ) : null}
        {setlists === null ? <StatusAnzeige zustand="laedt" /> : null}
        {setlists !== null && setlists.length === 0 ? (
          <p>Noch keine gespeicherte Setlist.</p>
        ) : null}
        <ul className="buehne-startliste">
          {(setlists ?? []).map((eintrag) => (
            <li key={eintrag.id}>
              <button
                type="button"
                onClick={() => void starten(eintrag.id)}
                disabled={!verbunden || !verbindungId}
              >
                {`Sitzung aus ${eintrag.name} starten`}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => onNavigieren("/")}>
          Zurück zur Band
        </button>
      </section>
    );
  }

  const aktuellerEintrag = sitzung.sections
    .flatMap((abschnitt) => abschnitt.entries)
    .find((eintrag) => eintrag.uuid === sitzung.current.entry_uuid);
  const versionId = aktuellerEintrag?.document?.version_id ?? null;

  return (
    <>
      {!beigetreten && sitzung.state === "active" ? (
        <p className="buehne-hinweis" role="status">
          Du liest mit.{" "}
          <button type="button" onClick={() => void beitreten()} disabled={!verbindungId}>
            Sitzung beitreten
          </button>
        </p>
      ) : null}
      <StageAnsicht
        bandId={bandId}
        sitzung={sitzung}
        verbindungId={verbindungId}
        verbunden={verbunden}
        antwort={antwort}
        sende={sende}
        vorrat={vorrat}
        annotationen={versionId ? (anmerkungen[versionId] ?? []) : []}
        reserve={reserve}
        anmerkungsFehler={anmerkungsFehler}
        onSitzungAktualisieren={() => setNeuLaden((wert) => wert + 1)}
        onAktion={aktion}
        onVerlassen={() => onNavigieren("/")}
      />
    </>
  );
}
