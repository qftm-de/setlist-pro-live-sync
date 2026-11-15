import { ApiFehler } from "../api/client";
import type { PdfViewerProps } from "./PdfViewer";
import type { Dokument, DokumentAdapter, DokumentVersion } from "./documents";

export function testVersion(
  id: number,
  name = `partitur-${id}.pdf`,
): DokumentVersion {
  return {
    id,
    number: id,
    upload_id: `00000000-0000-4000-8000-00000000000${id}`,
    original_name: name,
    byte_size: 1024 * id,
    page_count: id + 1,
    sha256: "a".repeat(64),
    created_at: "2026-11-15T08:00:00Z",
  };
}

export function testDokument(
  versionen: DokumentVersion[] = [],
  aktivId: number | null = null,
): Dokument {
  return {
    id: versionen.length ? 1 : null,
    revision: 0,
    active_version_id: aktivId,
    versions: versionen,
    limits: { max_upload_bytes: 20 * 1024 * 1024, max_pages: 100 },
  };
}

export function dokumentTestAdapter(
  start: Dokument,
  datei: ArrayBuffer = new Uint8Array([37, 80, 68, 70]).buffer,
  ergaenzungen: Partial<DokumentAdapter> = {},
): DokumentAdapter {
  let stand = { ...start, versions: [...start.versions] };
  let naechsteId = Math.max(0, ...stand.versions.map((eintrag) => eintrag.id)) + 1;
  const neuen: Array<{ uploadId: string; version: DokumentVersion }> = [];
  return {
    async lade() {
      return { ...stand, versions: [...stand.versions] };
    },
    async ladeUpload(_bandId, _songId, uploadId) {
      return neuen
        .filter((eintrag) => eintrag.uploadId === uploadId)
        .map((eintrag) => eintrag.version);
    },
    async ladeDatei() {
      return datei;
    },
    async hochladen(_bandId, _songId, _datei, uploadId) {
      const version = testVersion(naechsteId, "neu.pdf");
      naechsteId += 1;
      stand = { ...stand, versions: [...stand.versions, version] };
      neuen.push({ uploadId, version });
      return version;
    },
    async aktiviere(_bandId, _songId, revision, versionId) {
      if (revision !== stand.revision) {
        throw new ApiFehler(409, "conflict");
      }
      stand = {
        ...stand,
        active_version_id: versionId,
        revision: stand.revision + 1,
      };
      return { ...stand, versions: [...stand.versions] };
    },
    ...ergaenzungen,
  };
}

export function FakePdfViewer({ daten, titel }: PdfViewerProps) {
  return (
    <div data-testid="pdf-viewer" aria-label={titel}>
      PDF-Seite mit {daten.byteLength} Bytes
    </div>
  );
}

export function FakePdfViewerMitWerkzeug({
  daten,
  titel,
  annotationen = [],
  onMarkierung,
  onTextPlatzieren,
  onAnmerkungAuswahl,
  onBevorSeiteWechsel,
}: PdfViewerProps) {
  return (
    <div data-testid="pdf-viewer" aria-label={titel}>
      PDF-Seite mit {daten.byteLength} Bytes, {annotationen.length} Anmerkungen
      <button
        type="button"
        onClick={() =>
          onMarkierung?.({ x: 0.2, y: 0.2, width: 0.2, height: 0.2 })
        }
      >
        Marker anlegen
      </button>
      <button
        type="button"
        onClick={() =>
          onTextPlatzieren?.({ x: 0.3, y: 0.3, width: 0.25, height: 0.07 })
        }
      >
        Text platzieren
      </button>
      <button type="button" onClick={() => onAnmerkungAuswahl?.(1)}>
        Erste Anmerkung wählen
      </button>
      <button type="button" onClick={() => onBevorSeiteWechsel?.(2)}>
        Nächste Seite versuchen
      </button>
    </div>
  );
}
