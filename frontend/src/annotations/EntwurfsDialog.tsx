interface EntwurfsDialogProps {
  onSpeichern: () => void;
  onVerwerfen: () => void;
  onAbbrechen: () => void;
}

export function EntwurfsDialog({
  onSpeichern,
  onVerwerfen,
  onAbbrechen,
}: EntwurfsDialogProps) {
  return (
    <div className="anmerkung-wechsel" role="dialog" aria-label="Ungespeicherter Entwurf">
      <p>Es gibt einen ungespeicherten Entwurf.</p>
      <button type="button" onClick={onSpeichern}>
        Entwurf speichern und wechseln
      </button>
      <button type="button" onClick={onVerwerfen}>
        Entwurf verwerfen und wechseln
      </button>
      <button type="button" onClick={onAbbrechen}>
        Wechsel abbrechen
      </button>
    </div>
  );
}
