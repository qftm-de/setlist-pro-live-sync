import { useEffect } from "react";
import { useCrdtText } from "./useCrdtText";
import type { TextAntwort, TextStand } from "./texte";

interface CrdtTextFeldProps {
  stand?: TextStand | null;
  wert: string;
  aktiv: boolean;
  senden?: (update: string, epoch: number) => Promise<TextAntwort>;
  onWert: (text: string) => void;
  onStand?: (text: string) => void;
  onKonflikt?: () => void;
  remote?: { update: string; epoch: number } | null;
  label: string;
  name?: string;
  maxLength: number;
  disabled?: boolean;
  mehrzeilig?: boolean;
  rows?: number;
}

const ZUSTAND_TEXT: Record<string, string> = {
  bestaetigt: "live",
  offen: "wird gesendet",
  abgelehnt: "Konflikt, Entwurf behalten",
  pausiert: "pausiert",
};

export function CrdtTextFeld({
  stand = null,
  wert,
  aktiv,
  senden,
  onWert,
  onStand,
  onKonflikt,
  remote = null,
  label,
  name,
  maxLength,
  disabled = false,
  mehrzeilig = false,
  rows = 3,
}: CrdtTextFeldProps) {
  const crdt = useCrdtText({
    stand,
    wert,
    aktiv,
    senden:
      senden ??
      (async () => ({ text: wert, epoch: stand?.epoch ?? 0, revision: 0, update: "" })),
    onWert,
    onStand,
    onKonflikt,
  });
  const nutztCrdt = Boolean(stand && senden);

  useEffect(() => {
    if (nutztCrdt && remote) {
      crdt.wendeRemoteAn(remote.update);
    }
    // Nur ein neues Remote-Update wird übernommen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote?.update]);

  return (
    <label>
      {label}
      {mehrzeilig ? (
        <textarea
          name={name}
          value={nutztCrdt ? crdt.wert : wert}
          maxLength={maxLength}
          rows={rows}
          disabled={disabled}
          onChange={(ereignis) => {
            if (nutztCrdt) {
              crdt.setWert(ereignis.target.value);
            } else {
              onWert(ereignis.target.value);
            }
          }}
        />
      ) : (
        <input
          name={name}
          value={nutztCrdt ? crdt.wert : wert}
          maxLength={maxLength}
          disabled={disabled}
          onChange={(ereignis) => {
            if (nutztCrdt) {
              crdt.setWert(ereignis.target.value);
            } else {
              onWert(ereignis.target.value);
            }
          }}
        />
      )}
      {nutztCrdt ? (
        <span className={`text-zustand text-${crdt.zustand}`} aria-live="polite">
          {ZUSTAND_TEXT[crdt.zustand]}
        </span>
      ) : null}
      {nutztCrdt && crdt.zustand === "abgelehnt" ? (
        <button type="button" onClick={crdt.uebernehmen}>
          Entwurf erneut übernehmen
        </button>
      ) : null}
    </label>
  );
}
