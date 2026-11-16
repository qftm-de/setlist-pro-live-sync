/**
 * R14: Revision, UUID-Abgleich, Einzelbefehle, gemeinsame Texte und
 * Anmerkungsrechte gegen echte Container und echte WebSockets.
 */
import { randomUUID } from "node:crypto";
import { verbinde } from "./echtzeit.mjs";

const sleep = (ms) => new Promise((fertig) => setTimeout(fertig, ms));

function crdtUpdate(shell, state, text) {
  const code =
    "import base64, json\n" +
    "from pycrdt import Doc, Text\n" +
    "d = Doc()\n" +
    `d.apply_update(base64.b64decode(${JSON.stringify(state)}))\n` +
    "t = d.get('t', type=Text)\n" +
    `t += json.loads(${JSON.stringify(JSON.stringify(text))})\n` +
    "print(base64.b64encode(d.get_update()).decode())";
  return shell(code);
}

async function texte(basis, sitzung, bandId, setlistId) {
  const antwort = await sitzung.ruf(
    `/api/bands/${bandId}/setlists/${setlistId}/texts/`,
  );
  return antwort;
}

export async function pruefeMitarbeit({
  basis,
  erste,
  zweite,
  bandId,
  songIdA,
  songIdB,
  pruefe,
  shell,
  warteAuf,
}) {
  const setlist = await erste.ruf(`/api/bands/${bandId}/setlists/`, {
    methode: "POST",
    koerper: { name: `Mitarbeit ${randomUUID().slice(0, 8)}` },
  });
  pruefe(setlist.status === 201, "Setlist anlegen scheitert");
  const setlistId = setlist.daten.id;
  const basisPfad = `/api/bands/${bandId}/setlists/${setlistId}/`;

  const ohneRevision = await erste.ruf(`${basisPfad}content/`, {
    methode: "PUT",
    koerper: { sections: [{ name: "Set", kind: "set" }] },
  });
  pruefe(ohneRevision.status === 400, "PUT ohne Revision ist nicht 400");

  const ersteFassung = await erste.ruf(`${basisPfad}content/`, {
    methode: "PUT",
    koerper: {
      revision: 0,
      sections: [
        {
          name: "Set",
          kind: "set",
          entries: [{ entry_type: "song", song_id: songIdA }],
        },
      ],
    },
  });
  pruefe(ersteFassung.status === 200, "PUT mit Revision scheitert");
  const abschnitt = ersteFassung.daten.sections[0];
  const eintrag = abschnitt.entries[0];
  pruefe(
    typeof abschnitt.uuid === "string" && typeof eintrag.uuid === "string",
    "Setlist liefert keine UUIDs",
  );

  const veraltet = await erste.ruf(`${basisPfad}content/`, {
    methode: "PUT",
    koerper: { revision: 0, sections: [{ name: "Set", kind: "set" }] },
  });
  pruefe(veraltet.status === 409, "Veralteter PUT ist nicht 409");

  const zweiteFassung = await zweite.ruf(`${basisPfad}content/`, {
    methode: "PUT",
    koerper: {
      revision: ersteFassung.daten.revision,
      sections: [
        {
          uuid: abschnitt.uuid,
          name: "Set 1",
          kind: "set",
          entries: [
            {
              uuid: eintrag.uuid,
              entry_type: "song",
              song_id: songIdA,
            },
            { entry_type: "song", song_id: songIdB },
          ],
        },
      ],
    },
  });
  pruefe(zweiteFassung.status === 200, "Zweiter PUT scheitert");
  pruefe(
    zweiteFassung.daten.sections[0].uuid === abschnitt.uuid &&
      zweiteFassung.daten.sections[0].entries[0].uuid === eintrag.uuid,
    "UUIDs bleiben beim PUT nicht erhalten",
  );

  // Move im selben Abschnitt an den Anfang: darf den Positions-Constraint
  // nicht verletzen.
  const zweiterEintrag = zweiteFassung.daten.sections[0].entries[1];
  const verschoben = await zweite.ruf(`${basisPfad}commands/`, {
    methode: "POST",
    koerper: {
      command_id: randomUUID(),
      kind: "entry.move",
      payload: {
        uuid: zweiterEintrag.uuid,
        section_uuid: abschnitt.uuid,
        after_entry_uuid: null,
      },
    },
  });
  pruefe(
    verschoben.status === 200 &&
      verschoben.daten.sections[0].entries[0].uuid === zweiterEintrag.uuid,
    "Move im selben Abschnitt scheitert",
  );

  const befehlsId = randomUUID();
  const neuerAbschnitt = randomUUID();
  const befehl = {
    command_id: befehlsId,
    kind: "section.create",
    payload: { uuid: neuerAbschnitt, name: "Zugabe", kind: "zugabe" },
  };
  const ausgefuehrt = await erste.ruf(`${basisPfad}commands/`, {
    methode: "POST",
    koerper: befehl,
  });
  pruefe(ausgefuehrt.status === 200, "Einzelbefehl scheitert");
  const wiederholt = await erste.ruf(`${basisPfad}commands/`, {
    methode: "POST",
    koerper: befehl,
  });
  pruefe(
    wiederholt.status === 200 &&
      wiederholt.daten.revision === ausgefuehrt.daten.revision,
    "Identischer Befehl wiederholt die Mutation",
  );
  const konflikt = await erste.ruf(`${basisPfad}commands/`, {
    methode: "POST",
    koerper: {
      ...befehl,
      payload: { ...befehl.payload, name: "Anders" },
    },
  });
  pruefe(konflikt.status === 409, "Gleiche Kennung mit anderen Daten ist nicht 409");

  const geloescht = await erste.ruf(`${basisPfad}commands/`, {
    methode: "POST",
    koerper: {
      command_id: randomUUID(),
      kind: "section.delete",
      payload: { uuid: neuerAbschnitt },
    },
  });
  pruefe(geloescht.status === 200, "Abschnitt löschen scheitert");
  const spaet = await erste.ruf(`${basisPfad}commands/`, {
    methode: "POST",
    koerper: {
      command_id: randomUUID(),
      kind: "section.update",
      payload: { uuid: neuerAbschnitt, name: "Spät" },
    },
  });
  pruefe(spaet.status === 409, "Bearbeitung nach Löschen ist nicht gesperrt");

  const nachbarFehlt = await erste.ruf(`${basisPfad}commands/`, {
    methode: "POST",
    koerper: {
      command_id: randomUUID(),
      kind: "section.move",
      payload: { uuid: abschnitt.uuid, after_section_uuid: randomUUID() },
    },
  });
  pruefe(nachbarFehlt.status === 409, "Fehlender Nachbar ist nicht 409");

  // Zwei gleichzeitige Befehle auf verschiedenen Abschnitten bleiben erhalten.
  const parallel = await Promise.all(
    [randomUUID(), randomUUID()].map((kennung) =>
      zweite.ruf(`${basisPfad}commands/`, {
        methode: "POST",
        koerper: {
          command_id: randomUUID(),
          kind: "section.create",
          payload: { uuid: kennung, name: `P ${kennung.slice(0, 4)}`, kind: "set" },
        },
      }),
    ),
  );
  pruefe(
    parallel.every((antwort) => antwort.status === 200),
    "Parallele Befehle scheitern",
  );

  // Gemeinsame Texte: zwei Updates derselben Epoche werden zusammengeführt.
  const stand = (await texte(basis, erste, bandId, setlistId)).daten.texts.find(
    (eintrag) => eintrag.object_type === "setlist",
  );
  pruefe(Boolean(stand), "Setlist-Textzustand fehlt");
  const updateA = crdtUpdate(shell, stand.state, " A");
  const updateB = crdtUpdate(shell, stand.state, " B");

  const textA = await erste.ruf(`${basisPfad}text/`, {
    methode: "POST",
    koerper: {
      object_type: "setlist",
      object_uuid: stand.object_uuid,
      field: "name",
      epoch: stand.epoch,
      update: updateA,
    },
  });
  pruefe(textA.status === 200, "Erstes Textupdate scheitert");
  const textB = await zweite.ruf(`${basisPfad}text/`, {
    methode: "POST",
    koerper: {
      object_type: "setlist",
      object_uuid: stand.object_uuid,
      field: "name",
      epoch: stand.epoch,
      update: updateB,
    },
  });
  pruefe(textB.status === 200, "Zweites Textupdate scheitert");
  pruefe(
    textB.daten.text.includes("A") && textB.daten.text.includes("B"),
    "Gleichzeitige Textupdates werden nicht zusammengeführt",
  );

  const zuGross = await erste.ruf(`${basisPfad}text/`, {
    methode: "POST",
    koerper: {
      object_type: "setlist",
      object_uuid: stand.object_uuid,
      field: "name",
      epoch: textB.daten.epoch,
      update: Buffer.alloc(64 * 1024 + 1, 120).toString("base64"),
    },
  });
  pruefe(zuGross.status === 400, "Update über 64 KiB wird nicht abgewiesen");

  await erste.ruf(`${basisPfad}`, {
    methode: "PATCH",
    koerper: { name: `Neu ${randomUUID().slice(0, 4)}` },
  });
  const alteEpoche = await erste.ruf(`${basisPfad}text/`, {
    methode: "POST",
    koerper: {
      object_type: "setlist",
      object_uuid: stand.object_uuid,
      field: "name",
      epoch: textB.daten.epoch,
      update: updateA,
    },
  });
  pruefe(
    alteEpoche.status === 409,
    "Alte Text-Epoche nach REST-Ersetzung ist nicht 409",
  );

  // Bandweite Anmerkung: Mitglied bearbeitet, Autor bleibt, Sichtbarkeit gesperrt.
  const version = await erste.ruf(
    `/api/bands/${bandId}/songs/${songIdA}/document/`,
  );
  const versionId = version.daten.active_version_id ?? version.daten.versions?.[0]?.id;
  pruefe(Boolean(versionId), "Keine PDF-Version für Textprüfung");
  const anmerkung = await erste.ruf(
    `/api/bands/${bandId}/songs/${songIdA}/document/versions/${versionId}/annotations/`,
    {
      methode: "POST",
      koerper: {
        uuid: randomUUID(),
        page_number: 1,
        kind: "text",
        visibility: "band",
        geometry: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 },
        text: "Gemeinsam",
      },
    },
  );
  pruefe(anmerkung.status === 201, "Bandweite Anmerkung scheitert");
  const anmerkungsPfad =
    `/api/bands/${bandId}/songs/${songIdA}/document/versions/${versionId}` +
    `/annotations/${anmerkung.daten.id}/`;
  const mitgliedAendert = await zweite.ruf(anmerkungsPfad, {
    methode: "PATCH",
    koerper: {
      revision: 0,
      geometry: { x: 0.2, y: 0.2, width: 0.2, height: 0.1 },
    },
  });
  pruefe(mitgliedAendert.status === 200, "Mitglied darf bandweite Anmerkung nicht ändern");
  pruefe(
    mitgliedAendert.daten.author_id === anmerkung.daten.author_id,
    "Autor ändert sich beim Bearbeiten",
  );
  const sichtbarkeit = await zweite.ruf(anmerkungsPfad, {
    methode: "PATCH",
    koerper: { revision: 1, visibility: "private" },
  });
  pruefe(sichtbarkeit.status === 403, "Mitglied darf Sichtbarkeit ändern");

  const anmerkungsText = await zweite.ruf(`${anmerkungsPfad}text/`);
  pruefe(anmerkungsText.status === 200, "Anmerkungstext fehlt");
  const anmerkungsUpdate = crdtUpdate(shell, anmerkungsText.daten.state, " jetzt");
  const textAntwort = await zweite.ruf(`${anmerkungsPfad}text/`, {
    methode: "POST",
    koerper: {
      epoch: anmerkungsText.daten.epoch,
      generation: anmerkungsText.daten.generation,
      update: anmerkungsUpdate,
    },
  });
  pruefe(textAntwort.status === 200, "Mitglied ändert bandweiten Text nicht");
  pruefe(
    textAntwort.daten.text.includes("jetzt"),
    "Zusammengeführter Anmerkungstext fehlt",
  );

  const vorPrivat = await erste.ruf(anmerkungsPfad);
  const privat = await erste.ruf(anmerkungsPfad, {
    methode: "PATCH",
    koerper: {
      revision: vorPrivat.daten.revision,
      visibility: "private",
    },
  });
  pruefe(privat.status === 200, "Autor kann nicht privatisieren");
  pruefe(
    (await zweite.ruf(
      `/api/bands/${bandId}/songs/${songIdA}/document/versions/${versionId}/annotations/`,
    )).daten.length === 0,
    "Privatisierte Anmerkung bleibt für Mitglied sichtbar",
  );
  const spaetText = await zweite.ruf(`${anmerkungsPfad}text/`, {
    methode: "POST",
    koerper: {
      epoch: anmerkungsText.daten.epoch,
      generation: anmerkungsText.daten.generation,
      update: anmerkungsUpdate,
    },
  });
  pruefe(
    [403, 404, 409].includes(spaetText.status),
    "Alter Anmerkungstext nach Privatisierung wird angenommen",
  );

  // WebSocket: Text- und Befehlsweg nutzen denselben Schreibdienst.
  const a = await verbinde(basis, bandId, erste);
  const b = await verbinde(basis, bandId, zweite);
  const wsStand = (await texte(basis, erste, bandId, setlistId)).daten.texts.find(
    (eintrag) => eintrag.object_type === "setlist",
  );
  const wsUpdate = crdtUpdate(shell, wsStand.state, " vom Socket");
  const bandSeq = a.bereit.counters.band + 1;
  a.socket.send(
    JSON.stringify({
      type: "text.update",
      object_type: "setlist",
      object_uuid: wsStand.object_uuid,
      field: "name",
      epoch: wsStand.epoch,
      update: wsUpdate,
    }),
  );
  const [textErgebnis, textEreignis] = await Promise.all([
    a.naechste((n) => n.type === "text.result"),
    b.naechste((n) => n.type === "event" && n.event === "text.updated" && n.seq === bandSeq),
  ]);
  pruefe(
    textErgebnis.text.includes("vom Socket"),
    "Textupdate über WebSocket scheitert",
  );
  pruefe(
    textEreignis.data.object_type === "setlist",
    "Textupdate erzeugt kein Bandereignis",
  );

  // Ein zusammengeführter Setlist-Name darf über den WebSocket nicht in eine
  // unbehandelte IntegrityError laufen.
  const kollision = await erste.ruf(`/api/bands/${bandId}/setlists/`, {
    methode: "POST",
    koerper: { name: `${textErgebnis.text} Kollision` },
  });
  pruefe(kollision.status === 201, "Kollisionssetlist anlegen scheitert");
  const kollisionsUpdate = crdtUpdate(shell, textErgebnis.update, " Kollision");
  a.socket.send(
    JSON.stringify({
      type: "text.update",
      object_type: "setlist",
      object_uuid: wsStand.object_uuid,
      field: "name",
      epoch: textErgebnis.epoch,
      update: kollisionsUpdate,
    }),
  );
  const textFehler = await a.naechste(
    (n) => n.type === "text.error" && n.status === 409,
  );
  pruefe(textFehler.status === 409, "Namenskollision über WebSocket ist nicht 409");
  const nachKollision = await erste.ruf(`${basisPfad}`);
  pruefe(
    nachKollision.daten.name === textErgebnis.text,
    "Namenskollision verändert den Setlist-Namen",
  );

  // Größe wird vor dem Dekodieren geprüft.
  a.socket.send(
    JSON.stringify({
      type: "text.update",
      object_type: "setlist",
      object_uuid: wsStand.object_uuid,
      field: "name",
      epoch: textErgebnis.epoch,
      update: "x".repeat(90_001),
    }),
  );
  const wsZuGross = await a.naechste(
    (n) => n.type === "text.error" && n.status === 400,
  );
  pruefe(
    wsZuGross.status === 400,
    "Zu großes WebSocket-Update wird angenommen",
  );

  const wsBefehl = {
    type: "setlist.command",
    setlist_id: setlistId,
    command_id: randomUUID(),
    kind: "section.create",
    payload: { uuid: randomUUID(), name: "Socket", kind: "set" },
  };
  a.socket.send(JSON.stringify(wsBefehl));
  const befehlsErgebnis = await a.naechste((n) => n.type === "command.result");
  pruefe(
    befehlsErgebnis.sections.some((eintrag) => eintrag.name === "Socket"),
    "Befehl über WebSocket scheitert",
  );

  await warteAuf(
    () =>
      shell(
        "from realtime.models import OutboxEvent; print(OutboxEvent.objects.filter(published_at__isnull=True).count())",
      ) === "0",
    "Relay veröffentlicht Text- und Befehlsereignisse nicht",
  );

  await sleep(200);
  a.schliessen();
  b.schliessen();
}
