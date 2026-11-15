/**
 * HTTP-Smoke für Auftritte (R10). Nutzt die bereits angemeldeten Sitzungen
 * aus verify-kern.mjs und räumt seine Daten wieder auf.
 */
export async function pruefeGigs({ erste, zweite, bandId, setlistId, pruefe }) {
  const liste = `/api/bands/${bandId}/gigs/`;
  const detail = (id) => `${liste}${id}/`;

  const angelegt = await erste.ruf(liste, {
    methode: "POST",
    koerper: {
      title: "Smoke-Auftritt",
      date: "2099-12-31",
      time: "20:00",
      location: "Halle",
      notes: "Notiz",
      setlist_id: setlistId,
    },
  });
  pruefe(angelegt.status === 201, "Auftritt anlegen scheitert");
  pruefe(
    angelegt.daten?.setlist_id === setlistId,
    "Auftritt übernimmt die Setlist nicht",
  );
  const gigId = angelegt.daten.id;

  const gelesen = await erste.ruf(detail(gigId));
  pruefe(
    gelesen.status === 200 && gelesen.daten?.title === "Smoke-Auftritt",
    "Auftritt lesen scheitert",
  );
  pruefe(
    typeof gelesen.daten?.setlist_name === "string",
    "Auftrittsdetail nennt die Setlist nicht",
  );

  const geaendert = await erste.ruf(detail(gigId), {
    methode: "PATCH",
    koerper: { title: "Smoke-Auftritt (neu)", location: "Hof" },
  });
  pruefe(
    geaendert.status === 200 &&
      geaendert.daten?.title === "Smoke-Auftritt (neu)" &&
      geaendert.daten?.setlist_id === setlistId,
    "Auftritt ändern scheitert oder verliert die Setlist",
  );

  pruefe(
    (await zweite.ruf(liste)).status === 404,
    "Zweites Konto sieht fremde Auftritte",
  );
  pruefe(
    (await zweite.ruf(detail(gigId))).status === 404,
    "Zweites Konto liest einen fremden Auftritt",
  );

  const gruppen = await erste.ruf(liste);
  pruefe(
    gruppen.status === 200 &&
      Array.isArray(gruppen.daten?.upcoming) &&
      Array.isArray(gruppen.daten?.past),
    "Auftrittsliste ist nicht gruppiert",
  );
  pruefe(
    gruppen.daten.upcoming.some((gig) => gig.id === gigId),
    "Kommender Auftritt steht nicht in der Gruppe Kommend",
  );

  pruefe(
    (await erste.ruf(detail(gigId), { methode: "DELETE" })).status === 204,
    "Auftritt löschen scheitert",
  );

  const mitSetlist = await erste.ruf(liste, {
    methode: "POST",
    koerper: {
      title: "Setlist-Bindung",
      date: "2099-12-30",
      setlist_id: setlistId,
    },
  });
  pruefe(mitSetlist.status === 201, "Zweiter Auftritt anlegen scheitert");
  const zweiterAuftritt = mitSetlist.daten.id;

  pruefe(
    (
      await erste.ruf(`/api/bands/${bandId}/setlists/${setlistId}/`, {
        methode: "DELETE",
      })
    ).status === 204,
    "Setlist löschen scheitert",
  );
  const nachLoeschung = await erste.ruf(detail(zweiterAuftritt));
  pruefe(
    nachLoeschung.status === 200 && nachLoeschung.daten?.setlist_id === null,
    "Setlist-Löschung entfernt den Auftritt oder lässt die Verknüpfung stehen",
  );
  pruefe(
    (await erste.ruf(detail(zweiterAuftritt), { methode: "DELETE" })).status === 204,
    "Auftritt nach der Setlist-Löschung aufräumen scheitert",
  );
}
