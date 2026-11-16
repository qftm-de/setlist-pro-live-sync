/**
 * R15: Bühnensitzung gegen echte Container. Snapshot, Leitung, Folgen,
 * Steuerbefehle, Rechte, Wiederverbindung und Ende.
 */
import { randomUUID } from "node:crypto";
import { pdfBytes } from "../pdf.mjs";
import { Sitzung } from "../verify-session.mjs";
import { verbinde } from "./echtzeit.mjs";
import { baueBuehne, befehl, warteBis } from "./buehne-aufbau.mjs";

export async function pruefeBuehne({
  basis,
  leitung,
  mitglied,
  owner,
  fremd,
  bandId,
  songIds,
  pruefe,
  shell,
  warteAuf,
}) {
  const aufbau = await baueBuehne({
    basis,
    leitung,
    mitglied,
    owner,
    bandId,
    songIds,
    pruefe,
  });
  const {
    songA,
    songB,
    setlistId,
    revision,
    songEintrag1,
    pauseEintrag,
    songEintrag2,
    leitungWs,
    mitgliedWs,
    ownerWs,
    leitungVerbindung,
    mitgliedVerbindung,
    ownerVerbindung,
    versionA,
  } = aufbau;
  const dokumentPfad = (songId) =>
    `/api/bands/${bandId}/songs/${songId}/document/`;
  const start = await leitung.ruf(`/api/bands/${bandId}/stage-sessions/`, {
    methode: "POST",
    koerper: { setlist_id: setlistId, connection_id: leitungVerbindung },
  });
  pruefe(start.status === 201, "Bühnensitzung starten scheitert");
  const sessionId = start.daten.id;
  pruefe(start.daten.state === "active", "Sitzung ist nicht aktiv");
  pruefe(
    start.daten.current.entry_uuid === songEintrag1.uuid,
    "Start steht nicht auf dem ersten Song",
  );
  pruefe(
    start.daten.sections[0].entries[0].document?.version_id === versionA.daten.id,
    "Snapshot hält nicht die aktive PDF-Version",
  );
  pruefe(
    start.daten.sections[0].entries[2].document === null,
    "Song ohne PDF trägt ein Dokument",
  );

  const zweiterStart = await mitglied.ruf(
    `/api/bands/${bandId}/stage-sessions/`,
    {
      methode: "POST",
      koerper: { setlist_id: setlistId, connection_id: mitgliedVerbindung },
    },
  );
  pruefe(zweiterStart.status === 409, "Zweiter Start ist nicht 409");
  const parallel = await Promise.all(
    [leitung, leitung].map((sitzung) =>
      sitzung.ruf(`/api/bands/${bandId}/stage-sessions/`, {
        methode: "POST",
        koerper: { setlist_id: setlistId, connection_id: leitungVerbindung },
      }),
    ),
  );
  pruefe(
    parallel.every((antwort) => [201, 409].includes(antwort.status)),
    "Paralleler Start liefert unerwarteten Status",
  );
  pruefe(
    (await leitung.ruf(`/api/bands/${bandId}/stage-sessions/`)).daten.session.id ===
      sessionId,
    "Paralleler Start erzeugt eine zweite Sitzung",
  );

  const fremdStart = await fremd.ruf(
    `/api/bands/${bandId}/stage-sessions/`,
    { methode: "POST", koerper: { setlist_id: setlistId, connection_id: randomUUID() } },
  );
  pruefe(fremdStart.status === 404, "Fremde Band kann starten");

  const detail = await mitglied.ruf(`/api/bands/${bandId}/stage-sessions/${sessionId}/`);
  pruefe(detail.status === 200, "Mitglied liest die Sitzung nicht");
  pruefe(detail.daten.actions.can_control === false, "Mitglied gilt als Leitung");
  const anonym = new Sitzung(basis);
  pruefe(
    (await anonym.ruf(`/api/bands/${bandId}/stage-sessions/${sessionId}/`)).status === 401,
    "Anonymer Zugriff ist nicht 401",
  );
  const fremdDetail = await fremd.ruf(
    `/api/bands/${bandId}/stage-sessions/${sessionId}/`,
  );
  pruefe(fremdDetail.status === 404, "Fremde Band sieht die Sitzung");

  // Snapshot bleibt trotz Setlist-Änderung, neuer PDF-Version und Löschung.
  const geaendert = await leitung.ruf(
    `/api/bands/${bandId}/setlists/${setlistId}/content/`,
    {
      methode: "PUT",
      koerper: {
        revision,
        sections: [
          {
            name: "Neu",
            kind: "set",
            entries: [{ entry_type: "song", song_id: songA }],
          },
        ],
      },
    },
  );
  pruefe(geaendert.status === 200, "Setlist-Änderung scheitert");
  const neueVersion = await leitung.datei(
    `${dokumentPfad(songA)}versions/`,
    pdfBytes({ seiten: [{ width: 400, height: 600, rotate: 0 }] }),
    { uploadId: randomUUID() },
  );
  const dokumentA = await leitung.ruf(dokumentPfad(songA));
  await leitung.ruf(dokumentPfad(songA), {
    methode: "PATCH",
    koerper: {
      revision: dokumentA.daten.revision,
      active_version_id: neueVersion.daten.id,
    },
  });
  const unveraendert = await mitglied.ruf(
    `/api/bands/${bandId}/stage-sessions/${sessionId}/`,
  );
  pruefe(
    unveraendert.daten.sections[0].name === "Set" &&
      unveraendert.daten.sections[0].entries.length === 4 &&
      unveraendert.daten.sections[0].entries[0].document.version_id ===
        versionA.daten.id,
    "Snapshot folgt späteren Änderungen",
  );

  const sync = await mitglied.ruf(`/api/bands/${bandId}/sync/`);
  pruefe(sync.daten.stage?.id === sessionId, "Abgleich enthält keine Bühnensitzung");

  // Teilnehmer sendet: abgelehnt, ohne Nummer zu verbrauchen.
  const mitgliedBefehl = await befehl(mitgliedWs, {
    sessionId,
    generation: 1,
    number: 1,
    command: { kind: "goto", entry_uuid: songEintrag1.uuid, page: 2 },
  });
  pruefe(
    mitgliedBefehl.status === "rejected",
    "Nicht-Leitung steuert die Sitzung",
  );

  const ersteKennung = randomUUID();
  const ersteAntwort = await befehl(leitungWs, {
    sessionId,
    generation: 1,
    number: 1,
    commandId: ersteKennung,
    command: { kind: "goto", entry_uuid: songEintrag1.uuid, page: 2 },
  });
  pruefe(ersteAntwort.status === "confirmed", "Leitung steuert nicht");
  const wiederholt = await befehl(leitungWs, {
    sessionId,
    generation: 1,
    number: 1,
    commandId: ersteKennung,
    command: { kind: "goto", entry_uuid: songEintrag1.uuid, page: 2 },
  });
  pruefe(
    wiederholt.status === "confirmed" &&
      wiederholt.revision === ersteAntwort.revision,
    "Identischer Befehl bestätigt doppelt",
  );

  const pauseZiel = await befehl(leitungWs, {
    sessionId,
    generation: 1,
    number: 2,
    command: { kind: "goto", entry_uuid: pauseEintrag.uuid, page: 1 },
  });
  pruefe(pauseZiel.status === "rejected", "Pause ist ein Steuerziel");
  const seiteZwei = await befehl(leitungWs, {
    sessionId,
    generation: 1,
    number: 2,
    command: { kind: "goto", entry_uuid: songEintrag1.uuid, page: 3 },
  });
  pruefe(seiteZwei.status === "confirmed", "Nächste Nummer wirkt nicht");

  for (const seite of [0, 4]) {
    const grenze = await befehl(leitungWs, {
      sessionId,
      generation: 1,
      number: 3,
      command: { kind: "goto", entry_uuid: songEintrag1.uuid, page: seite },
    });
    pruefe(grenze.status === "rejected", `Seite ${seite} wird angenommen`);
  }
  const ohnePdf = await befehl(leitungWs, {
    sessionId,
    generation: 1,
    number: 3,
    command: { kind: "goto", entry_uuid: songEintrag2.uuid, page: null },
  });
  pruefe(ohnePdf.status === "confirmed", "Song ohne PDF ist kein Ziel");
  const uebersprungen = await befehl(leitungWs, {
    sessionId,
    generation: 1,
    number: 5,
    command: { kind: "goto", entry_uuid: songEintrag1.uuid, page: 1 },
  });
  pruefe(uebersprungen.status === "rejected", "Übersprungene Nummer wird angenommen");

  const zweiterTab = await verbinde(basis, bandId, leitung);
  const tabBefehl = await befehl(zweiterTab, {
    sessionId,
    generation: 1,
    number: 4,
    command: { kind: "goto", entry_uuid: songEintrag1.uuid, page: 1 },
  });
  pruefe(tabBefehl.status === "rejected", "Zweiter Tab steuert ohne Übergabe");

  const folgeEreignis = mitgliedWs.naechste(
    (nachricht) =>
      nachricht.type === "event" &&
      nachricht.event === "stage.state" &&
      nachricht.data.current?.entry_uuid === songEintrag2.uuid,
  );
  const letzterBefehl = await befehl(leitungWs, {
    sessionId,
    generation: 1,
    number: 4,
    command: { kind: "goto", entry_uuid: songEintrag2.uuid, page: null },
  });
  pruefe(letzterBefehl.status === "confirmed", "Letzter gültiger Befehl scheitert");
  const ereignis = await folgeEreignis;
  pruefe(
    ereignis.data.generation === 1,
    "Bühnenereignis trägt die falsche Generation",
  );

  // PDF-Zugriff für Mitglieder, danach Mitgliedschaftsentzug.
  const dateiPfad = `${dokumentPfad(songA)}versions/${versionA.daten.id}/file/`;
  const dateiAntwort = await mitglied.hole(`${basis}${dateiPfad}`, {
    headers: mitglied.kopfzeilen(),
  });
  pruefe(dateiAntwort.status === 200, "Mitglied lädt die Snapshot-PDF nicht");

  const csrf = await fetch(`${basis}/api/bands/${bandId}/stage-sessions/${sessionId}/end/`, {
    method: "POST",
    headers: { ...owner.kopfzeilen(), "Content-Type": "application/json" },
    body: JSON.stringify({ connection_id: ownerVerbindung }),
  });
  pruefe([401, 403].includes(csrf.status), "Lifecycle ohne CSRF wird angenommen");

  const memberEnde = await mitglied.ruf(
    `/api/bands/${bandId}/stage-sessions/${sessionId}/end/`,
    { methode: "POST", koerper: { connection_id: mitgliedVerbindung } },
  );
  pruefe(memberEnde.status === 403, "Einfaches Mitglied beendet die Sitzung");

  const ownerEnde = await owner.ruf(
    `/api/bands/${bandId}/stage-sessions/${sessionId}/end/`,
    { methode: "POST", koerper: { connection_id: ownerVerbindung } },
  );
  pruefe(ownerEnde.status === 200, "Owner beendet nicht");
  pruefe(ownerEnde.daten.state === "ended", "Sitzung bleibt aktiv");
  const nachEnde = await befehl(leitungWs, {
    sessionId,
    generation: 1,
    number: 5,
    command: { kind: "goto", entry_uuid: songEintrag1.uuid, page: 1 },
  });
  pruefe(nachEnde.status === "rejected", "Alter Befehl nach Ende wird angenommen");

  // Neue Sitzung mit Übergabe.
  const start2 = await leitung.ruf(`/api/bands/${bandId}/stage-sessions/`, {
    methode: "POST",
    koerper: { setlist_id: setlistId, connection_id: leitungVerbindung },
  });
  pruefe(start2.status === 201, "Neustart scheitert");
  const session2 = start2.daten.id;
  pruefe(session2 !== sessionId, "Neustart behält die Sitzungskennung");
  const detail2 = await leitung.ruf(
    `/api/bands/${bandId}/stage-sessions/${session2}/`,
  );
  const song2Uuid = detail2.daten.sections[0].entries[0].uuid;
  const mitgliedId = Number(
    shell("from accounts.models import User; print(User.objects.get(username='buehne2').id)"),
  );
  const uebergabe = await leitung.ruf(
    `/api/bands/${bandId}/stage-sessions/${session2}/handover/`,
    {
      methode: "POST",
      koerper: {
        connection_id: leitungVerbindung,
        target_user_id: mitgliedId,
      },
    },
  );
  pruefe(uebergabe.status === 200, "Übergabe scheitert");
  pruefe(uebergabe.daten.generation === 2, "Übergabe erhöht die Generation nicht");
  const mitgliedAlsLeitung = await befehl(mitgliedWs, {
    sessionId: session2,
    generation: 2,
    number: 1,
    command: { kind: "goto", entry_uuid: song2Uuid, page: 1 },
  });
  pruefe(
    mitgliedAlsLeitung.status === "confirmed",
    `Übernommene Leitung steuert nicht: ${JSON.stringify(mitgliedAlsLeitung)}`,
  );
  const alteLeitung = await befehl(leitungWs, {
    sessionId: session2,
    generation: 2,
    number: 1,
    command: { kind: "goto", entry_uuid: song2Uuid, page: 1 },
  });
  pruefe(alteLeitung.status === "rejected", "Alte Leitung steuert nach Übergabe");
  const rueckkehrNachUebergabe = await leitung.ruf(
    `/api/bands/${bandId}/stage-sessions/${session2}/resume/`,
    { methode: "POST", koerper: { connection_id: leitungVerbindung } },
  );
  pruefe(
    [403, 409].includes(rueckkehrNachUebergabe.status),
    "Alte Leitung fordert nach Übergabe zurück",
  );

  // Owner-Übernahme in der zweiten Sitzung.
  const uebernahme = await owner.ruf(
    `/api/bands/${bandId}/stage-sessions/${session2}/takeover/`,
    { methode: "POST", koerper: { connection_id: ownerVerbindung } },
  );
  pruefe(uebernahme.status === 200, "Owner-Übernahme scheitert");
  const neueGeneration = uebernahme.daten.generation;
  pruefe(neueGeneration === 3, "Übernahme erhöht die Generation nicht");
  pruefe(neueGeneration > 1, "Übernahme erhöht die Generation nicht");
  const alt = await befehl(leitungWs, {
    sessionId: session2,
    generation: neueGeneration - 1,
    number: 1,
    command: { kind: "goto", entry_uuid: song2Uuid, page: 1 },
  });
  pruefe(alt.status === "rejected", "Alte Generation steuert weiter");
  const ownerBefehl = await befehl(ownerWs, {
    sessionId: session2,
    generation: neueGeneration,
    number: 1,
    command: { kind: "goto", entry_uuid: song2Uuid, page: 1 },
  });
  pruefe(ownerBefehl.status === "confirmed", "Neue Leitung steuert nicht");
  const rueckkehr = await leitung.ruf(
    `/api/bands/${bandId}/stage-sessions/${session2}/resume/`,
    { methode: "POST", koerper: { connection_id: leitungVerbindung } },
  );
  pruefe([403, 409].includes(rueckkehr.status), "Alte Leitung kehrt nach Übernahme zurück");

  // Ende, neuer Start, Leitungsverlust und ausdrückliche Rückkehr.
  await owner.ruf(`/api/bands/${bandId}/stage-sessions/${session2}/end/`, {
    methode: "POST",
    koerper: { connection_id: ownerVerbindung },
  });
  const start3 = await leitung.ruf(`/api/bands/${bandId}/stage-sessions/`, {
    methode: "POST",
    koerper: { setlist_id: setlistId, connection_id: leitungVerbindung },
  });
  pruefe(start3.status === 201, "Dritter Start scheitert");
  const session3 = start3.daten.id;
  const loeschen = await leitung.ruf(
    `/api/bands/${bandId}/setlists/${setlistId}/`,
    { methode: "DELETE" },
  );
  pruefe(loeschen.status === 204, "Setlist lässt sich nicht löschen");
  const nachLoeschung = await leitung.ruf(
    `/api/bands/${bandId}/stage-sessions/${session3}/`,
  );
  pruefe(
    nachLoeschung.daten.sections[0].entries.length >= 1,
    "Setlist-Löschung schneidet den Snapshot ab",
  );
  leitungWs.schliessen();
  await warteBis(async () => {
    const stand = await leitung.ruf(
      `/api/bands/${bandId}/stage-sessions/${session3}/`,
    );
    return stand.daten.leader_connection_active === false;
  }, "Leitungsverlust wird nicht erkannt");
  const leitungNeu = await verbinde(basis, bandId, leitung);
  const rueck = await leitung.ruf(
    `/api/bands/${bandId}/stage-sessions/${session3}/resume/`,
    {
      methode: "POST",
      koerper: { connection_id: leitungNeu.bereit.connection },
    },
  );
  pruefe(rueck.status === 200, "Rückkehr nach Leitungsverlust scheitert");
  pruefe(rueck.daten.generation === 2, "Rückkehr erhöht die Generation nicht");
  const alteGen = await befehl(leitungNeu, {
    sessionId: session3,
    generation: 1,
    number: 1,
    command: { kind: "goto", entry_uuid: song2Uuid, page: 1 },
  });
  pruefe(alteGen.status === "rejected", "Alte Generation nach Rückkehr wirkt");

  // Mitgliedschaftsentzug sperrt Sitzung und PDF serverseitig.
  shell(
    `from bands.models import Membership; from accounts.models import User; Membership.objects.filter(band_id=${bandId}, user=User.objects.get(username='buehne2')).delete()`,
  );
  const nachEntzug = await mitglied.ruf(
    `/api/bands/${bandId}/stage-sessions/${session3}/`,
  );
  pruefe(nachEntzug.status === 404, "Sitzung bleibt nach Mitgliedschaftsentzug sichtbar");
  const dateiEntzug = await mitglied.hole(`${basis}${dateiPfad}`, {
    headers: mitglied.kopfzeilen(),
  });
  pruefe(
    [401, 403, 404].includes(dateiEntzug.status),
    "PDF bleibt nach Mitgliedschaftsentzug lesbar",
  );

  await leitung.ruf(`/api/bands/${bandId}/stage-sessions/${session3}/end/`, {
    methode: "POST",
    koerper: { connection_id: leitungNeu.bereit.connection },
  });

  await warteAuf(
    () =>
      shell(
        "from realtime.models import OutboxEvent; print(OutboxEvent.objects.filter(published_at__isnull=True).count())",
      ) === "0",
    "Relay veröffentlicht Bühnenereignisse nicht",
  );
  void fremd;
  leitungNeu.schliessen();
  mitgliedWs.schliessen();
  ownerWs.schliessen();
  zweiterTab.schliessen();
}
