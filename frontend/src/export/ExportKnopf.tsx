import { useEffect, useRef, useState } from "react";
import { behandleFehler } from "../api/client";
import { ladeBandExport, starteDownload } from "./export";

interface ExportKnopfProps {
  bandId: string;
  onSitzungAbgelaufen?: () => void;
}

export function ExportKnopf({ bandId, onSitzungAbgelaufen }: ExportKnopfProps) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const laufRef = useRef(0);
  const aktivRef = useRef(true);

  useEffect(() => {
    aktivRef.current = true;
    laufRef.current += 1;
    setLaeuft(false);
    setFehler(null);
    return () => {
      aktivRef.current = false;
    };
  }, [bandId]);

  async function exportieren() {
    const lauf = laufRef.current + 1;
    laufRef.current = lauf;
    setLaeuft(true);
    setFehler(null);
    try {
      const datei = await ladeBandExport(bandId);
      if (aktivRef.current && lauf === laufRef.current) {
        starteDownload(datei);
      }
    } catch (ursache) {
      if (aktivRef.current && lauf === laufRef.current) {
        setFehler(behandleFehler(ursache, onSitzungAbgelaufen));
      }
    } finally {
      if (aktivRef.current && lauf === laufRef.current) {
        setLaeuft(false);
      }
    }
  }

  return (
    <div className="bandexport">
      <button type="button" onClick={exportieren} disabled={laeuft}>
        {laeuft ? "Exportiert …" : "Band exportieren"}
      </button>
      {fehler ? <p role="alert">{fehler}</p> : null}
    </div>
  );
}
