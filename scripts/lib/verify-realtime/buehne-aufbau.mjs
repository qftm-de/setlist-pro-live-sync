/** Aufbau der Bühnenprüfung: PDFs, Setlist, Sitzung und Verbindungen. */
import { randomUUID } from "node:crypto";
import { pdfBytes } from "../pdf.mjs";
import { verbinde } from "./echtzeit.mjs";

export async function baueBuehne({
  basis,
  leitung,
  mitglied,
  owner,
  bandId,
  songIds,
  pruefe,
}) {
  const [songA, songB] = songIds;
  const dokumentPfad = (songId) =>
    `/api/bands/${bandId}/songs/${songId}/document/`;

  const versionA = await leitung.datei(
    `${dokumentPfad(songA)}versions/`,
    pdfBytes(),
    { uploadId: randomUUID() },
  );
  pruefe(versionA.status === 201, "PDF-Upload scheitert");
  const dokumentA0 = await leitung.ruf(dokumentPfad(songA));
  await leitung.ruf(dokumentPfad(songA), {
    methode: "PATCH",
    koerper: {
      revision: dokumentA0.daten.revision,
      active_version_id: versionA.daten.id,
    },
  });

  const setlist = await leitung.ruf(`/api/bands/${bandId}/setlists/`, {
    methode: "POST",
    koerper: { name: `Buehne ${randomUUID().slice(0, 8)}` },
  });
  pruefe(setlist.status === 201, "Bühnensetlist anlegen scheitert");
  const setlistId = setlist.daten.id;
  const inhalt = await leitung.ruf(
    `/api/bands/${bandId}/setlists/${setlistId}/content/`,
    {
      methode: "PUT",
      koerper: {
        revision: 0,
        sections: [
          {
            name: "Set",
            kind: "set",
            entries: [
              { entry_type: "song", song_id: songA },
              { entry_type: "pause", label: "Ansage" },
              { entry_type: "song", song_id: songB },
              { entry_type: "song", song_id: songA },
            ],
          },
        ],
      },
    },
  );
  pruefe(inhalt.status === 200, "Bühnensetlist speichern scheitert");
  const eintraege = inhalt.daten.sections[0].entries;
  const [songEintrag1, pauseEintrag, songEintrag2] = eintraege;

  const leitungWs = await verbinde(basis, bandId, leitung);
  const mitgliedWs = await verbinde(basis, bandId, mitglied);
  const ownerWs = await verbinde(basis, bandId, owner);
  const leitungVerbindung = leitungWs.bereit.connection;
  const mitgliedVerbindung = mitgliedWs.bereit.connection;
  const ownerVerbindung = ownerWs.bereit.connection;
  pruefe(
    leitungVerbindung && mitgliedVerbindung && ownerVerbindung,
    "ready liefert keine Verbindungskennung",
  );

  return {
    songA,
    songB,
    setlistId,
    revision: inhalt.daten.revision,
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
  };
}

export function befehl(ws, { sessionId, generation, number, commandId, command }) {
  const kennung = commandId ?? randomUUID();
  ws.socket.send(
    JSON.stringify({
      type: "stage.command",
      session_id: sessionId,
      generation,
      number,
      command_id: kennung,
      command,
    }),
  );
  return ws.naechste(
    (nachricht) =>
      nachricht.type === "stage.result" && nachricht.command_id === kennung,
  );
}

export async function warteBis(pruefung, text, versuche = 40) {
  for (let lauf = 0; lauf < versuche; lauf += 1) {
    if (await pruefung()) {
      return;
    }
    await new Promise((fertig) => setTimeout(fertig, 250));
  }
  throw new Error(text);
}
