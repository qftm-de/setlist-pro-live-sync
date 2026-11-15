import type { RefObject } from "react";
import type {
  Anmerkung,
  AnmerkungsFarbe,
  Entwurf,
  Schriftgroesse,
} from "./annotations";
import { AnmerkungLesen } from "./AnmerkungLesen";
import { AnmerkungsFormular, type FormularHandle, type FormularWerte } from "./AnmerkungsFormular";

interface FormulareProps {
  entwurf: Entwurf | null;
  ausgewaehlt: Anmerkung | null;
  seiten: number;
  farbe: AnmerkungsFarbe;
  schriftgroesse: Schriftgroesse;
  formRef: RefObject<FormularHandle | null>;
  onSpeichern: (werte: FormularWerte) => Promise<void>;
  onLoeschen: () => Promise<void>;
  onAbbrechenEntwurf: () => void;
  onAbbrechenAuswahl: () => void;
  onDirtyChange: (geaendert: boolean) => void;
  onSitzungAbgelaufen?: () => void;
}

export function AnmerkungsFormulare({
  entwurf,
  ausgewaehlt,
  seiten,
  farbe,
  schriftgroesse,
  formRef,
  onSpeichern,
  onLoeschen,
  onAbbrechenEntwurf,
  onAbbrechenAuswahl,
  onDirtyChange,
  onSitzungAbgelaufen,
}: FormulareProps) {
  if (ausgewaehlt && !ausgewaehlt.can_edit) {
    return <AnmerkungLesen anmerkung={ausgewaehlt} onLoeschen={onLoeschen} />;
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
  if (ausgewaehlt) {
    return (
      <AnmerkungsFormular
        key={`edit-${ausgewaehlt.id}`}
        ref={formRef}
        art="bearbeiten"
        anmerkung={ausgewaehlt}
        start={{
          page_number: ausgewaehlt.page_number,
          color: ausgewaehlt.color,
          visibility: ausgewaehlt.visibility,
          geometry: ausgewaehlt.geometry,
          text: ausgewaehlt.text,
          font_size: ausgewaehlt.font_size ?? 0.0225,
        }}
        seiten={seiten}
        onSpeichern={onSpeichern}
        onLoeschen={ausgewaehlt.can_delete ? onLoeschen : undefined}
        onAbbrechen={onAbbrechenAuswahl}
        onDirtyChange={onDirtyChange}
        onSitzungAbgelaufen={onSitzungAbgelaufen}
      />
    );
  }
  return null;
}
