interface KontoZeileProps {
  benutzername: string;
  onAbmelden: () => void;
}

export function KontoZeile({ benutzername, onAbmelden }: KontoZeileProps) {
  return (
    <p className="konto">
      Angemeldet als {benutzername}
      <button type="button" className="abmelden" onClick={onAbmelden}>
        Abmelden
      </button>
    </p>
  );
}
