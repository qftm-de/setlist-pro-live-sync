import { useState } from "react";
import { behandleFehler, fehlerText, istApiFehler } from "../api/client";
import type { DokumentAdapter, DokumentGrenzen, DokumentVersion } from "./documents";
import { neueUploadId } from "./documents";

type UploadZustand = "entwurf" | "laeuft" | "gespeichert" | "unklar" | "fehler";

interface UploadFormularProps {
  bandId: string;
  songId: number;
  adapter: DokumentAdapter;
  grenzen: DokumentGrenzen;
  onHochgeladen: (version: DokumentVersion) => void;
  onAktivieren: (versionId: number) => void;
  onSitzungAbgelaufen?: () => void;
}

function limitText(grenzen: DokumentGrenzen): string {
  const teile: string[] = [];
  if (grenzen.max_upload_bytes > 0) {
    teile.push(`${Math.round(grenzen.max_upload_bytes / (1024 * 1024))} MiB`);
  }
  if (grenzen.max_pages > 0) {
    teile.push(`${grenzen.max_pages} Seiten`);
  }
  return teile.length ? `Grenzen: ${teile.join(", ")}.` : "Keine technische Größenbegrenzung.";
}

export function UploadFormular({
  bandId,
  songId,
  adapter,
  grenzen,
  onHochgeladen,
  onAktivieren,
  onSitzungAbgelaufen,
}: UploadFormularProps) {
  const [datei, setDatei] = useState<File | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [zustand, setZustand] = useState<UploadZustand>("entwurf");
  const [version, setVersion] = useState<DokumentVersion | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  function dateiWaehlen(auswahl: File | null) {
    setDatei(auswahl);
    setVersion(null);
    setMeldung(null);
    setUploadId(auswahl ? neueUploadId() : null);
    setZustand("entwurf");
  }

  async function hochladen(ereignis: React.FormEvent) {
    ereignis.preventDefault();
    if (!datei || !uploadId) {
      setMeldung("Bitte eine PDF auswählen.");
      return;
    }
    setZustand("laeuft");
    setMeldung(null);
    try {
      const neu = await adapter.hochladen(bandId, songId, datei, uploadId);
      setVersion(neu);
      setZustand("gespeichert");
      onHochgeladen(neu);
    } catch (ursache) {
      if (istApiFehler(ursache) && (ursache.code === "network" || ursache.code === "server")) {
        setZustand("unklar");
        setMeldung(
          "Der Upload ist unklar. Nicht erneut senden, sondern abgleichen. Entwurf und Datei bleiben erhalten.",
        );
        return;
      }
      setZustand("fehler");
      const text = behandleFehler(ursache, onSitzungAbgelaufen);
      if (text) {
        setMeldung(text);
      }
    }
  }

  async function abgleichen() {
    if (!uploadId) {
      return;
    }
    setZustand("laeuft");
    setMeldung(null);
    try {
      const treffer = await adapter.ladeUpload(bandId, songId, uploadId);
      if (treffer.length === 0) {
        setZustand("unklar");
        setMeldung(
          "Noch keine Version gefunden. Der Upload kann weiterlaufen. Der Abgleich wurde wiederholt, kein neuer Upload gestartet.",
        );
        return;
      }
      setVersion(treffer[0]);
      setZustand("gespeichert");
      onHochgeladen(treffer[0]);
    } catch (ursache) {
      setZustand("unklar");
      const text = behandleFehler(ursache, onSitzungAbgelaufen);
      setMeldung(text ?? fehlerText(ursache));
    }
  }

  const laeuft = zustand === "laeuft";
  const unklar = zustand === "unklar";

  return (
    <form className="pdf-upload" onSubmit={hochladen}>
      <h3>PDF hochladen</h3>
      <p className="songmeta">
        {limitText(grenzen)} Geprüft werden Struktur, Seiten und Lesbarkeit.
      </p>
      <label>
        PDF-Datei
        <input
          type="file"
          accept="application/pdf,.pdf"
          disabled={laeuft}
          onChange={(ereignis) => dateiWaehlen(ereignis.target.files?.[0] ?? null)}
        />
      </label>
      <button type="submit" disabled={laeuft || !datei || version !== null}>
        {laeuft && !unklar ? "Lädt hoch …" : "PDF hochladen"}
      </button>
      {unklar ? (
        <button type="button" onClick={abgleichen}>
          Upload abgleichen
        </button>
      ) : null}
      {version ? (
        <div className="pdf-upload-erfolg" role="status">
          <p>Version {version.number} gespeichert. Die aktive Version wurde nicht automatisch geändert.</p>
          <button type="button" onClick={() => onAktivieren(version.id)}>
            Als aktive Version wählen
          </button>
        </div>
      ) : null}
      {meldung ? <p role="alert">{meldung}</p> : null}
    </form>
  );
}
