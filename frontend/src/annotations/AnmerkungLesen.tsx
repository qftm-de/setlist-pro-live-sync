import type { Anmerkung } from "./annotations";

interface AnmerkungLesenProps {
  anmerkung: Anmerkung;
  onLoeschen: () => void;
}

export function AnmerkungLesen({ anmerkung, onLoeschen }: AnmerkungLesenProps) {
  return (
    <section className="anmerkung-formular" aria-label="Anmerkung lesen">
      <h4>Bandweite Anmerkung</h4>
      <p>{anmerkung.kind === "text" ? anmerkung.text : "Marker"}</p>
      <p className="songmeta">
        Nur der Autor kann diese Anmerkung ändern. Aktuelle Owner dürfen
        bandweite Anmerkungen löschen.
      </p>
      {anmerkung.can_delete ? (
        <button type="button" onClick={onLoeschen}>
          Anmerkung löschen
        </button>
      ) : null}
    </section>
  );
}
