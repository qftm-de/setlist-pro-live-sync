import { useEffect } from "react";

export function useZurueckNavigation(
  pfad: string,
  setPfad: (ziel: string) => void,
  istGeschuetzt: () => boolean,
  mitWaechter: (weiter: () => void) => void,
) {
  useEffect(() => {
    const beiZurueck = () => {
      const ziel = window.location.pathname;
      let ausgefuehrt = false;
      const geschuetzt = istGeschuetzt();
      mitWaechter(() => {
        ausgefuehrt = true;
        if (window.location.pathname !== ziel) {
          window.history.pushState({}, "", ziel);
        }
        setPfad(ziel);
      });
      if (geschuetzt && !ausgefuehrt) {
        // Bewusster Kompromiss: Der zusätzliche Eintrag hält die URL bis zur
        // Entscheidung stabil. Ein replaceState würde das Ziel verwerfen.
        window.history.pushState({}, "", pfad);
      }
    };
    window.addEventListener("popstate", beiZurueck);
    return () => window.removeEventListener("popstate", beiZurueck);
  }, [istGeschuetzt, mitWaechter, pfad, setPfad]);
}
