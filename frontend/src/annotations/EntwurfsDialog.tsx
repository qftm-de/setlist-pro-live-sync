import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface EntwurfsDialogProps {
  onSpeichern: () => void;
  onVerwerfen: () => void;
  onAbbrechen: () => void;
  beschaeftigt?: boolean;
  fehler?: string | null;
}

const FOKUSSIERBAR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function EntwurfsDialog({
  onSpeichern,
  onVerwerfen,
  onAbbrechen,
  beschaeftigt = false,
  fehler = null,
}: EntwurfsDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const abbrechenRef = useRef(onAbbrechen);
  const beschaeftigtRef = useRef(beschaeftigt);
  abbrechenRef.current = onAbbrechen;
  beschaeftigtRef.current = beschaeftigt;

  useEffect(() => {
    const vorher = document.activeElement as HTMLElement | null;
    const wurzel = document.getElementById("root");
    wurzel?.setAttribute("inert", "");
    const erste = () =>
      dialogRef.current?.querySelector<HTMLElement>(FOKUSSIERBAR) ??
      dialogRef.current;
    erste()?.focus();

    const beiTaste = (ereignis: KeyboardEvent) => {
      if (ereignis.key === "Escape") {
        ereignis.preventDefault();
        if (!beschaeftigtRef.current) {
          abbrechenRef.current();
        }
        return;
      }
      if (ereignis.key !== "Tab" || !dialogRef.current) {
        return;
      }
      const elemente = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOKUSSIERBAR),
      );
      if (elemente.length === 0) {
        return;
      }
      const erster = elemente[0];
      const letzter = elemente[elemente.length - 1];
      if (ereignis.shiftKey && document.activeElement === erster) {
        ereignis.preventDefault();
        letzter.focus();
      } else if (!ereignis.shiftKey && document.activeElement === letzter) {
        ereignis.preventDefault();
        erster.focus();
      }
    };
    window.addEventListener("keydown", beiTaste);
    return () => {
      window.removeEventListener("keydown", beiTaste);
      wurzel?.removeAttribute("inert");
      if (vorher?.isConnected) {
        vorher.focus();
      }
    };
  }, []);

  return createPortal(
    <div
      className="anmerkung-wechsel-hintergrund"
      data-testid="entwurfs-dialog-ueberlagerung"
    >
      <div
        ref={dialogRef}
        className="anmerkung-wechsel"
        role="dialog"
        aria-modal="true"
        aria-label="Ungespeicherter Entwurf"
        tabIndex={-1}
      >
        <p>Es gibt einen ungespeicherten Entwurf.</p>
        {fehler ? <p role="alert">{fehler}</p> : null}
        <div className="aktionsgruppe">
          <button type="button" onClick={onSpeichern} disabled={beschaeftigt}>
            {beschaeftigt ? "Speichert …" : "Entwurf speichern und wechseln"}
          </button>
          <button type="button" onClick={onVerwerfen} disabled={beschaeftigt}>
            Entwurf verwerfen und wechseln
          </button>
          <button type="button" onClick={onAbbrechen} disabled={beschaeftigt}>
            Wechsel abbrechen
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
