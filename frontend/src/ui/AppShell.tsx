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

function Fuss() {
  return (
    <footer className="fuss">
      <span>© P. Beuster</span>
      <span aria-hidden="true">·</span>
      <span>
        Powered by{" "}
        <a href="https://qftm.de" target="_blank" rel="noreferrer">
          QFTM.de
        </a>
      </span>
      <span aria-hidden="true">·</span>
      <a
        className="fuss-repo"
        href="https://github.com/qftm-de/setlist-pro-live-sync"
        target="_blank"
        rel="noreferrer"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
        </svg>
        Quellcode, AGPL-3.0
      </a>
    </footer>
  );
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
          <strong className="marke"><img src="/band-icon.jpg" alt="" width="36" height="36" />{titel}</strong>
          <button type="button" onClick={() => onNavigieren("/")}>
            Bühne verlassen
          </button>
        </header>
        <main className="inhalt inhalt-buehne">{children}</main>
        <Fuss />
      </div>
    );
  }
  return (
    <div className={`huelle ${pfad.includes("/pdf") ? "huelle-pdf" : ""}`}>
      <header className="kopf">
        <strong className="marke"><img src="/band-icon.jpg" alt="" width="36" height="36" />{titel}</strong>
        {communityUrl ? (
          <a className="community" href={communityUrl} target="_blank" rel="noreferrer">
            Community
          </a>
        ) : null}
        {pfad.includes("/pdf") ? <button type="button" onClick={() => onNavigieren("/songs")}>Zurück zu Songs</button> : null}
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
      <Fuss />
    </div>
  );
}
