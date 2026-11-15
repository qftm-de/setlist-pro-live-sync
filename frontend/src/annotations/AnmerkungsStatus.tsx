import { StatusAnzeige } from "../ui/StatusAnzeige";

interface StatusProps {
  fehler: string | null;
  laedt: boolean;
  aktionsFehler: string | null;
  konflikt: boolean;
  onServerStand: () => void;
}

export function AnmerkungsStatus({
  fehler,
  laedt,
  aktionsFehler,
  konflikt,
  onServerStand,
}: StatusProps) {
  return (
    <>
      {fehler ? <p role="alert">{fehler}</p> : null}
      {laedt ? <StatusAnzeige zustand="laedt" /> : null}
      {aktionsFehler ? <p role="alert">{aktionsFehler}</p> : null}
      {konflikt ? (
        <div role="alert" className="anmerkung-konflikt">
          <p>Der Serverstand wurde inzwischen geändert. Der Entwurf bleibt erhalten.</p>
          <button type="button" onClick={onServerStand}>
            Serverstand neu laden
          </button>
        </div>
      ) : null}
    </>
  );
}
