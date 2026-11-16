import { apiFetch } from "../api/client";

export interface StageSong {
  id: number | null;
  title: string;
  artist: string;
  key: string;
  bpm: number | null;
  notes: string;
}

export interface StageDokument {
  version_id: number;
  page_count: number;
  byte_size: number;
  sha256: string;
}

export interface StageEintrag {
  uuid: string;
  position: number;
  entry_type: "song" | "pause" | "notiz";
  label: string;
  song: StageSong | null;
  document: StageDokument | null;
}

export interface StageAbschnitt {
  uuid: string;
  name: string;
  kind: string;
  position: number;
  entries: StageEintrag[];
}

export interface StageAktionen {
  can_control: boolean;
  can_handover: boolean;
  can_takeover: boolean;
  can_resume: boolean;
  can_end: boolean;
}

export interface StageMitglied {
  user_id: number;
  display_name: string;
}

export interface StageSitzung {
  id: number;
  band_id: number;
  state: "active" | "ended";
  generation: number;
  revision: number;
  leader_user_id: number | null;
  leader_connection_active: boolean;
  last_number: number;
  current: { entry_uuid: string | null; page: number | null };
  started_at: string | null;
  ended_at: string | null;
  actions: StageAktionen;
  sections: StageAbschnitt[];
  members: StageMitglied[];
}

export interface StageAdapter {
  aktive(bandId: string, verbindung?: string | null): Promise<StageSitzung | null>;
  detail(bandId: string, sessionId: number, verbindung?: string | null): Promise<StageSitzung>;
  start(bandId: string, setlistId: number, verbindung: string): Promise<StageSitzung>;
  join(bandId: string, sessionId: number, verbindung: string): Promise<StageSitzung>;
  handover(
    bandId: string,
    sessionId: number,
    verbindung: string,
    targetUserId: number,
  ): Promise<StageSitzung>;
  takeover(bandId: string, sessionId: number, verbindung: string): Promise<StageSitzung>;
  resume(bandId: string, sessionId: number, verbindung: string): Promise<StageSitzung>;
  beenden(bandId: string, sessionId: number, verbindung: string): Promise<StageSitzung>;
}

function pfad(bandId: string, sessionId?: number, aktion = ""): string {
  const basis = `/api/bands/${encodeURIComponent(bandId)}/stage-sessions/`;
  if (sessionId === undefined) {
    return basis;
  }
  return `${basis}${sessionId}/${aktion}`;
}

function mitVerbindung(suffix: string, verbindung?: string | null): string {
  return verbindung ? `${suffix}?connection=${encodeURIComponent(verbindung)}` : suffix;
}

function post<T>(url: string, koerper: unknown): Promise<T> {
  return apiFetch<T>(url, { method: "POST", body: JSON.stringify(koerper) });
}

export const apiStage: StageAdapter = {
  async aktive(bandId, verbindung) {
    const antwort = await apiFetch<{ session: StageSitzung | null }>(
      mitVerbindung(pfad(bandId), verbindung),
    );
    return antwort.session;
  },
  detail(bandId, sessionId, verbindung) {
    return apiFetch<StageSitzung>(
      mitVerbindung(pfad(bandId, sessionId), verbindung),
    );
  },
  start(bandId, setlistId, verbindung) {
    return post<StageSitzung>(pfad(bandId), {
      setlist_id: setlistId,
      connection_id: verbindung,
    });
  },
  join(bandId, sessionId, verbindung) {
    return post<StageSitzung>(pfad(bandId, sessionId, "join/"), {
      connection_id: verbindung,
    });
  },
  handover(bandId, sessionId, verbindung, targetUserId) {
    return post<StageSitzung>(pfad(bandId, sessionId, "handover/"), {
      connection_id: verbindung,
      target_user_id: targetUserId,
    });
  },
  takeover(bandId, sessionId, verbindung) {
    return post<StageSitzung>(pfad(bandId, sessionId, "takeover/"), {
      connection_id: verbindung,
    });
  },
  resume(bandId, sessionId, verbindung) {
    return post<StageSitzung>(pfad(bandId, sessionId, "resume/"), {
      connection_id: verbindung,
    });
  },
  beenden(bandId, sessionId, verbindung) {
    return post<StageSitzung>(pfad(bandId, sessionId, "end/"), {
      connection_id: verbindung,
    });
  },
};
