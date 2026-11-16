import type { ReactNode } from "react";
import { bereichAktiv } from "../routing";

const BEREICHE = [
  { pfad: "/", name: "Start" },
  { pfad: "/songs", name: "Songs" },
  { pfad: "/setlists", name: "Setlists" },
  { pfad: "/gigs", name: "Auftritte" },
];

interface AppShellProps {
  titel: string;
  pfad: string;
  communityUrl?: string | null;
  buehne?: boolean;
  onNavigieren: (pfad: string) => void;
  children: ReactNode;
}

export function AppShell({
  titel,
  pfad,
  communityUrl,
  buehne = false,
  onNavigieren,
  children,
}: AppShellProps) {
  if (buehne) {
    return (
      <div className="huelle huelle-buehne">
        <header className="kopf kopf-buehne">
          <strong>{titel}</strong>
          <button type="button" onClick={() => onNavigieren("/")}>
            Bühne verlassen
          </button>
        </header>
        <main className="inhalt inhalt-buehne">{children}</main>
      </div>
    );
  }
  return (
    <div className="huelle">
      <header className="kopf">
        <strong>{titel}</strong>
        {communityUrl ? (
          <a className="community" href={communityUrl} target="_blank" rel="noreferrer">
            Community
          </a>
        ) : null}
        <nav aria-label="Hauptnavigation">
          {BEREICHE.map((bereich) => (
            <a
              key={bereich.pfad}
              href={bereich.pfad}
              aria-current={bereichAktiv(bereich.pfad, pfad) ? "page" : undefined}
              onClick={(ereignis) => {
                ereignis.preventDefault();
                onNavigieren(bereich.pfad);
              }}
            >
              {bereich.name}
            </a>
          ))}
        </nav>
      </header>
      <main className="inhalt">{children}</main>
      <footer className="fuss">
        Powered by{" "}
        <a href="https://qftm.de" target="_blank" rel="noreferrer">
          QFTM.de
        </a>
      </footer>
    </div>
  );
}
