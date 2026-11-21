import type { DokumentVersion } from "./documents";

interface VersionsListeProps {
  versionen: DokumentVersion[];
  aktivId: number | null;
  betrachtetId: number | null;
  beschaeftigt: boolean;
  onAnsehen: (versionId: number) => void;
  onAktivieren: (versionId: number) => void;
  onDownload: (version: DokumentVersion) => void;
}

function groesse(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KiB`;
}

export function VersionsListe({
  versionen,
  aktivId,
  betrachtetId,
  beschaeftigt,
  onAnsehen,
  onAktivieren,
  onDownload,
}: VersionsListeProps) {
  if (versionen.length === 0) {
    return null;
  }
  return (
    <section className="pdf-versionen" aria-labelledby="pdf-versionen-titel">
      <h3 id="pdf-versionen-titel">Versionen</h3>
      <ul>
        {versionen.map((version) => {
          const aktiv = version.id === aktivId;
          const angezeigt = version.id === betrachtetId;
          return (
            <li key={version.id}>
              <div className="version-kopf">
                <span className="songtitel">
                  Version {version.number}: {version.original_name}
                </span>
                <span className="songmeta">
                  {version.page_count} Seiten, {groesse(version.byte_size)}
                  {aktiv ? " · aktive Bandversion" : ""}
                </span>
              </div>
              <div className="version-aktionen">
                <button
                  type="button"
                  aria-pressed={angezeigt}
                  onClick={() => onAnsehen(version.id)}
                >
                  {`Version ${version.number} ansehen`}
                </button>
                <button
                  type="button"
                  disabled={beschaeftigt || aktiv}
                  onClick={() => onAktivieren(version.id)}
                >
                  {aktiv
                    ? `Version ${version.number} ist aktiv`
                    : `Version ${version.number} aktivieren`}
                </button>
                <button type="button" onClick={() => onDownload(version)}>
                  {`Version ${version.number} herunterladen`}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="songmeta">
        Der Originaldownload enthält keine Anmerkungen. Anmerkungen bleiben in der App.
      </p>
    </section>
  );
}
