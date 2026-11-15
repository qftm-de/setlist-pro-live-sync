import { useState } from "react";
import { behandleFehler } from "../api/client";
import type { Gig, GigEingabe } from "../gigs/gigs";
import type { SetlistKurz } from "../setlists/setlists";

interface AuftrittFormularProps {
  modus: "anlegen" | "bearbeiten";
  start?: Gig;
  setlists: SetlistKurz[] | null;
  setlistFehler: string | null;
  onSetlistsErneutLaden?: () => void;
  gesperrt?: boolean;
  onSpeichern: (eingabe: GigEingabe) => Promise<void>;
  onAbbrechen?: () => void;
  onSitzungAbgelaufen?: () => void;
}

export function AuftrittFormular({
  modus,
  start,
  setlists,
  setlistFehler,
  onSetlistsErneutLaden,
  gesperrt = false,
  onSpeichern,
  onAbbrechen,
  onSitzungAbgelaufen,
}: AuftrittFormularProps) {
  const suffix = modus === "bearbeiten" ? " (ändern)" : "";
  const [titel, setTitel] = useState(start?.title ?? "");
  const [datum, setDatum] = useState(start?.date ?? "");
  const [uhrzeit, setUhrzeit] = useState(start?.time ? start.time.slice(0, 5) : "");
  const [ort, setOrt] = useState(start?.location ?? "");
  const [notiz, setNotiz] = useState(start?.notes ?? "");
  const [setlistWahl, setSetlistWahl] = useState(
    start?.setlist_id ? String(start.setlist_id) : "",
  );
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const setlistGesperrt = setlists === null;
  const bekannteSetlist =
    start?.setlist_id != null &&
    !(setlists ?? []).some((setlist) => setlist.id === start.setlist_id);

  async function speichern(ereignis: React.FormEvent) {
    ereignis.preventDefault();
    const saubererTitel = titel.trim();
    if (!saubererTitel) {
      setFehler("Bitte einen Titel eintragen.");
      return;
    }
    if (!datum) {
      setFehler("Bitte ein Datum eintragen.");
      return;
    }
    const eingabe: GigEingabe = {
      title: saubererTitel,
      date: datum,
      time: uhrzeit
        ? uhrzeit.split(":").length === 2
          ? `${uhrzeit}:00`
          : uhrzeit
        : null,
      location: ort.trim(),
      notes: notiz,
      ...(setlistGesperrt
        ? {}
        : { setlist_id: setlistWahl ? Number(setlistWahl) : null }),
    };
    setFehler(null);
    setLaeuft(true);
    try {
      await onSpeichern(eingabe);
      if (modus === "anlegen") {
        setTitel("");
        setDatum("");
        setUhrzeit("");
        setOrt("");
        setNotiz("");
        setSetlistWahl("");
      }
    } catch (ursache) {
      setFehler(behandleFehler(ursache, onSitzungAbgelaufen));
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <form className="auftritt-formular" onSubmit={speichern}>
      <label>
        {`Titel${suffix}`}
        <input
          name={modus === "anlegen" ? "auftritt-titel" : "auftritt-titel-aendern"}
          value={titel}
          required
          maxLength={200}
          onChange={(ereignis) => setTitel(ereignis.target.value)}
        />
      </label>
      <label>
        {`Datum${suffix}`}
        <input
          name={modus === "anlegen" ? "auftritt-datum" : "auftritt-datum-aendern"}
          type="date"
          value={datum}
          required
          onChange={(ereignis) => setDatum(ereignis.target.value)}
        />
      </label>
      <label>
        {`Uhrzeit${suffix}`}
        <input
          name={modus === "anlegen" ? "auftritt-uhrzeit" : "auftritt-uhrzeit-aendern"}
          type="time"
          value={uhrzeit}
          onChange={(ereignis) => setUhrzeit(ereignis.target.value)}
        />
      </label>
      <label>
        {`Ort${suffix}`}
        <input
          name={modus === "anlegen" ? "auftritt-ort" : "auftritt-ort-aendern"}
          value={ort}
          maxLength={200}
          onChange={(ereignis) => setOrt(ereignis.target.value)}
        />
      </label>
      <label>
        {`Notiz${suffix}`}
        <textarea
          name={modus === "anlegen" ? "auftritt-notiz" : "auftritt-notiz-aendern"}
          value={notiz}
          maxLength={10000}
          onChange={(ereignis) => setNotiz(ereignis.target.value)}
        />
      </label>
      <label>
        {`Setlist${suffix}`}
        <select
          name={modus === "anlegen" ? "auftritt-setlist" : "auftritt-setlist-aendern"}
          value={setlistWahl}
          disabled={setlistGesperrt}
          onChange={(ereignis) => setSetlistWahl(ereignis.target.value)}
        >
          <option value="">Ohne Setlist</option>
          {(setlists ?? []).map((setlist) => (
            <option key={setlist.id} value={setlist.id}>
              {setlist.name}
            </option>
          ))}
          {bekannteSetlist && start?.setlist_id != null ? (
            <option value={start.setlist_id}>
              {start.setlist_name ?? "Verknüpfte Setlist"}
            </option>
          ) : null}
        </select>
      </label>
      {setlistFehler ? (
        <div className="auftritt-setlist-fehler" role="alert">
          <p>{setlistFehler}</p>
          {onSetlistsErneutLaden ? (
            <button type="button" onClick={onSetlistsErneutLaden}>
              Setlists erneut laden
            </button>
          ) : null}
        </div>
      ) : null}
      <p className="auftritt-hinweis">
        Die Verknüpfung zeigt den aktuellen Stand und sichert keinen historischen Inhalt.
      </p>
      <button type="submit" disabled={laeuft || gesperrt}>
        {modus === "anlegen" ? "Auftritt anlegen" : "Änderung speichern"}
      </button>
      {modus === "bearbeiten" && onAbbrechen ? (
        <button type="button" disabled={laeuft || gesperrt} onClick={onAbbrechen}>
          Abbrechen
        </button>
      ) : null}
      {fehler ? <p role="alert">{fehler}</p> : null}
    </form>
  );
}
