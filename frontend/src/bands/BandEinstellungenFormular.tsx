import { useEffect, useRef, useState } from "react";
import { behandleFehler } from "../api/client";
import type { Band, BandEingabe } from "./bands";
import { StatusAnzeige, type SpeicherZustand } from "../ui/StatusAnzeige";

interface Props {
  band: Band;
  kannBearbeiten: boolean;
  onSpeichern: (eingabe: BandEingabe) => Promise<Band | void>;
  onSitzungAbgelaufen?: () => void;
}

interface Felder {
  name: string;
  genre: string;
  location: string;
  description: string;
  internal_notes: string;
}

const FELD_SCHLUESSEL: (keyof Felder)[] = [
  "name", "genre", "location", "description", "internal_notes",
];

const FELD_NAMEN: Record<keyof Felder, string> = {
  name: "Name",
  genre: "Genre",
  location: "Ort / Proberaum",
  description: "Beschreibung",
  internal_notes: "Interne Band-Notiz",
};

function ausBand(band: Band): Felder {
  return {
    name: band.name,
    genre: band.genre ?? "",
    location: band.location ?? "",
    description: band.description ?? "",
    internal_notes: band.internal_notes ?? "",
  };
}

function gleich(a: Felder, b: Felder): boolean {
  return FELD_SCHLUESSEL.every((feld) => a[feld].trim() === b[feld].trim());
}

function nurBeruehrteFelder(felder: Felder, beruehrt: Set<keyof Felder>): BandEingabe {
  const eingabe: BandEingabe = {};
  for (const feld of FELD_SCHLUESSEL) {
    if (beruehrt.has(feld)) {
      eingabe[feld] = felder[feld];
    }
  }
  return eingabe;
}

