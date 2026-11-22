import { SchriftAuswahl } from "./SchriftAuswahl";
import {
  forwardRef,
  useImperativeHandle,
  useState,
  useEffect,
  type ForwardedRef,
} from "react";
import { behandleFehler, fehlerText } from "../api/client";
import {
  FARBEN,
  farbName,
  type Anmerkung,
  type AnmerkungsFarbe,
  type AnmerkungsSichtbarkeit,
} from "./annotations";
import { gueltig } from "./geometrie";
import type { Geometrie } from "./annotations";
import { CrdtTextFeld } from "../collaboration/CrdtTextFeld";
import type { TextAntwort, TextStand } from "../collaboration/texte";
import { GeometrieFelder } from "./GeometrieFelder";

export interface FormularWerte {
  page_number: number;
  color: AnmerkungsFarbe;
  visibility: AnmerkungsSichtbarkeit;
  geometry: Geometrie;
  text: string;
  font_size: number | null;
  text_live?: boolean;
}

export interface TextSync {
  stand: TextStand;
  sende: (update: string, epoch: number) => Promise<TextAntwort>;
}

export type SpeicherErgebnis =
  | { ok: true }
  | { ok: false; fehler: string };

export interface FormularHandle {
  speichere: () => Promise<SpeicherErgebnis>;
  istGeaendert: () => boolean;
}

interface FormularProps {
  bewegung?: Geometrie | null;
  art: "neu" | "bearbeiten";
  anmerkung: Anmerkung | null;
  geloescht?: boolean;
  start: FormularWerte | null;
  seiten: number;
  textSync?: TextSync | null;
  onSpeichern: (werte: FormularWerte) => Promise<void>;
  onLoeschen?: () => Promise<void>;
  onAbbrechen: () => void;
  onDirtyChange?: (geaendert: boolean) => void;
  onSitzungAbgelaufen?: () => void;
}

