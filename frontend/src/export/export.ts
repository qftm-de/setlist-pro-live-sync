import { ApiFehler } from "../api/client";

export interface ExportDatei {
  blob: Blob;
  name: string;
}

function dateinameAusHeader(header: string | null): string | null {
  if (!header) {
    return null;
  }
  const erweitert = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (erweitert) {
    try {
      return decodeURIComponent(erweitert[1].replace(/^"|"$/g, ""));
    } catch {
      return null;
    }
  }
  const einfach = /filename="?([^";]+)"?/i.exec(header);
  return einfach ? einfach[1] : null;
}

function fehlerAusAntwort(status: number): ApiFehler {
  if (status === 401) {
    return new ApiFehler(401, "unauthenticated");
  }
  if (status === 403) {
    return new ApiFehler(403, "forbidden");
  }
  if (status === 404) {
    return new ApiFehler(404, "not_found");
  }
  if (status === 413) {
    return new ApiFehler(
      413,
      "too_large",
      "Der Export überschreitet die Größenobergrenze.",
    );
  }
  if (status === 409) {
    return new ApiFehler(409, "conflict");
  }
  return new ApiFehler(status >= 500 ? status : 400, status >= 500 ? "server" : "bad_request");
}

export async function ladeBandExport(bandId: string): Promise<ExportDatei> {
  const pfad = `/api/bands/${encodeURIComponent(bandId)}/export/`;
  let antwort: Response;
  try {
    antwort = await fetch(pfad, {
      credentials: "same-origin",
      headers: { Accept: "application/zip" },
    });
  } catch {
    throw new ApiFehler(0, "network");
  }
  if (!antwort.ok) {
    throw fehlerAusAntwort(antwort.status);
  }
  let blob: Blob;
  try {
    blob = await antwort.blob();
  } catch {
    throw new ApiFehler(0, "network");
  }
  if (blob.size === 0) {
    throw new ApiFehler(antwort.status, "invalid_response");
  }
  return {
    blob,
    name: dateinameAusHeader(antwort.headers.get("Content-Disposition")) ?? "band-export.zip",
  };
}

export function starteDownload({ blob, name }: ExportDatei): void {
  const url = URL.createObjectURL(blob);
  const anker = document.createElement("a");
  anker.href = url;
  anker.download = name;
  anker.rel = "noopener";
  anker.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
