import { useState } from "react";
import { formatiereDatum, formatiereUhrzeit } from "../gigs/format";
import type { Gig, GigEingabe } from "../gigs/gigs";
import type { SetlistKurz } from "../setlists/setlists";
import { AuftrittFormular } from "./AuftrittFormular";

interface AuftrittZeileProps {
  bandId: string;
  gig: Gig;
  setlists: SetlistKurz[] | null;
  setlistFehler: string | null;
  onSetlistsErneutLaden?: () => void;
  gesperrt?: boolean;
  geloescht?: boolean;
  starteBearbeitung?: boolean;
  onBearbeitung?: (gig: Gig, offen: boolean) => void;
  onSpeichern: (gig: Gig, eingabe: GigEingabe) => Promise<void>;
  onLoeschen: (gig: Gig) => void;
  onSetlistOeffnen: (setlistId: number) => void;
  onSitzungAbgelaufen?: () => void;
}

export function AuftrittZeile({
  bandId,
  gig,
  setlists,
  setlistFehler,
  onSetlistsErneutLaden,
  gesperrt = false,
  geloescht = false,
  starteBearbeitung = false,
  onBearbeitung,
  onSpeichern,
  onLoeschen,
  onSetlistOeffnen,
  onSitzungAbgelaufen,
}: AuftrittZeileProps) {
  const [bearbeiten, setBearbeiten] = useState(starteBearbeitung);
  const [bestaetigen, setBestaetigen] = useState(false);
  const setlistId = gig.setlist_id;

  if (bearbeiten) {
    return (
      <li className="auftritt-zeile">
        <AuftrittFormular
          modus="bearbeiten"
          start={gig}
          setlists={setlists}
          setlistFehler={setlistFehler}
          onSetlistsErneutLaden={onSetlistsErneutLaden}
          gesperrt={gesperrt || geloescht}
          geloescht={geloescht}
          onSpeichern={async (eingabe) => {
            await onSpeichern(gig, eingabe);
            setBearbeiten(false);
            onBearbeitung?.(gig, false);
          }}
          onAbbrechen={() => {
            setBearbeiten(false);
            onBearbeitung?.(gig, false);
          }}
          onSitzungAbgelaufen={onSitzungAbgelaufen}
        />
      </li>
    );
  }

  return (
    <li className="auftritt-zeile">
      <span className="auftritt-datum">{formatiereDatum(gig.date)}</span>
      {gig.time ? (
        <span className="auftritt-zeit">{formatiereUhrzeit(gig.time)}</span>
      ) : null}
      <strong className="auftritt-titel">{gig.title}</strong>
      {gig.location ? <span className="auftritt-ort">{gig.location}</span> : null}
      {setlistId !== null ? (
        <a
          className="auftritt-setlist"
          href={`/setlists/${encodeURIComponent(bandId)}/${setlistId}`}
          onClick={(ereignis) => {
            ereignis.preventDefault();
            onSetlistOeffnen(setlistId);
          }}
        >
          {gig.setlist_name ?? "Setlist"}
        </a>
      ) : null}
      <button
        type="button"
        disabled={gesperrt}
        onClick={() => {
          setBearbeiten(true);
          onBearbeitung?.(gig, true);
        }}
      >
        {`${gig.title} ändern`}
      </button>
      {bestaetigen ? (
        <>
          <span role="status">Wirklich löschen?</span>
          <button
            type="button"
            disabled={gesperrt}
            onClick={() => onLoeschen(gig)}
          >
            Löschen bestätigen
          </button>
          <button
            type="button"
            disabled={gesperrt}
            onClick={() => setBestaetigen(false)}
          >
            Löschen abbrechen
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={gesperrt}
          onClick={() => setBestaetigen(true)}
        >
          {`${gig.title} löschen`}
        </button>
      )}
    </li>
  );
}
