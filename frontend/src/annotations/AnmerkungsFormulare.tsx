import type { RefObject } from "react";
import type {
  Anmerkung,
  AnmerkungsFarbe,
  Entwurf,
  Schriftgroesse,
} from "./annotations";
import { AnmerkungLesen } from "./AnmerkungLesen";
import {
  AnmerkungsFormular,
  type FormularHandle,
  type FormularWerte,
  type TextSync,
} from "./AnmerkungsFormular";

interface FormulareProps {
  bewegung?: Anmerkung["geometry"] | null;
  entwurf: Entwurf | null;
  ausgewaehlt: Anmerkung | null;
  ersatz: Anmerkung | null;
  seiten: number;
  farbe: AnmerkungsFarbe;
  schriftgroesse: Schriftgroesse;
  formRef: RefObject<FormularHandle | null>;
  textSyncFuer?: (anmerkung: Anmerkung) => TextSync | null;
  onSpeichern: (werte: FormularWerte) => Promise<void>;
  onLoeschen: () => Promise<void>;
  onAbbrechenEntwurf: () => void;
  onAbbrechenAuswahl: () => void;
  onDirtyChange: (geaendert: boolean) => void;
  onSitzungAbgelaufen?: () => void;
}

export function AnmerkungsFormulare({
  bewegung,
  entwurf,
  ausgewaehlt,
  ersatz,
  seiten,
  farbe,
  schriftgroesse,
  formRef,
  textSyncFuer,
  onSpeichern,
  onLoeschen,
  onAbbrechenEntwurf,
  onAbbrechenAuswahl,
  onDirtyChange,
  onSitzungAbgelaufen,
}: FormulareProps) {
  const angezeigt = ausgewaehlt ?? ersatz;
  if (angezeigt && !angezeigt.can_edit) {
    return (
      <AnmerkungLesen
        onSchliessen={onAbbrechenAuswahl}
        anmerkung={angezeigt}
        geloescht={ausgewaehlt === null}
        onLoeschen={onLoeschen}
      />
    );
  }
  if (entwurf) {
    return (
      <AnmerkungsFormular
        key={`neu-${entwurf.uuid}`}
        ref={formRef}
        art="neu"
        anmerkung={null}
        start={{
          page_number: entwurf.page_number,
          color: farbe,
          visibility: "private",
          geometry: entwurf.geometry,
          text: "",
          font_size: schriftgroesse,
        }}
        seiten={seiten}
        onSpeichern={onSpeichern}
        onAbbrechen={onAbbrechenEntwurf}
        onDirtyChange={onDirtyChange}
        onSitzungAbgelaufen={onSitzungAbgelaufen}
      />
    );
  }
  if (angezeigt) {
    return (
      <AnmerkungsFormular
        bewegung={bewegung}
        key={`edit-${angezeigt.id}`}
        ref={formRef}
        art="bearbeiten"
        anmerkung={angezeigt}
        geloescht={ausgewaehlt === null}
        textSync={textSyncFuer?.(angezeigt) ?? null}
        start={{
          page_number: angezeigt.page_number,
          color: angezeigt.color,
          visibility: angezeigt.visibility,
          geometry: angezeigt.geometry,
          text: angezeigt.text,
          font_size: angezeigt.font_size ?? 0.0225,
        }}
        seiten={seiten}
        onSpeichern={onSpeichern}
        onLoeschen={
          ausgewaehlt && ausgewaehlt.can_delete ? onLoeschen : undefined
        }
        onAbbrechen={onAbbrechenAuswahl}
        onDirtyChange={onDirtyChange}
        onSitzungAbgelaufen={onSitzungAbgelaufen}
      />
    );
  }
  return null;
}
