import { useEffect, useRef } from "react";
import type { Anmerkung } from "../annotations/annotations";
import type { PdfVorrat, VorratStand } from "../documents/pdfLaden";
import { StagePdf } from "./StagePdf";
import { naechsterSongTitel, seitenAnzeige, songEintraege, type Ziel } from "./navigation";
import type { StageSitzung } from "./stage";
import { useBuehne } from "./useBuehne";
import { useBuehnenModus } from "./useBuehnenModus";

export type BuehnenAktion = "handover" | "takeover" | "resume" | "end";

interface StageAnsichtProps {
  bandId: string;
  sitzung: StageSitzung;
  verbindungId: string | null;
  verbunden: boolean;
  antwort: Record<string, unknown> | null;
  sende: (nachricht: Record<string, unknown>) => void;
  vorrat: PdfVorrat;
  annotationen: Anmerkung[];
  reserve: VorratStand | null;
  anmerkungsFehler?: number;
  onSitzungAktualisieren: () => void;
  onAktion: (aktion: BuehnenAktion, zielUserId?: number) => Promise<void>;
  onVerlassen: () => void;
}

function istEingabe(ziel: EventTarget | null): boolean {
  if (!(ziel instanceof HTMLElement)) {
    return false;
  }
  const tag = ziel.tagName.toLowerCase();
  return (
    ["input", "textarea", "select", "button", "a"].includes(tag) ||
    ziel.isContentEditable
  );
}

