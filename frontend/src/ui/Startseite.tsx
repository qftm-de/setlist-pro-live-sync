import { useEffect, useRef } from "react";
import type { Band } from "../bands/bands";
import type { GigAdapter, GigGruppen } from "../gigs/gigs";
import { useGigs } from "../gigs/useGigs";

interface Props {
  bandId: string;
  band?: Band;
  adapter: GigAdapter;
  aktualisierung?: number;
  vorgabe?: GigGruppen | null;
  onNavigieren: (pfad: string) => void;
  onSitzungAbgelaufen: () => void;
}

export function Startseite({
  bandId,
  band,
  adapter,
  aktualisierung = 0,
  vorgabe = null,
  onNavigieren,
  onSitzungAbgelaufen,
}: Props) {
  const { zustand, abgleichFehler, ladeNeu } = useGigs(
    adapter,
    bandId,
    onSitzungAbgelaufen,
    vorgabe,
  );
  const markeRef = useRef(aktualisierung);

  useEffect(() => {
    if (aktualisierung === markeRef.current) {
      return;
    }
    markeRef.current = aktualisierung;
    void ladeNeu();
  }, [aktualisierung, ladeNeu]);

  const naechster =
    zustand.status === "fertig" ? (zustand.gruppen.upcoming[0] ?? null) : null;

  return (
    <section className="startseite" aria-label="Bandübersicht">
      <img
        className="start-motiv"
        src="/bandmotiv.jpg"
        alt="Band mit Gesang, Gitarre und Schlagzeug"
      />
      <h2>Bereit für die nächste Probe</h2>
      {band?.genre || band?.location ? (
        <p className="start-banddaten">
          {[band.genre, band.location].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      <div className="start-aktionen">
        <button type="button" onClick={() => onNavigieren("/songs")}>
          Songs öffnen
        </button>
        <button type="button" onClick={() => onNavigieren("/setlists")}>
          Setlists öffnen
        </button>
        <button type="button" onClick={() => onNavigieren("/gigs")}>
          Auftritte öffnen
        </button>
        <button type="button" onClick={() => onNavigieren("/band")}>
          Band &amp; Mitglieder
        </button>
      </div>
      <h3>Nächster Auftritt</h3>
      {zustand.status === "laedt" ? <p role="status">Auftritte laden …</p> : null}
      {zustand.status === "fehler" ? (
        <div className="aktionsgruppe" role="alert">
          {zustand.fehler}
          <button type="button" onClick={() => void ladeNeu()}>
            Erneut versuchen
          </button>
        </div>
      ) : null}
      {zustand.status === "fertig" && !naechster ? (
        <p>Noch kein kommender Auftritt.</p>
      ) : null}
      {naechster ? (
        <article>
          <h3>{naechster.title}</h3>
          <p>
            {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(
              new Date(`${naechster.date}T12:00:00`),
            )}
            {naechster.location ? ` · ${naechster.location}` : ""}
          </p>
          {naechster.setlist_id ? (
            <button
              type="button"
              onClick={() =>
                onNavigieren(
                  `/setlists/${encodeURIComponent(bandId)}/${naechster.setlist_id}`,
                )
              }
            >
              Setlist öffnen
            </button>
          ) : null}
        </article>
      ) : null}
      {abgleichFehler && zustand.status === "fertig" ? (
        <div className="aktionsgruppe" role="alert">
          {abgleichFehler}
          <button type="button" onClick={() => void ladeNeu()}>
            Erneut versuchen
          </button>
        </div>
      ) : null}
    </section>
  );
}
