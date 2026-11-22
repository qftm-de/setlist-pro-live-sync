import type { ReactNode } from "react";
import type { BandsZustand, KonfigurationZustand, SitzungZustand } from "../App.types";
import type { Band } from "../bands/bands";
import { EinladungAnsicht } from "../bands/EinladungAnsicht";
import type { BandVerwaltungAdapter } from "../bands/verwaltung";
import type { AppRoute } from "../routing";
import { AnmeldeFormular } from "../ui/AnmeldeFormular";
import { BandFormular } from "../ui/BandFormular";
import { FehlerAnzeige } from "../ui/FehlerAnzeige";
import { StatusAnzeige } from "../ui/StatusAnzeige";

interface StartInhaltProps {
  konfiguration: KonfigurationZustand;
  sitzung: SitzungZustand;
  bands: BandsZustand;
  sichtbareBands: Band[] | null;
  route: AppRoute;
  verwaltungAdapter: BandVerwaltungAdapter;
  sitzungAbgelaufen: () => void;
  einladungAngenommen: (bandId: string, quellPfad: string) => void | Promise<void>;
  pfad: string;
  kontoZeile: ReactNode;
  direktFehler: string | null;
  bandListenFehler: string | null;
  erneutVersuchen: () => void;
  alleBandsEntsperren: () => void;
  setBandListenFehler: (wert: string | null) => void;
  bandAnlegen: (name: string) => Promise<void>;
  anmelden: (benutzer: string, passwort: string) => Promise<void>;
}

export function startInhalt({
  konfiguration,
  sitzung,
  bands,
  sichtbareBands,
  route,
  verwaltungAdapter,
  sitzungAbgelaufen,
  einladungAngenommen,
  pfad,
  kontoZeile,
  direktFehler,
  bandListenFehler,
  erneutVersuchen,
  alleBandsEntsperren,
  setBandListenFehler,
  bandAnlegen,
  anmelden,
}: StartInhaltProps): ReactNode | null {
  if (konfiguration.status === "laedt") {
    return <StatusAnzeige zustand="laedt" />;
  }
  if (konfiguration.status === "fehler") {
    return <FehlerAnzeige text={konfiguration.fehler} onWiederholen={erneutVersuchen} />;
  }
  if (route.bereich === "invite") {
    return route.inviteToken ? (
      <EinladungAnsicht
        token={route.inviteToken}
        verwaltung={verwaltungAdapter}
        onSitzungAbgelaufen={sitzungAbgelaufen}
        onBeigetreten={(neueBandId) => einladungAngenommen(neueBandId, pfad)}
      />
    ) : (
      <FehlerAnzeige text="Dieser Einladungslink ist ungültig oder abgelaufen." />
    );
  }
  if (sitzung.status === "laedt") {
    return <StatusAnzeige zustand="laedt" />;
  }
  if (sitzung.status === "fehler") {
    return <FehlerAnzeige text={sitzung.fehler} onWiederholen={erneutVersuchen} />;
  }
  if (sitzung.status === "anonym") {
    return <AnmeldeFormular onAnmelden={anmelden} />;
  }
  if (bands.status === "laedt") {
    return <StatusAnzeige zustand="laedt" />;
  }
  if (bands.status === "fehler") {
    return (
      <>
        {kontoZeile}
        <FehlerAnzeige text={bands.fehler} onWiederholen={erneutVersuchen} />
      </>
    );
  }
  if (bands.bands.length === 0) {
    return (
      <>
        {kontoZeile}
        {direktFehler ? <FehlerAnzeige text={direktFehler} /> : null}
        <p>Noch keine Band. Lege die erste an.</p>
        <BandFormular onAnlegen={bandAnlegen} onSitzungAbgelaufen={sitzungAbgelaufen} />
      </>
    );
  }
  if (sichtbareBands?.length === 0) {
    return (
      <>
        {kontoZeile}
        <FehlerAnzeige
          text={bandListenFehler ?? "Diese Band ist für dich nicht sichtbar."}
          onWiederholen={() => {
            alleBandsEntsperren();
            setBandListenFehler(null);
            erneutVersuchen();
          }}
        />
      </>
    );
  }
  return null;
}
