import type { Anmerkung } from "./annotations";

interface ListeProps {
  liste: Anmerkung[];
  ausgewaehlteId: number | null;
  onAuswahl: (id: number) => void;
}

function kurz(anmerkung: Anmerkung): string {
  if (anmerkung.kind === "marker") {
    return `Marker auf Seite ${anmerkung.page_number}`;
  }
  const text = anmerkung.text.replace(/\s+/g, " ").trim();
  const gekuerzt = text.length > 60 ? `${text.slice(0, 57)}…` : text;
  return `${gekuerzt} (Seite ${anmerkung.page_number})`;
}

export function AnmerkungsListe({ liste, ausgewaehlteId, onAuswahl }: ListeProps) {
  return (
    <section className="anmerkung-liste" aria-labelledby="anmerkung-liste-titel">
      <h3 id="anmerkung-liste-titel">Sichtbare Anmerkungen</h3>
      {liste.length === 0 ? (
        <p>Keine Anmerkungen in dieser Ebene.</p>
      ) : (
        <ul>
          {liste.map((anmerkung) => (
            <li key={anmerkung.id}>
              <button
                type="button"
                aria-pressed={anmerkung.id === ausgewaehlteId}
                onClick={() => onAuswahl(anmerkung.id)}
              >
                {kurz(anmerkung)}
              </button>
              <span className="songmeta">
                {anmerkung.visibility === "band" ? "Band" : "Persönlich"}
                {anmerkung.can_edit ? " · änderbar" : ""}
                {anmerkung.can_delete && !anmerkung.can_edit ? " · löschbar" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
