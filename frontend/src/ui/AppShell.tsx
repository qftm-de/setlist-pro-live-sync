import type { ReactNode } from "react";

const BEREICHE = [
  { pfad: "/", name: "Start" },
  { pfad: "/songs", name: "Songs" },
  { pfad: "/setlists", name: "Setlists" },
];

interface AppShellProps {
  titel: string;
  pfad: string;
  communityUrl?: string | null;
  onNavigieren: (pfad: string) => void;
  children: ReactNode;
}

export function AppShell({
  titel,
  pfad,
  communityUrl,
  onNavigieren,
  children,
}: AppShellProps) {
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
              aria-current={pfad === bereich.pfad ? "page" : undefined}
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
    </div>
  );
}
