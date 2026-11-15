import { apiFetch, apiFetchDatei } from "../api/client";
import { neueUuid } from "../uuid";

export interface DokumentGrenzen {
  max_upload_bytes: number;
  max_pages: number;
}

export interface DokumentVersion {
  id: number;
  number: number;
  upload_id: string;
  original_name: string;
  byte_size: number;
  page_count: number;
  sha256: string;
  created_at: string;
}

export interface Dokument {
  id: number | null;
  revision: number;
  active_version_id: number | null;
  versions: DokumentVersion[];
  limits: DokumentGrenzen;
}

export interface DokumentAdapter {
  lade(bandId: string, songId: number): Promise<Dokument>;
  ladeUpload(bandId: string, songId: number, uploadId: string): Promise<DokumentVersion[]>;
  ladeDatei(bandId: string, songId: number, versionId: number): Promise<ArrayBuffer>;
  hochladen(
    bandId: string,
    songId: number,
    datei: File,
    uploadId: string,
  ): Promise<DokumentVersion>;
  aktiviere(
    bandId: string,
    songId: number,
    revision: number,
    versionId: number | null,
  ): Promise<Dokument>;
}

function basis(bandId: string, songId: number): string {
  return `/api/bands/${encodeURIComponent(bandId)}/songs/${encodeURIComponent(String(songId))}/document/`;
}

export const apiDokumente: DokumentAdapter = {
  lade(bandId, songId) {
    return apiFetch<Dokument>(basis(bandId, songId));
  },
  ladeUpload(bandId, songId, uploadId) {
    return apiFetch<DokumentVersion[]>(
      `${basis(bandId, songId)}versions/?upload_id=${encodeURIComponent(uploadId)}`,
    );
  },
  ladeDatei(bandId, songId, versionId) {
    return apiFetchDatei(
      `${basis(bandId, songId)}versions/${encodeURIComponent(String(versionId))}/file/`,
    );
  },
  hochladen(bandId, songId, datei, uploadId) {
    const koerper = new FormData();
    koerper.set("file", datei);
    koerper.set("upload_id", uploadId);
    return apiFetch<DokumentVersion>(`${basis(bandId, songId)}versions/`, {
      method: "POST",
      body: koerper,
    });
  },
  aktiviere(bandId, songId, revision, versionId) {
    return apiFetch<Dokument>(basis(bandId, songId), {
      method: "PATCH",
      body: JSON.stringify({ revision, active_version_id: versionId }),
    });
  },
};

export function neueUploadId(): string {
  return neueUuid();
}

export function naechsteVersion(dokument: Dokument, bevorzugt: number | null): number | null {
  const ids = new Set(dokument.versions.map((version) => version.id));
  if (bevorzugt !== null && ids.has(bevorzugt)) {
    return bevorzugt;
  }
  if (dokument.active_version_id !== null && ids.has(dokument.active_version_id)) {
    return dokument.active_version_id;
  }
  return dokument.versions[dokument.versions.length - 1]?.id ?? null;
}
