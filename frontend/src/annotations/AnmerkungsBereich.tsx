import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { behandleFehler, fehlerText, istApiFehler } from "../api/client";
import type { FormularHandle, FormularWerte } from "./AnmerkungsFormular";
import { AnmerkungsFormulare } from "./AnmerkungsFormulare";
import { AnmerkungsListe } from "./AnmerkungsListe";
import { AnmerkungsStatus } from "./AnmerkungsStatus";
import { AnmerkungsWerkzeuge } from "./AnmerkungsWerkzeuge";
import { EntwurfsDialog } from "./EntwurfsDialog";
import {
  neueAnmerkungsId,
  type Anmerkung,
  type AnmerkungAdapter,
  type AnmerkungsFarbe,
  type AnmerkungsSichtbarkeit,
  type Entwurf,
  type Schriftgroesse,
} from "./annotations";
import type { AnmerkungsWerkzeug } from "./PdfAnmerkungsEbene";
import { useAnmerkungen } from "./useAnmerkungen";
import "./annotations.css";
export interface AnmerkungsBereichHandle { pruefeWechsel: (weiter: () => void) => void; }

interface BereichProps {
  bandId: string;
  songId: number;
  versionId: number;
  seiten: number;
  daten: ArrayBuffer;
  titel: string;
  Viewer: React.ComponentType<import("../documents/PdfViewer").PdfViewerProps>;
  adapter: AnmerkungAdapter;
  aktualisierung?: number;
  onSitzungAbgelaufen?: () => void;
  registriereWaechter?: (waechter: ((weiter: () => void) => void) | null) => void;
}

