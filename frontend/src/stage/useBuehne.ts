import { useCallback, useEffect, useRef, useState } from "react";
import { aktuellesZiel, weiter, zurueck, type Ziel } from "./navigation";
import type { StageSitzung } from "./stage";

interface Optionen {
  sitzung: StageSitzung;
  verbindungId: string | null;
  verbunden: boolean;
  sende: (nachricht: Record<string, unknown>) => void;
  antwort: Record<string, unknown> | null;
  onSitzungAktualisieren: () => void;
}

interface BuehnenZustand {
  ziel: Ziel | null;
  folgen: boolean;
  istLeitung: boolean;
  ausstehend: boolean;
  hinweis: string | null;
  navigiere: (ziel: Ziel | null) => void;
  weiterBlaettern: () => void;
  zurueckBlaettern: () => void;
  folgenUmschalten: () => void;
  standUebernehmen: () => void;
}

const ANTWORT_TIMEOUT_MS = 10_000;

function neueKennung(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function gleichesZiel(a: Ziel | null, b: Ziel | null): boolean {
  return a?.entryUuid === b?.entryUuid && a?.page === b?.page;
}

export function useBuehne({
  sitzung,
  verbunden,
  sende,
  antwort,
  onSitzungAktualisieren,
}: Optionen): BuehnenZustand {
  const [ziel, setZiel] = useState<Ziel | null>(() => aktuellesZiel(sitzung));
  const [folgen, setFolgen] = useState(false);
  const [ausstehend, setAusstehend] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const generationRef = useRef(sitzung.generation);
  const nummerRef = useRef(Math.max(sitzung.last_number + 1, 1));
  const antwortRef = useRef<Record<string, unknown> | null>(null);
  const ausstehendRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const sendeRef = useRef(sende);
  const verbundenRef = useRef(verbunden);
  const aktualisierenRef = useRef(onSitzungAktualisieren);
  sendeRef.current = sende;
  verbundenRef.current = verbunden;
  aktualisierenRef.current = onSitzungAktualisieren;
  // Der zuletzt gesendete Zielstand und ein während eines laufenden Befehls
  // gewünschter Zielstand. Ohne den Wunsch geht ein zweiter Schritt verloren,
  // wenn er im Roundtrip-Fenster des ersten kommt.
  const gesendetRef = useRef<Ziel | null>(null);
  const wunschRef = useRef<Ziel | null>(null);
  const navigiereRef = useRef<(neu: Ziel | null) => void>(() => {});

  const istLeitung = Boolean(
    sitzung.state === "active" && sitzung.actions.can_control,
  );

  function antwortTimerLoeschen() {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  useEffect(() => {
    const aktuell = aktuellesZiel(sitzung);
    if (folgen) {
      setZiel(aktuell);
    }
    if (generationRef.current !== sitzung.generation) {
      generationRef.current = sitzung.generation;
      nummerRef.current = Math.max(sitzung.last_number + 1, 1);
      ausstehendRef.current = false;
      setAusstehend(false);
      antwortTimerLoeschen();
    } else {
      // Eine verlorene Bestätigung darf den Zähler nicht dauerhaft blockieren.
      nummerRef.current = Math.max(
        nummerRef.current,
        sitzung.last_number + 1,
      );
    }
    if (sitzung.state === "ended") {
      setFolgen(false);
      setAusstehend(false);
      ausstehendRef.current = false;
      antwortTimerLoeschen();
    }
    // Nur ein neuer bestätigter Sitzungsstand bewegt den lokalen Stand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitzung.revision, sitzung.generation, sitzung.last_number, sitzung.state, folgen]);

  useEffect(() => {
    if (!antwort || antwort === antwortRef.current) {
      return;
    }
    antwortRef.current = antwort;
    if (antwort.type !== "stage.result") {
      return;
    }
    const antwortSitzung = Number(antwort.session_id);
    if (Number.isFinite(antwortSitzung) && antwortSitzung !== sitzung.id) {
      return;
    }
    if (antwort.status === "confirmed") {
      antwortTimerLoeschen();
      ausstehendRef.current = false;
      setAusstehend(false);
      const bestaetigteNummer = Number(antwort.number);
      if (Number.isFinite(bestaetigteNummer)) {
        nummerRef.current = bestaetigteNummer + 1;
      }
      setHinweis(null);
      // Während des Befehls kam ein weiterer Schritt: jetzt nachsenden.
      const offen = wunschRef.current;
      wunschRef.current = null;
      if (offen && !gleichesZiel(offen, gesendetRef.current)) {
        navigiereRef.current(offen);
      }
      return;
    }
    if (antwort.status === "rejected") {
      antwortTimerLoeschen();
      ausstehendRef.current = false;
      setAusstehend(false);
      wunschRef.current = null;
      const abgelehnteNummer = Number(antwort.number);
      if (Number.isFinite(abgelehnteNummer)) {
        // Die Nummer wurde nicht verbraucht.
        nummerRef.current = abgelehnteNummer;
      }
      const grund = String(antwort.reason ?? "Der Befehl wurde abgelehnt.");
      setHinweis(grund);
      if (
        grund.includes("Generation") ||
        grund.includes("leitet") ||
        grund.includes("beendet") ||
        grund.includes("Nummer") ||
        grund.includes("Verbindung")
      ) {
        aktualisierenRef.current();
      }
      return;
    }
    antwortTimerLoeschen();
    ausstehendRef.current = false;
    setAusstehend(false);
    setHinweis("Der Befehl ist unklar. Der aktuelle Stand wird geladen.");
    aktualisierenRef.current();
  }, [antwort, sitzung.id]);

  const navigiere = useCallback(
    (neu: Ziel | null) => {
      if (!neu || sitzung.state !== "active") {
        return;
      }
      setZiel(neu);
      setFolgen(false);
      setHinweis(null);
      if (!istLeitung || !verbundenRef.current) {
        return;
      }
      if (ausstehendRef.current) {
        // Befehl läuft noch: Wunsch merken, Bestätigung sendet nach.
        wunschRef.current = neu;
        return;
      }
      wunschRef.current = null;
      gesendetRef.current = neu;
      ausstehendRef.current = true;
      setAusstehend(true);
      sendeRef.current({
        type: "stage.command",
        session_id: sitzung.id,
        generation: generationRef.current,
        number: nummerRef.current,
        command_id: neueKennung(),
        command: {
          kind: "goto",
          entry_uuid: neu.entryUuid,
          page: neu.page,
        },
      });
      antwortTimerLoeschen();
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        if (!ausstehendRef.current) {
          return;
        }
        ausstehendRef.current = false;
        setAusstehend(false);
        const offen = wunschRef.current;
        wunschRef.current = null;
        setHinweis("Keine Antwort auf den Steuerbefehl. Der Stand wird neu geladen.");
        aktualisierenRef.current();
        if (offen && !gleichesZiel(offen, gesendetRef.current)) {
          navigiereRef.current(offen);
        }
      }, ANTWORT_TIMEOUT_MS);
    },
    [istLeitung, sitzung.id, sitzung.state],
  );
  navigiereRef.current = navigiere;

  const weiterBlaettern = useCallback(() => {
    if (ziel) {
      navigiere(weiter(sitzung, ziel));
    }
  }, [navigiere, sitzung, ziel]);

  const zurueckBlaettern = useCallback(() => {
    if (ziel) {
      navigiere(zurueck(sitzung, ziel));
    }
  }, [navigiere, sitzung, ziel]);

  const standUebernehmen = useCallback(() => {
    setZiel(aktuellesZiel(sitzung));
  }, [sitzung]);

  const folgenUmschalten = useCallback(() => {
    setFolgen((vorher) => {
      if (!vorher) {
        setZiel(aktuellesZiel(sitzung));
      }
      return !vorher;
    });
  }, [sitzung]);

  useEffect(
    () => () => {
      antwortTimerLoeschen();
    },
    [],
  );

  return {
    ziel,
    folgen,
    istLeitung,
    ausstehend,
    hinweis,
    navigiere,
    weiterBlaettern,
    zurueckBlaettern,
    folgenUmschalten,
    standUebernehmen,
  };
}
