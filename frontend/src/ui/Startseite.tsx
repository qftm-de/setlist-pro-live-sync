import { useEffect, useState } from "react";
import type { Gig, GigAdapter } from "../gigs/gigs";
import { behandleFehler, fehlerText } from "../api/client";

interface Props {
  bandId: string;
  adapter: GigAdapter;
  onNavigieren: (pfad: string) => void;
  onSitzungAbgelaufen: () => void;
}
export function Startseite({bandId,adapter,onNavigieren,onSitzungAbgelaufen}: Props) {
  const [naechster,setNaechster] = useState<Gig | null>(null);
  const [fehler,setFehler] = useState<string | null>(null);
  const [laedt,setLaedt] = useState(true);
  const [versuch,setVersuch] = useState(0);
  useEffect(() => {
    let aktiv = true; setLaedt(true); setFehler(null); setNaechster(null);
    adapter.ladeGigs(bandId).then(g => { if (aktiv) { setNaechster(g.upcoming[0] ?? null); setLaedt(false); } }).catch(e => {
      if (aktiv) { setFehler(behandleFehler(e,onSitzungAbgelaufen) ?? fehlerText(e)); setLaedt(false); }
    });
    return () => {aktiv = false;};
  }, [bandId,adapter,onSitzungAbgelaufen,versuch]);
  return <section className="startseite" aria-label="Bandübersicht">
    <img className="start-motiv" src="/bandmotiv.jpg" alt="Band mit Gesang, Gitarre und Schlagzeug" />
    <h2>Bereit für die nächste Probe</h2>
    <div className="start-aktionen">
      <button onClick={() => onNavigieren("/songs")}>Songs öffnen</button>
      <button onClick={() => onNavigieren("/setlists")}>Setlists öffnen</button>
      <button onClick={() => onNavigieren("/gigs")}>Auftritte öffnen</button>
    </div>
    <h3>Nächster Auftritt</h3>
    {laedt ? <p role="status">Auftritte laden …</p> : null}
    {fehler ? <div className="aktionsgruppe" role="alert">{fehler}<button onClick={() => setVersuch(v => v+1)}>Erneut versuchen</button></div> : null}
    {!laedt && !fehler && !naechster ? <p>Noch kein kommender Auftritt.</p> : null}
    {naechster ? <article><h3>{naechster.title}</h3><p>{new Intl.DateTimeFormat("de-DE",{dateStyle:"medium"}).format(new Date(`${naechster.date}T12:00:00`))} · {naechster.location}</p>
      {naechster.setlist_id ? <button onClick={() => onNavigieren(`/setlists/${encodeURIComponent(bandId)}/${naechster.setlist_id}`)}>Setlist öffnen</button> : null}
    </article> : null}
  </section>;
}
