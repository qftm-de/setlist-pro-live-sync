import type { ComponentType } from "react";
import type { AnmerkungAdapter } from "../annotations/annotations";
import type { Song } from "../bands/bands";
import type { DokumentAdapter } from "./documents";
import { DokumentAnsicht } from "./DokumentAnsicht";
import type { PdfViewerProps } from "./PdfViewer";
import { FehlerAnzeige } from "../ui/FehlerAnzeige";

interface DokumentRouteProps {
  bandId: string;
  songId: number | null;
  versionId: number | null;
  songs: Song[];
  adapter: DokumentAdapter;
  anmerkungAdapter: AnmerkungAdapter;
  viewer?: ComponentType<PdfViewerProps>;
  aktualisierung?: number;
  registriereWaechter?: (waechter: ((weiter: () => void) => void) | null) => void;
  onSitzungAbgelaufen?: () => void;
}

export function DokumentRoute({
  bandId,
  songId,
  versionId,
  songs,
  adapter,
  anmerkungAdapter,
  viewer,
  aktualisierung = 0,
  registriereWaechter,
  onSitzungAbgelaufen,
}: DokumentRouteProps) {
  if (songId === null) {
    return <FehlerAnzeige text="Dieser Song ist nicht sichtbar." />;
  }
  return (
    <DokumentAnsicht
      key={`${bandId}-${songId}`}
      bandId={bandId}
      songId={songId}
      songTitel={songs.find((eintrag) => String(eintrag.id) === String(songId))?.title}
      initialVersionId={versionId}
      adapter={adapter}
      anmerkungAdapter={anmerkungAdapter}
      viewer={viewer}
      aktualisierung={aktualisierung}
      registriereWaechter={registriereWaechter}
      onSitzungAbgelaufen={onSitzungAbgelaufen}
    />
  );
}
