import { useState } from "react";
import { behandleFehler } from "../api/client";
import type { Einladung, EinladungEingabe, EinladungErstellt } from "./verwaltung";

interface Props {
  einladungen: Einladung[];
  onErstellen: (eingabe: EinladungEingabe) => Promise<EinladungErstellt>;
  onWiderrufen: (einladungId: number) => Promise<Einladung>;
  onSitzungAbgelaufen?: () => void;
}

const STATUS: Record<Einladung["status"], string> = {
  active: "Aktiv",
  expired: "Abgelaufen",
  revoked: "Widerrufen",
  exhausted: "Ausgeschöpft",
};

const ZEIT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

function zeitpunkt(wert: string): string {
  const datum = new Date(wert);
  return Number.isNaN(datum.getTime()) ? wert : ZEIT.format(datum);
}

function vollerLink(pfad: string): string {
  if (typeof window === "undefined") {
    return pfad;
  }
  return new URL(pfad, window.location.origin).toString();
}

export function EinladungenBereich({
  einladungen,
  onErstellen,
  onWiderrufen,
  onSitzungAbgelaufen,
}: Props) {
  const [note, setNote] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [erstellt, setErstellt] = useState<EinladungErstellt | null>(null);
  const [kopiert, setKopiert] = useState(false);
  const [bestaetigung, setBestaetigung] = useState<number | null>(null);
  const [widerruftId, setWiderruftId] = useState<number | null>(null);

  async function absenden(ereignis: React.FormEvent) {
    ereignis.preventDefault();
    let grenze: number | null = null;
    if (maxUses.trim() !== "") {
      const zahl = Number(maxUses);
      if (!Number.isInteger(zahl) || zahl < 1 || zahl > 100) {
        setFehler("Nutzungslimit liegt zwischen 1 und 100.");
        return;
      }
      grenze = zahl;
    }
    setLaeuft(true);
    setFehler(null);
    setErstellt(null);
    try {
      const neu = await onErstellen({ note, max_uses: grenze });
      setErstellt(neu);
      setNote("");
      setMaxUses("");
      setKopiert(false);
    } catch (ursache) {
      setFehler(behandleFehler(ursache, onSitzungAbgelaufen));
    } finally {
      setLaeuft(false);
    }
  }

  async function kopieren() {
    if (!erstellt) {
      return;
    }
    const link = vollerLink(erstellt.invite_path);
    try {
      await navigator.clipboard.writeText(link);
      setKopiert(true);
    } catch {
      setKopiert(false);
      setFehler("Kopieren nicht möglich. Markiere den Link im Feld.");
    }
  }

  async function widerrufen(id: number) {
    if (widerruftId === id) {
      return;
    }
    setWiderruftId(id);
    setFehler(null);
    try {
      await onWiderrufen(id);
      setBestaetigung(null);
      setErstellt((aktuell) => (aktuell?.id === id ? null : aktuell));
    } catch (ursache) {
      setFehler(behandleFehler(ursache, onSitzungAbgelaufen));
    } finally {
      setWiderruftId(null);
    }
  }

  return (
    <section className="band-verwaltung-block" aria-labelledby="einladungen-titel">
      <h3 id="einladungen-titel">Einladungslinks</h3>
      <p className="hinweis">
        Links gelten 48 Stunden und lassen sich in der Bandgruppe teilen.
      </p>
      <form onSubmit={absenden} className="einladung-formular">
        <label>
          Hinweis
          <input
            name="note"
            value={note}
            maxLength={120}
            placeholder="Zum Beispiel: Probe Mittwoch"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <label>
          Nutzungen
          <input
            name="max_uses"
            type="number"
            min={1}
            max={100}
            value={maxUses}
            placeholder="unbegrenzt"
            onChange={(e) => setMaxUses(e.target.value)}
          />
        </label>
        <button type="submit" disabled={laeuft}>
          {laeuft ? "Erstellt …" : "48-Stunden-Link erstellen"}
        </button>
      </form>

      {erstellt ? (
        <div className="einladung-erstellt" role="status">
          <p>Link einmalig kopieren. Er wird nicht erneut angezeigt.</p>
          <label>
            Link
            <input
              readOnly
              value={vollerLink(erstellt.invite_path)}
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
          <button type="button" onClick={() => void kopieren()}>
            Link kopieren
          </button>
          {kopiert ? <span className="hinweis">Kopiert.</span> : null}
        </div>
      ) : null}

      {fehler ? <p role="alert">{fehler}</p> : null}

      <ul className="einladungen-liste">
        {einladungen.map((einladung) => (
          <li key={einladung.id} className="einladung">
            <div className="einladung-kopf">
              <span className={`einladung-status einladung-status-${einladung.status}`}>
                {STATUS[einladung.status]}
              </span>
              <span>
                Gültig bis {zeitpunkt(einladung.expires_at)}
              </span>
            </div>
            {einladung.note ? <p>{einladung.note}</p> : null}
            <p className="einladung-nutzung">
              {einladung.uses_count} von{" "}
              {einladung.max_uses === null ? "unbegrenzt" : einladung.max_uses} genutzt
            </p>
            {einladung.status === "active" ? (
              bestaetigung === einladung.id ? (
                <div className="bestaetigung" role="alert">
                  <p>Link wirklich widerrufen?</p>
                  <button
                    type="button"
                    className="gefahr"
                    disabled={widerruftId === einladung.id}
                    onClick={() => void widerrufen(einladung.id)}
                  >
                    {widerruftId === einladung.id ? "Widerruft …" : "Ja, widerrufen"}
                  </button>
                  <button
                    type="button"
                    disabled={widerruftId === einladung.id}
                    onClick={() => setBestaetigung(null)}
                  >
                    Abbrechen
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="gefahr"
                  onClick={() => setBestaetigung(einladung.id)}
                >
                  Widerrufen
                </button>
              )
            ) : null}
          </li>
        ))}
      </ul>
      {einladungen.length === 0 ? (
        <p className="hinweis">Noch kein Einladungslink.</p>
      ) : null}
    </section>
  );
}
