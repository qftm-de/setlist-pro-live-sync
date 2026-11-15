import { useCallback, useRef } from "react";

export type NavigationsWaechter = (weiter: () => void) => void;

export function useNavigationsWaechter(weiterGehen: (ziel: string) => void) {
  const waechter = useRef<NavigationsWaechter | null>(null);

  const registriereWaechter = useCallback((neu: NavigationsWaechter | null) => {
    waechter.current = neu;
  }, []);

  const mitWaechter = useCallback((weiter: () => void) => {
    const aktiv = waechter.current;
    if (aktiv) {
      aktiv(weiter);
      return true;
    }
    weiter();
    return false;
  }, []);

  const istGeschuetzt = useCallback(() => waechter.current !== null, []);

  function navigiere(ziel: string) {
    mitWaechter(() => weiterGehen(ziel));
  }

  return { navigiere, registriereWaechter, mitWaechter, istGeschuetzt };
}