export function StageAnsicht({
  bandId,
  sitzung,
  verbindungId,
  verbunden,
  antwort,
  sende,
  vorrat,
  annotationen,
  reserve,
  anmerkungsFehler = 0,
  onSitzungAktualisieren,
  onAktion,
  onVerlassen,
}: StageAnsichtProps) {
  const behaelter = useRef<HTMLDivElement>(null);
  const buehne = useBuehne({
    sitzung,
    verbindungId,
    verbunden,
    sende,
    antwort,
    onSitzungAktualisieren,
  });
  const modus = useBuehnenModus(behaelter);
  const ziel: Ziel | null = buehne.ziel;
  const eintrag = ziel
    ? sitzung.sections
        .flatMap((abschnitt) => abschnitt.entries)
        .find((kandidat) => kandidat.uuid === ziel.entryUuid) ?? null
    : null;
  const seiten = ziel ? seitenAnzeige(sitzung, ziel) : null;
  const naechster = ziel ? naechsterSongTitel(sitzung, ziel) : null;
  const beendet = sitzung.state === "ended";
  const steuerbar = !beendet && buehne.istLeitung && verbunden;

  useEffect(() => {
    const beiTaste = (ereignis: KeyboardEvent) => {
      if (istEingabe(ereignis.target) || document.querySelector("dialog[open]")) {
        return;
      }
      if (ereignis.key === "ArrowRight" || ereignis.key === "PageDown") {
        ereignis.preventDefault();
        buehne.weiterBlaettern();
      } else if (ereignis.key === "ArrowLeft" || ereignis.key === "PageUp") {
        ereignis.preventDefault();
        buehne.zurueckBlaettern();
      }
    };
    window.addEventListener("keydown", beiTaste);
    return () => window.removeEventListener("keydown", beiTaste);
  }, [buehne]);

  const handoverZiele = sitzung.members;

  return (
    <div className="buehne" ref={behaelter}>
      <header className="buehne-kopf">
        <div>
          <p className="buehne-marke">Bühne</p>
          <h1>{eintrag?.song?.title ?? eintrag?.label ?? "Kein Song"}</h1>
          <p className="buehne-meta">
            {seiten ? `Seite ${seiten.seite} / ${seiten.gesamt}` : "ohne PDF"}
            {naechster ? ` · Als Nächstes: ${naechster}` : " · Letzter Song"}
          </p>
        </div>
        <div className="buehne-status" role="status" aria-live="polite">
          <span>{verbunden ? "verbunden" : "ohne Verbindung"}</span>
          <span>
            {buehne.istLeitung
              ? "Leitung"
              : beendet
                ? "Sitzung beendet"
                : "Teilnehmer"}
          </span>
          <span>{buehne.folgen ? "folgt" : "lokal"}</span>
          <span>
            {reserve
              ? reserve.bereit
                ? "Lesereserve bereit"
                : `Lesereserve ${reserve.vorbereitet}/${reserve.gesamt}`
              : "Lesereserve wird vorbereitet"}
          </span>
        </div>
      </header>

      {beendet ? (
        <p className="buehne-hinweis" role="alert">
          Die Sitzung ist beendet. Geladene Inhalte bleiben lesbar.{" "}
          <button type="button" onClick={onVerlassen}>
            Zurück zur Band
          </button>
        </p>
      ) : null}
      {buehne.hinweis ? (
        <p className="buehne-hinweis" role="alert">
          {buehne.hinweis}
        </p>
      ) : null}
      {reserve?.unvollstaendig ? (
        <p className="buehne-hinweis" role="status">
          Die Lesereserve ist unvollständig. Einige PDFs fehlen offline. Online
          bleiben sie erreichbar.
        </p>
      ) : null}
      {anmerkungsFehler > 0 ? (
        <p className="buehne-hinweis" role="status">
          {anmerkungsFehler} Anmerkungsstand/-stände konnten nicht geladen
          werden. Online erneut versuchen.
        </p>
      ) : null}

      <div className="buehne-inhalt">
        <StagePdf
          bandId={bandId}
          eintrag={eintrag}
          seite={ziel?.page ?? null}
          vorrat={vorrat}
          annotationen={annotationen}
        />

        <nav className="buehne-uebersicht" aria-label="Setlist-Übersicht">
          {sitzung.sections.map((abschnitt) => (
            <section key={abschnitt.uuid}>
              <h2>{abschnitt.name || abschnitt.kind}</h2>
              <ol>
                {abschnitt.entries.map((kandidat) => {
                  if (kandidat.entry_type !== "song") {
                    return (
                      <li key={kandidat.uuid} className="buehne-keinziel">
                        <span>{kandidat.label || kandidat.entry_type}</span>
                        <span className="buehne-art">kein Steuerziel</span>
                      </li>
                    );
                  }
                  const aktiv = kandidat.uuid === ziel?.entryUuid;
                  return (
                    <li key={kandidat.uuid}>
                      <button
                        type="button"
                        aria-pressed={aktiv}
                        onClick={() =>
                          buehne.navigiere({
                            entryUuid: kandidat.uuid,
                            page: kandidat.document ? 1 : null,
                          })
                        }
                        disabled={beendet}
                      >
                        {kandidat.song?.title ?? kandidat.label}
                        {kandidat.document ? null : (
                          <span className="buehne-art">ohne PDF</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          <p className="buehne-meta">
            {songEintraege(sitzung).length} Songs in der Sitzung
          </p>
        </nav>
      </div>

      <footer className="buehne-fuss">
        <button
          type="button"
          className="buehne-gross"
          onClick={buehne.zurueckBlaettern}
          disabled={beendet || buehne.ziel === null}
        >
          Zurück
        </button>
        <div className="buehne-schalter">
          <button
            type="button"
            aria-pressed={buehne.folgen}
            onClick={buehne.folgenUmschalten}
            disabled={beendet}
          >
            {buehne.folgen ? "Folgen aus" : "Folgen"}
          </button>
          <button type="button" onClick={buehne.standUebernehmen} disabled={beendet}>
            Aktuellen Stand übernehmen
          </button>
          {buehne.ausstehend ? <span role="status">wartet auf Bestätigung</span> : null}
        </div>
        <button
          type="button"
          className="buehne-gross"
          onClick={buehne.weiterBlaettern}
          disabled={beendet}
        >
          Weiter
        </button>
      </footer>

      <div className="buehne-aktionen">
        <button type="button" onClick={modus.vollbildUmschalten}>
          {modus.vollbild ? "Vollbild beenden" : "Vollbild"}
        </button>
        <button
          type="button"
          onClick={
            modus.wakeAktiv ? modus.wakeLockFreigeben : modus.wakeLockAnfordern
          }
        >
          {modus.wakeAktiv ? "Bildschirm darf schlafen" : "Bildschirm an"}
        </button>
        {modus.hinweis ? <span role="status">{modus.hinweis}</span> : null}
        {!beendet && sitzung.actions.can_takeover ? (
          <button type="button" onClick={() => void onAktion("takeover")}>
            Leitung übernehmen
          </button>
        ) : null}
        {!beendet && sitzung.actions.can_resume ? (
          <button type="button" onClick={() => void onAktion("resume")}>
            Leitung zurückholen
          </button>
        ) : null}
        {!beendet && sitzung.actions.can_handover ? (
          <label>
            Leitung übergeben
            <select
              defaultValue=""
              onChange={(ereignis) => {
                const wert = Number(ereignis.target.value);
                if (wert) {
                  void onAktion("handover", wert);
                }
                ereignis.target.value = "";
              }}
            >
              <option value="">Ziel wählen</option>
              {handoverZiele.map((mitglied) => (
                <option key={mitglied.user_id} value={mitglied.user_id}>
                  {mitglied.display_name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {!beendet && sitzung.actions.can_end ? (
          <button type="button" onClick={() => void onAktion("end")}>
            Sitzung beenden
          </button>
        ) : null}
        <span className="buehne-meta" data-steuerbar={steuerbar ? "ja" : "nein"}>
          {steuerbar
            ? "Steuerung aktiv"
            : verbunden
              ? "Nur lokale Navigation"
              : "Offline: nur lokale Navigation"}
        </span>
      </div>
    </div>
  );
}