export const AnmerkungsBereich = forwardRef<AnmerkungsBereichHandle, BereichProps>(
  function AnmerkungsBereich(
    {
      bandId,
      songId,
      versionId,
      seiten,
      daten,
      titel,
      Viewer,
      adapter,
      aktualisierung = 0,
      onSitzungAbgelaufen,
      registriereWaechter,
    },
    ref,
  ) {
    const { liste, laedt, fehler, erstelle, aendere, loesche, neuLaden } =
      useAnmerkungen(adapter, bandId, songId, versionId, onSitzungAbgelaufen);
    const [werkzeug, setWerkzeug] = useState<AnmerkungsWerkzeug>("lesen");
    const [farbe, setFarbe] = useState<AnmerkungsFarbe>("gelb");
    const [schriftgroesse, setSchriftgroesse] = useState<Schriftgroesse>(0.0225);
    const [ebeneEigene, setEbeneEigene] = useState(true);
    const [ebeneBand, setEbeneBand] = useState(true);
    const [seite, setSeite] = useState(1);
    const [ausgewaehltId, setAusgewaehltId] = useState<number | null>(null);
    const [entwurf, setEntwurf] = useState<Entwurf | null>(null);
    const [konflikt, setKonflikt] = useState(false);
    const [aktionsFehler, setAktionsFehler] = useState<string | null>(null);
    const [wechsel, setWechsel] = useState<{ weiter: () => void } | null>(null);
    const [formDirty, setFormDirty] = useState(false);
    const [sprung, setSprung] = useState<{ ziel: number; token: number } | null>(null);
    const formRef = useRef<FormularHandle>(null);
    const letzteVersion = useRef(versionId);
    const markeRef = useRef(aktualisierung);
    const hatEntwurf = Boolean(entwurf) || formDirty;

    useEffect(() => {
      if (aktualisierung === markeRef.current) {
        return;
      }
      markeRef.current = aktualisierung;
      neuLaden();
    }, [aktualisierung, neuLaden]);

    useEffect(() => {
      if (!hatEntwurf) {
        return;
      }
      const waechter = (ereignis: BeforeUnloadEvent) => {
        ereignis.preventDefault();
        ereignis.returnValue = "";
      };
      window.addEventListener("beforeunload", waechter);
      return () => window.removeEventListener("beforeunload", waechter);
    }, [hatEntwurf]);

    useEffect(() => {
      if (letzteVersion.current === versionId) {
        return;
      }
      letzteVersion.current = versionId;
      setAusgewaehltId(null);
      setEntwurf(null);
      setKonflikt(false);
      setAktionsFehler(null);
      setWechsel(null);
      setFormDirty(false);
      setSeite(1);
    }, [versionId]);

    function textSyncFuer(anmerkung: Anmerkung) {
    if (!adapter.sendeText || anmerkung.kind !== "text") {
      return null;
    }
    const senden = adapter.sendeText;
    return {
      stand: {
        object_type: "annotation" as const,
        object_uuid: anmerkung.uuid,
        field: "text" as const,
        epoch: anmerkung.text_epoch,
        revision: anmerkung.revision,
        state: anmerkung.text_state,
      },
      sende: (update: string, epoch: number) =>
        senden(bandId, songId, versionId, anmerkung.id, {
          epoch,
          generation: anmerkung.permission_generation,
          update,
        }),
    };
  }

  const sichtbar = useMemo(
      () =>
        liste.filter((anmerkung) =>
          anmerkung.visibility === "band" ? ebeneBand : ebeneEigene,
        ),
      [ebeneBand, ebeneEigene, liste],
    );
    const ausgewaehlt = liste.find((eintrag) => eintrag.id === ausgewaehltId) ?? null;
    const [letzteAuswahl, setLetzteAuswahl] = useState<Anmerkung | null>(null);
    const auswahlRef = useRef<number | null>(null);
    const revisionRef = useRef<number | null>(null);

    useEffect(() => {
      if (ausgewaehltId !== auswahlRef.current) {
        auswahlRef.current = ausgewaehltId;
        revisionRef.current = ausgewaehlt?.revision ?? null;
        setLetzteAuswahl(ausgewaehlt ?? null);
        return;
      }
      if (ausgewaehlt) {
        // Die angezeigte Fassung aktualisiert sich, die Bearbeitungsrevision
        // bleibt beim Öffnen eingefroren.
        setLetzteAuswahl(ausgewaehlt);
      }
    }, [ausgewaehlt, ausgewaehltId]);

    const ersatz =
      ausgewaehltId !== null && ausgewaehlt === null ? letzteAuswahl : null;

    function pruefeWechsel(weiter: () => void) {
      if (!hatEntwurf) {
        weiter();
        return;
      }
      setWechsel({ weiter });
    }

    useImperativeHandle(ref, () => ({ pruefeWechsel }));

    useEffect(() => {
      registriereWaechter?.(pruefeWechsel);
      return () => registriereWaechter?.(null);
    });

    async function speichern(werte: FormularWerte) {
      try {
        if (entwurf) {
          const neu = await erstelle({
            uuid: entwurf.uuid,
            page_number: werte.page_number,
            kind: "text",
            visibility: werte.visibility,
            geometry: werte.geometry,
            color: werte.color,
            text: werte.text,
            font_size: werte.font_size,
          });
          setEntwurf(null);
          setAusgewaehltId(neu.id);
        } else if (ausgewaehlt) {
          const aenderung = { ...werte };
          if (!ausgewaehlt.can_change_visibility) {
            // Sichtbarkeit bleibt beim Autor. Ein mitgeschicktes Feld würde
            // serverseitig als fremde Änderung abgelehnt.
            delete (aenderung as { visibility?: AnmerkungsSichtbarkeit }).visibility;
          }
          // Der sichtbare Text ist der zusammengeführte Stand. Der
          // ausdrückliche Speichern-Klick ersetzt ihn per REST und startet
          // damit eine neue Epoche; laufende alte Updates werden abgelehnt.
          delete aenderung.text_live;
          await aendere(
            ausgewaehlt.id,
            revisionRef.current ?? ausgewaehlt.revision,
            aenderung,
          );
          setAusgewaehltId(null);
        }
        setKonflikt(false);
        setAktionsFehler(null);
      } catch (ursache) {
        if (istApiFehler(ursache) && ursache.code === "conflict") {
          setKonflikt(true);
        }
        throw ursache;
      }
    }

    async function loeschen() {
      if (!ausgewaehlt) {
        return;
      }
      await loesche(
        ausgewaehlt.id,
        revisionRef.current ?? ausgewaehlt.revision,
      );
      setAusgewaehltId(null);
    }

    async function markierung(geometrie: Anmerkung["geometry"]) {
      setAktionsFehler(null);
      try {
        await erstelle({
          uuid: neueAnmerkungsId(),
          page_number: seite,
          kind: "marker",
          visibility: "private",
          geometry: geometrie,
          color: farbe,
          text: "",
          font_size: null,
        });
      } catch (ursache) {
        const text = behandleFehler(ursache, onSitzungAbgelaufen);
        setAktionsFehler(text ?? fehlerText(ursache));
      }
    }

    function textPlatzieren(geometrie: Anmerkung["geometry"]) {
      setAusgewaehltId(null);
      setEntwurf({
        uuid: neueAnmerkungsId(),
        page_number: seite,
        geometry: geometrie,
      });
    }

    function bevorSeiteWechsel(ziel: number): boolean {
      if (!hatEntwurf) {
        return true;
      }
      setWechsel({
        weiter: () => setSprung({ ziel, token: Date.now() }),
      });
      return false;
    }

    async function speichernUndWeiter() {
      const erfolg = await formRef.current?.speichere();
      if (!erfolg) {
        return;
      }
      const ziel = wechsel;
      setWechsel(null);
      setEntwurf(null);
      setAusgewaehltId(null);
      setFormDirty(false);
      ziel?.weiter();
    }

    function verwerfenUndWeiter() {
      const ziel = wechsel;
      setWechsel(null);
      setEntwurf(null);
      setAusgewaehltId(null);
      setFormDirty(false);
      ziel?.weiter();
    }

    function serverStandLaden() {
      neuLaden();
      setKonflikt(false);
      setAusgewaehltId(null);
      setEntwurf(null);
    }

    return (
      <section className="anmerkungs-bereich" aria-labelledby="anmerkungen-titel">
        <h3 id="anmerkungen-titel">Anmerkungen zu dieser Version</h3>
        <AnmerkungsWerkzeuge
          werkzeug={werkzeug}
          setWerkzeug={setWerkzeug}
          farbe={farbe}
          setFarbe={setFarbe}
          schriftgroesse={schriftgroesse}
          setSchriftgroesse={setSchriftgroesse}
          ebeneEigene={ebeneEigene}
          setEbeneEigene={setEbeneEigene}
          ebeneBand={ebeneBand}
          setEbeneBand={setEbeneBand}
          onNeuerText={() =>
            textPlatzieren({ x: 0.2, y: 0.2, width: 0.3, height: 0.08 })
          }
          onNeuerMarker={() =>
            void markierung({ x: 0.2, y: 0.2, width: 0.2, height: 0.2 })
          }
        />
        <AnmerkungsStatus
          fehler={fehler}
          laedt={laedt}
          aktionsFehler={aktionsFehler}
          konflikt={konflikt}
          onServerStand={serverStandLaden}
        />
        <Viewer
          daten={daten}
          titel={titel}
          annotationen={sichtbar}
          werkzeug={werkzeug}
          ausgewaehlteId={ausgewaehltId}
          onMarkierung={markierung}
          onTextPlatzieren={textPlatzieren}
          onAnmerkungAuswahl={(id) => {
            setEntwurf(null);
            setWerkzeug("lesen");
            setAusgewaehltId(id);
          }}
          onBevorSeiteWechsel={bevorSeiteWechsel}
          onSeiteGeaendert={setSeite}
          seitenSprung={sprung}
        />
        <AnmerkungsListe
          liste={sichtbar}
          ausgewaehlteId={ausgewaehltId}
          onAuswahl={(id) => {
            setEntwurf(null);
            setWerkzeug("lesen");
            setAusgewaehltId(id);
          }}
        />
        <AnmerkungsFormulare
          entwurf={entwurf}
          ausgewaehlt={ausgewaehlt}
          ersatz={ersatz}
          seiten={seiten}
          farbe={farbe}
          schriftgroesse={schriftgroesse}
          formRef={formRef}
          textSyncFuer={textSyncFuer}
          onSpeichern={speichern}
          onLoeschen={loeschen}
          onAbbrechenEntwurf={() => {
            setEntwurf(null);
            setFormDirty(false);
          }}
          onAbbrechenAuswahl={() => {
            setAusgewaehltId(null);
            setFormDirty(false);
          }}
          onDirtyChange={setFormDirty}
          onSitzungAbgelaufen={onSitzungAbgelaufen}
        />
        {wechsel ? (
          <EntwurfsDialog
            onSpeichern={speichernUndWeiter}
            onVerwerfen={verwerfenUndWeiter}
            onAbbrechen={() => setWechsel(null)}
          />
        ) : null}
      </section>
    );
  },
);