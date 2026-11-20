import type { Dispatch, SetStateAction } from "react";
import type * as Y from "yjs";
import type { TextAntwort } from "./texte";

export type TextZustand =
  | "bestaetigt"
  | "offen"
  | "abgelehnt"
  | "fehler"
  | "pausiert";

export interface Referenz<T> {
  current: T;
}

export interface CrdtTextKontext {
  docRef: Referenz<Y.Doc | null>;
  svRef: Referenz<Uint8Array | null>;
  updateRef: Referenz<Uint8Array | null>;
  epochRef: Referenz<number>;
  sendetRef: Referenz<boolean>;
  sendenRef: Referenz<(update: string, epoch: number) => Promise<TextAntwort>>;
  aktivRef: Referenz<boolean>;
  bestaetigtCbRef: Referenz<((text: string, epoch: number) => void) | undefined>;
  wertCbRef: Referenz<((text: string) => void) | undefined>;
  standCbRef: Referenz<((text: string) => void) | undefined>;
  konfliktCbRef: Referenz<(() => void) | undefined>;
  entwurfRef: Referenz<string | null>;
  ausServerstandRef: Referenz<boolean>;
  lokalGeaendertRef: Referenz<boolean>;
  standAusEreignisRef: Referenz<boolean>;
  letzteEreignisRevisionRef: Referenz<number>;
  ausgangstextRef: Referenz<string>;
  docGenerationRef: Referenz<number>;
  setWertState: Dispatch<SetStateAction<string>>;
  setZustand: Dispatch<SetStateAction<TextZustand>>;
  setFehler: Dispatch<SetStateAction<string | null>>;
  setzeEntwurf: (wert: string | null) => void;
  planeSenden: (sofort?: boolean) => void;
  setzeBestaetigt: (update: Uint8Array) => void;
  timerLoeschen: () => void;
}
