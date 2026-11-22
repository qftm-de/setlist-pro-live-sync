interface EinladungBestaetigungProps {
  laeuft: boolean;
  fehler: string | null;
  onOeffnen: () => void;
}

export function EinladungBestaetigung({
  laeuft,
  fehler,
  onOeffnen,
}: EinladungBestaetigungProps) {
  return (
    <section className="einladung-ansicht" aria-labelledby="einladung-titel">
      <h1 id="einladung-titel">Beitritt bestätigt</h1>
      <p>Du bist der Band beigetreten. Öffne sie jetzt erneut.</p>
      {fehler ? <p role="alert">{fehler}</p> : null}
      <button type="button" disabled={laeuft} onClick={onOeffnen}>
        {laeuft ? "Lädt …" : "Band öffnen"}
      </button>
    </section>
  );
}
