import { useEffect, useState } from "react";
import { fehlerText } from "../api/client";
import {
  instanzEinladungenApi,
  type InstanzEinladung,
  type InstanzEinladungErstellt,
} from "./instanzEinladungen";

const STATUS: Record<InstanzEinladung["status"], string> = {
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

/**
 * Laedt die Liste selbst, weil nur der Betreiber sie sehen darf. Ein 403
 * blendet den Bereich aus, statt einen Fehler zu zeigen.
 */
export function InstanzEinladungen({
  api = instanzEinladungenApi,
}: {
  api?: typeof instanzEinladungenApi;
}) {
  const [sichtbar, setSichtbar] = useState(false);
  const [einladungen, setEinladungen] = useState<InstanzEinladung[]>([]);
  const [note, setNote] = useState("");
  const [tage, setTage] = useState("14");
  const [maxUses, setMaxUses] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [erstellt, setErstellt] = useState<InstanzEinladungErstellt | null>(null);
  const [kopiert, setKopiert] = useState(false);

  useEffect(() => {
    let aktiv = true;
    api
      .lade()
      .then((liste) => {
        if (aktiv) {
          setEinladungen(liste);
          setSichtbar(true);
        }
      })
      .catch(() => {
        // Kein Recht, keine Verbindung: Der Bereich bleibt bei allen
        // Ladefehlern unsichtbar und meldet nichts.
        if (aktiv) {
          setSichtbar(false);
        }
      });
    return () => {
      aktiv = false;
    };
  }, [api]);

  if (!sichtbar) {
    return null;
  }

  async function absenden(ereignis: React.FormEvent) {
    ereignis.preventDefault();
    setFehler(null);
    const laufzeit = Number(tage);
    if (!Number.isInteger(laufzeit) || laufzeit < 1 || laufzeit > 90) {
      setFehler("Laufzeit liegt zwischen 1 und 90 Tagen.");
      return;
    }
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
    try {
      const neu = await api.erstelle({
        note: note.trim(),
        tage: laufzeit,
        max_uses: grenze,
      });
      setErstellt(neu);
      setEinladungen((alt) => [neu, ...alt]);
      setKopiert(false);
      setNote("");
      setMaxUses("");
    } catch (ursache) {
      setFehler(fehlerText(ursache));
    } finally {
      setLaeuft(false);
    }
  }

  async function widerrufen(einladungId: number) {
    setFehler(null);
    try {
      const geaendert = await api.widerrufe(einladungId);
      setEinladungen((alt) =>
        alt.map((e) => (e.id === einladungId ? geaendert : e)),
      );
    } catch (ursache) {
      setFehler(fehlerText(ursache));
    }
  }

  async function kopieren() {
    if (!erstellt) {
      return;
    }
    try {
      await navigator.clipboard.writeText(vollerLink(erstellt.invite_path));
      setKopiert(true);
    } catch {
      setKopiert(false);
    }
  }

  return (
    <section className="band-verwaltung-block" aria-labelledby="instanz-einladungen">
      <h3 id="instanz-einladungen">Weitere Band einladen</h3>
      <p className="hinweis">
        Der Link legt nur ein Konto an. Die Band entsteht danach selbst und
        trägt ihren Namen dort ein.
      </p>
      <form onSubmit={absenden} className="einladung-formular">
        <label>
          Hinweis
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={120}
            placeholder="z. B. Band aus Leimbach"
          />
        </label>
        <label>
          Laufzeit in Tagen
          <input
            value={tage}
            onChange={(e) => setTage(e.target.value)}
            inputMode="numeric"
          />
        </label>
        <label>
          Nutzungen (leer = unbegrenzt)
          <input
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            inputMode="numeric"
          />
        </label>
        <button type="submit" disabled={laeuft}>
          {laeuft ? "Wird erstellt …" : "Einladungslink erstellen"}
        </button>
      </form>

      {fehler ? (
        <p role="alert" className="fehler">
          {fehler}
        </p>
      ) : null}

      {erstellt ? (
        <div className="einladung-link">
          <p>Link, nur einmal sichtbar:</p>
          <code>{vollerLink(erstellt.invite_path)}</code>
          <button type="button" onClick={kopieren}>
            {kopiert ? "Kopiert" : "Kopieren"}
          </button>
        </div>
      ) : null}

      {einladungen.length > 0 ? (
        <ul className="einladung-liste">
          {einladungen.map((e) => (
            <li key={e.id}>
              <span>{e.note || "ohne Hinweis"}</span>
              <span>bis {zeitpunkt(e.expires_at)}</span>
              <span>
                {e.uses_count}
                {e.max_uses !== null ? `/${e.max_uses}` : ""} genutzt
              </span>
              <span>{STATUS[e.status]}</span>
              {e.status === "active" ? (
                <button type="button" onClick={() => widerrufen(e.id)}>
                  Widerrufen
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
