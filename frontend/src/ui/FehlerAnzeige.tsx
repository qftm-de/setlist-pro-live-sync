interface FehlerAnzeigeProps {
  text: string;
  onWiederholen?: () => void;
}

export function FehlerAnzeige({ text, onWiederholen }: FehlerAnzeigeProps) {
  return (
    <div className="fehler" role="alert">
      <p>{text}</p>
      {onWiederholen ? (
        <button type="button" onClick={onWiederholen}>
          Erneut versuchen
        </button>
      ) : null}
    </div>
  );
}