export function BandEinstellungenFormular({
  band,
  kannBearbeiten,
  onSpeichern,
  onSitzungAbgelaufen,
}: Props) {
  const [felder, setFelder] = useState<Felder>(() => ausBand(band));
  const [zustand, setZustand] = useState<SpeicherZustand | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [serverAenderung, setServerAenderung] = useState(false);
  const [konflikte, setKonflikte] = useState<Set<keyof Felder>>(() => new Set());
  const [beruehrt, setBeruehrt] = useState<Set<keyof Felder>>(() => new Set());
  const speichert = zustand === "speichert";
  const felderRef = useRef(felder);
  const beruehrtRef = useRef(beruehrt);
  const serverRef = useRef(ausBand(band));
  const serverStandNrRef = useRef(0);
  const basisRef = useRef<Partial<Felder>>({});
  const bandIdRef = useRef(band.id);
  felderRef.current = felder;
  beruehrtRef.current = beruehrt;

  useEffect(() => {
    const neu = ausBand(band);
    const alt = serverRef.current;
    serverRef.current = neu;
    if (bandIdRef.current !== band.id) {
      serverStandNrRef.current += 1;
      bandIdRef.current = band.id;
      basisRef.current = {};
      felderRef.current = neu;
      setFelder(neu);
      setBeruehrt(new Set());
      setServerAenderung(false);
      setKonflikte(new Set());
      setZustand(null);
      setFehler(null);
      return;
    }
    if (gleich(neu, alt)) {
      return;
    }
    serverStandNrRef.current += 1;
    const bearbeitet = beruehrtRef.current;
    if (bearbeitet.size === 0) {
      basisRef.current = {};
      setFelder(neu);
      setServerAenderung(false);
      setKonflikte(new Set());
      return;
    }
    let aktualisiert: Felder | null = null;
    const neueKonflikte = new Set<keyof Felder>();
    for (const feld of FELD_SCHLUESSEL) {
      if (!bearbeitet.has(feld)) {
        if (neu[feld] !== felderRef.current[feld]) {
          aktualisiert = { ...(aktualisiert ?? felderRef.current), [feld]: neu[feld] };
        }
        continue;
      }
      const basis = basisRef.current[feld] ?? alt[feld];
      if (
        neu[feld].trim() !== basis.trim() &&
        neu[feld].trim() !== felderRef.current[feld].trim()
      ) {
        neueKonflikte.add(feld);
      }
    }
    if (aktualisiert) {
      felderRef.current = aktualisiert;
      setFelder(aktualisiert);
    }
    setServerAenderung(true);
    setKonflikte(neueKonflikte);
  }, [band.id, band.name, band.genre, band.location, band.description, band.internal_notes]);

  function serverstandUebernehmen() {
    basisRef.current = {};
    setFelder(serverRef.current);
    setBeruehrt(new Set());
    setKonflikte(new Set());
    setServerAenderung(false);
    setZustand(null);
    setFehler(null);
  }

  function setze<K extends keyof Felder>(feld: K, wert: Felder[K]) {
    if (zustand === "speichert") {
      return;
    }
    if (!beruehrtRef.current.has(feld)) {
      basisRef.current[feld] = serverRef.current[feld];
    }
    setFelder((vorher) => ({ ...vorher, [feld]: wert }));
    setBeruehrt((vorher) => (vorher.has(feld) ? vorher : new Set(vorher).add(feld)));
    setZustand("entwurf");
  }

  async function absenden(ereignis: React.FormEvent) {
    ereignis.preventDefault();
    if (zustand === "speichert") {
      return;
    }
    const eingabe = nurBeruehrteFelder(felderRef.current, beruehrtRef.current);
    if (Object.keys(eingabe).length === 0) {
      setZustand("gespeichert");
      setFehler(null);
      return;
    }
    setZustand("speichert");
    setFehler(null);
    const standVorSpeichern = serverStandNrRef.current;
    try {
      const gespeichert = await onSpeichern(eingabe);
      if (gespeichert) {
        const antwort = ausBand(gespeichert);
        const stand =
          serverStandNrRef.current === standVorSpeichern
            ? antwort
            : FELD_SCHLUESSEL.reduce<Felder>(
                (ziel, feld) => ({
                  ...ziel,
                  [feld]: feld in eingabe ? antwort[feld] : serverRef.current[feld],
                }),
                { ...serverRef.current },
              );
        serverRef.current = stand;
        felderRef.current = stand;
        setFelder(stand);
      }
      basisRef.current = {};
      setBeruehrt(new Set());
      setKonflikte(new Set());
      setServerAenderung(false);
      setZustand("gespeichert");
    } catch (ursache) {
      setZustand("fehler");
      setFehler(behandleFehler(ursache, onSitzungAbgelaufen));
    }
  }

  if (!kannBearbeiten) {
    return (
      <section className="band-verwaltung-block" aria-labelledby="band-einstellungen-titel">
        <h3 id="band-einstellungen-titel">Band-Einstellungen</h3>
        <p className="hinweis">Nur Band-Owner ändern diese Angaben.</p>
        <dl className="band-daten">
          <dt>Name</dt>
          <dd>{band.name}</dd>
          <dt>Genre</dt>
          <dd>{band.genre || "Nicht gepflegt"}</dd>
          <dt>Ort / Proberaum</dt>
          <dd>{band.location || "Nicht gepflegt"}</dd>
          <dt>Beschreibung</dt>
          <dd>{band.description || "Nicht gepflegt"}</dd>
          <dt>Interne Band-Notiz</dt>
          <dd>{band.internal_notes || "Nicht gepflegt"}</dd>
        </dl>
      </section>
    );
  }

  return (
    <section className="band-verwaltung-block" aria-labelledby="band-einstellungen-titel">
      <h3 id="band-einstellungen-titel">Band-Einstellungen</h3>
      {serverAenderung ? (
        <div className="hinweis">
          <p role="status">
            Die Banddaten wurden im Hintergrund geändert. Dein Entwurf bleibt
            erhalten.
          </p>
          {konflikte.size > 0 ? (
            <p>
              Auch diese Felder wurden geändert:{" "}
              {Array.from(konflikte)
                .map((feld) => FELD_NAMEN[feld])
                .join(", ")}
              . Speichern überschreibt dort den Serverstand.
            </p>
          ) : null}
          <button
            type="button"
            disabled={speichert}
            onClick={serverstandUebernehmen}
          >
            Serverdaten übernehmen
          </button>
        </div>
      ) : null}
      <form onSubmit={absenden} className="band-einstellungen">
        <label>
          Name
          <input
            name="name"
            value={felder.name}
            required
            maxLength={120}
            disabled={speichert}
            onChange={(e) => setze("name", e.target.value)}
          />
        </label>
        <label>
          Genre
          <input
            name="genre"
            value={felder.genre}
            maxLength={120}
            disabled={speichert}
            onChange={(e) => setze("genre", e.target.value)}
          />
        </label>
        <label>
          Ort / Proberaum
          <input
            name="location"
            value={felder.location}
            maxLength={200}
            disabled={speichert}
            onChange={(e) => setze("location", e.target.value)}
          />
        </label>
        <label>
          Beschreibung
          <textarea
            name="description"
            value={felder.description}
            maxLength={2000}
            rows={3}
            disabled={speichert}
            onChange={(e) => setze("description", e.target.value)}
          />
        </label>
        <label>
          Interne Band-Notiz
          <textarea
            name="internal_notes"
            value={felder.internal_notes}
            maxLength={10000}
            rows={4}
            disabled={speichert}
            onChange={(e) => setze("internal_notes", e.target.value)}
          />
        </label>
        <button type="submit" disabled={zustand === "speichert"}>
          Einstellungen speichern
        </button>
        {zustand ? <StatusAnzeige zustand={zustand} /> : null}
        {fehler ? <p role="alert">{fehler}</p> : null}
      </form>
    </section>
  );
}