function FormularInner(
  {
    bewegung,
    art,
    anmerkung,
    geloescht = false,
    start,
    seiten,
    textSync = null,
    onSpeichern,
    onLoeschen,
    onAbbrechen,
    onDirtyChange,
    onSitzungAbgelaufen,
  }: FormularProps,
  ref: ForwardedRef<FormularHandle>,
) {
  const basis = anmerkung ?? start;
  const [text, setText] = useState(anmerkung?.text ?? start?.text ?? "");
  const [farbe, setFarbe] = useState<AnmerkungsFarbe>(
    anmerkung?.color ?? start?.color ?? "gelb",
  );
  const [sichtbarkeit, setSichtbarkeit] = useState<AnmerkungsSichtbarkeit>(
    anmerkung?.visibility ?? start?.visibility ?? "private",
  );
  const [groesse, setGroesse] = useState<number>(
    anmerkung?.font_size ?? start?.font_size ?? 0.0225,
  );
  const [geometrie, setGeometrie] = useState<Geometrie>(
    anmerkung?.geometry ??
      start?.geometry ?? { x: 0.1, y: 0.1, width: 0.2, height: 0.05 },
  );
  const [seite, setSeite] = useState(anmerkung?.page_number ?? start?.page_number ?? 1);
  const [dirty, setDirty] = useState(art === "neu");
  const [fehler, setFehler] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);
  const [loeschenBestaetigen, setLoeschenBestaetigen] = useState(false);
  const artWert = anmerkung?.kind ?? "text";
  const darfSichtbarkeit = art === "neu" || Boolean(anmerkung?.can_change_visibility);

  function aendern(neu: Partial<FormularWerte>) {
    if (neu.text !== undefined) setText(neu.text);
    if (neu.color !== undefined) setFarbe(neu.color);
    if (neu.visibility !== undefined) setSichtbarkeit(neu.visibility);
    if (neu.font_size !== undefined && neu.font_size !== null) setGroesse(neu.font_size);
    if (neu.geometry !== undefined) setGeometrie(neu.geometry);
    if (neu.page_number !== undefined) setSeite(neu.page_number);
    setDirty(true);
    onDirtyChange?.(true);
    setFehler(null);
  }

  useEffect(() => {
    if (bewegung) aendern({ geometry: bewegung });
  }, [bewegung]);

  async function speichern(): Promise<SpeicherErgebnis> {
    if (geloescht) {
      const meldung = "Diese Anmerkung wurde inzwischen gelöscht.";
      setFehler(meldung);
      return { ok: false, fehler: meldung };
    }
    if (!gueltig(geometrie) || seite < 1 || seite > seiten) {
      const meldung = "Rechteck und Seite müssen gültig sein.";
      setFehler(meldung);
      return { ok: false, fehler: meldung };
    }
    if (artWert === "text" && !text.trim()) {
      const meldung = "Bitte einen Text eintragen.";
      setFehler(meldung);
      return { ok: false, fehler: meldung };
    }
    if (artWert === "text" && text.trim().length > 2000) {
      const meldung = "Höchstens 2.000 Zeichen.";
      setFehler(meldung);
      return { ok: false, fehler: meldung };
    }
    setSpeichert(true);
    setFehler(null);
    try {
      await onSpeichern({
        page_number: seite,
        color: farbe,
        visibility: sichtbarkeit,
        geometry: geometrie,
        text: artWert === "text" ? text.trim() : "",
        font_size: artWert === "text" ? groesse : null,
        text_live: Boolean(textSync),
      });
      setDirty(false);
      onDirtyChange?.(false);
      return { ok: true };
    } catch (ursache) {
      const meldung =
        behandleFehler(ursache, onSitzungAbgelaufen) ?? fehlerText(ursache);
      setFehler(meldung);
      return { ok: false, fehler: meldung };
    } finally {
      setSpeichert(false);
    }
  }

  useImperativeHandle(ref, () => ({
    speichere: speichern,
    istGeaendert: () => dirty,
  }));

  async function loeschen() {
    if (geloescht || !onLoeschen) {
      return;
    }
    setSpeichert(true);
    setFehler(null);
    try {
      await onLoeschen();
      setDirty(false);
      onDirtyChange?.(false);
    } catch (ursache) {
      setFehler(behandleFehler(ursache, onSitzungAbgelaufen) ?? fehlerText(ursache));
    } finally {
      setSpeichert(false);
      setLoeschenBestaetigen(false);
    }
  }

  if (!basis) {
    return null;
  }

  return (
    <section className="anmerkung-formular" aria-labelledby="anmerkung-formular-titel">
      <h4 id="anmerkung-formular-titel">
        {art === "neu" ? "Neue Textanmerkung" : "Anmerkung bearbeiten"}
      </h4>
      {artWert === "text" && textSync ? (
        <CrdtTextFeld
          label="Text"
          wert={text}
          stand={textSync.stand}
          aktiv
          senden={textSync.sende}
          onWert={(wert) => aendern({ text: wert })}
          onStand={(wert) => setText(wert)}
          maxLength={2000}
          disabled={speichert}
          mehrzeilig
          rows={3}
        />
      ) : artWert === "text" ? (
        <label>
          Text
          <textarea
            value={text}
            maxLength={2000}
            autoFocus={art === "neu"}
            disabled={speichert}
            onChange={(ereignis) => aendern({ text: ereignis.target.value })}
          />
        </label>
      ) : (
        <p className="songmeta">Marker haben keinen Text.</p>
      )}
      <div className="anmerkung-formular-meta">
        <label>
          Farbe
          <select
            value={farbe}
            disabled={speichert}
            onChange={(ereignis) => aendern({ color: ereignis.target.value as AnmerkungsFarbe })}
          >
            {FARBEN.map((wert) => (
              <option key={wert} value={wert}>
                {farbName(wert)}
              </option>
            ))}
          </select>
        </label>
        {artWert === "text" ? <SchriftAuswahl wert={groesse} disabled={speichert} onChange={font_size => aendern({font_size})} /> : null}
        <label>
          Sichtbarkeit
          <select
            value={sichtbarkeit}
            disabled={speichert || !darfSichtbarkeit}
            onChange={(ereignis) =>
              aendern({ visibility: ereignis.target.value as AnmerkungsSichtbarkeit })
            }
          >
            <option value="private">Persönlich</option>
            <option value="band">Band</option>
          </select>
        </label>
      </div>
      {!darfSichtbarkeit ? (
        <p className="anmerkung-hinweis">
          Nur der Autor ändert die Sichtbarkeit. Du bearbeitest den bandweiten
          Inhalt.
        </p>
      ) : null}
      {sichtbarkeit === "band" ? (
        <p className="anmerkung-hinweis">
          Alle aktuellen Bandmitglieder sehen diesen Inhalt. Der Autor bleibt
          eingetragen.
        </p>
      ) : null}
      <GeometrieFelder
        geometrie={geometrie}
        seite={seite}
        seiten={seiten}
        disabled={speichert}
        onGeometrie={(neu) => aendern({ geometry: neu })}
        onSeite={(neu) => aendern({ page_number: neu })}
      />
      {geloescht ? (
        <p role="alert">
          Diese Anmerkung wurde inzwischen gelöscht. Dein Entwurf bleibt erhalten.
        </p>
      ) : null}
      {fehler ? <p role="alert">{fehler}</p> : null}
      <div className="anmerkung-aktionen">
        <button type="button" onClick={speichern} disabled={speichert || geloescht}>
          {speichert ? "Speichert …" : "Anmerkung speichern"}
        </button>
        <button type="button" onClick={onAbbrechen} disabled={speichert}>
          Abbrechen
        </button>
        {onLoeschen ? (
          loeschenBestaetigen ? (
            <>
              <button type="button" onClick={loeschen} disabled={speichert || geloescht}>
                Löschen bestätigen
              </button>
              <button type="button" onClick={() => setLoeschenBestaetigen(false)}>
                Löschen abbrechen
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={geloescht}
              onClick={() => setLoeschenBestaetigen(true)}
            >
              Anmerkung löschen
            </button>
          )
        ) : null}
      </div>
    </section>
  );
}

export const AnmerkungsFormular = forwardRef(FormularInner);
