import { useCallback, useRef } from "react";

export type NavigationsWaechter = (weiter: () => void) => void;

export function useNavigationsWaechter(weiterGehen: (ziel: string) => void) {
  const waechter = useRef<NavigationsWaechter | null>(null);

  const registriereWaechter = useCallback((neu: NavigationsWaechter | null) => {
    waechter.current = neu;
  }, []);

  function navigiere(ziel: string) {
    const weiter = () => weiterGehen(ziel);
    if (waechter.current) {
      waechter.current(weiter);
    } else {
      weiter();
    }
  }

  return { navigiere, registriereWaechter };
}
