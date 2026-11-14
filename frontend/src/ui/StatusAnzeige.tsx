export type SpeicherZustand =
  | "laedt"
  | "fehler"
  | "entwurf"
  | "speichert"
  | "gespeichert";

const TEXTE: Record<SpeicherZustand, string> = {
  laedt: "Lädt …",
  fehler: "Fehler",
  entwurf: "Entwurf",
  speichert: "Speichert …",
  gespeichert: "Gespeichert",
};

export function StatusAnzeige({ zustand }: { zustand: SpeicherZustand }) {
  return (
    <p className={`status status-${zustand}`} role="status" data-zustand={zustand}>
      {TEXTE[zustand]}
    </p>
  );
}
