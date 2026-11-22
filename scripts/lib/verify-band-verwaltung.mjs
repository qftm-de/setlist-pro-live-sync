/**
 * Smoke für Band-Einstellungen, Mitgliederverwaltung und Einladungslinks (R21, R22).
 * Echter HTTP-Weg über nginx, kein Mock.
 */
import { randomUUID } from "node:crypto";
import { Sitzung } from "./verify-session.mjs";

const warte = (ms) => new Promise((fertig) => setTimeout(fertig, ms));

function zaehleSchluessel(daten) {
  return Object.keys(daten).sort().join(",");
}

export async function pruefeBandVerwaltung({ erste, zweite, bandId, basis, pruefe }) {
  const bandPfad = `/api/bands/${bandId}/`;

  const einstellungen = await erste.ruf(bandPfad, {
    methode: "PATCH",
    koerper: {
      genre: "Rock",
      location: "Proberaum Nord",
      description: "Beschreibung aus dem Smoke",
      internal_notes: "Interne Notiz aus dem Smoke",
    },
  });
  pruefe(
    einstellungen.status === 200 &&
      einstellungen.daten?.genre === "Rock" &&
      einstellungen.daten?.internal_notes === "Interne Notiz aus dem Smoke",
    "Band-Einstellungen speichern scheitert",
  );
  pruefe(
    (await zweite.ruf(bandPfad, { methode: "PATCH", koerper: { name: "Fremd" } })).status === 404,
    "Fremde Band lässt sich ändern",
  );
  pruefe(
    (await erste.ruf(bandPfad, { methode: "PATCH", koerper: { name: "   " } })).status === 400,
    "Leerer Bandname wird akzeptiert",
  );

  const erstellt = await erste.ruf(`${bandPfad}invitations/`, {
    methode: "POST",
    koerper: { note: "Smoke-Einladung", max_uses: null },
  });
  pruefe(
    erstellt.status === 201 && erstellt.daten?.token && erstellt.daten?.invite_path,
    "Einladungslink anlegen scheitert",
  );
  const token = erstellt.daten.token;
  const einladungId = erstellt.daten.id;
  const vorschauPfad = `/api/invitations/${encodeURIComponent(token)}/`;

  const liste = await erste.ruf(`${bandPfad}invitations/`);
  pruefe(
    Array.isArray(liste.daten) &&
      liste.daten.length >= 1 &&
      liste.daten.every((eintrag) => !("token" in eintrag) && !("token_hash" in eintrag)),
    "Einladungsliste zeigt einen Token",
  );
  pruefe(
    (await zweite.ruf(`${bandPfad}invitations/`)).status === 404,
    "Fremde sieht Einladungen",
  );

  const gast = new Sitzung(basis);
  const vorschau = await gast.ruf(vorschauPfad);
  pruefe(vorschau.status === 200, "Öffentliche Vorschau scheitert");
  pruefe(
    zaehleSchluessel(vorschau.daten) ===
      "already_member,authenticated,band_name,expires_at",
    `Vorschau liefert fremde Schlüssel: ${zaehleSchluessel(vorschau.daten)}`,
  );
  pruefe(vorschau.daten?.band_name === "Pilotband", "Vorschau nennt die falsche Band");

  const nachVorschau = await erste.ruf(`${bandPfad}invitations/`);
  const vorher = nachVorschau.daten.find((eintrag) => eintrag.id === einladungId);
  pruefe(vorher?.uses_count === 0, "Vorschau zählt als Nutzung");

  const benutzer = `gast-${randomUUID().slice(0, 8)}`;
  const beitritt = await gast.ruf(`${vorschauPfad}accept/`, {
    methode: "POST",
    koerper: {
      mode: "register",
      username: benutzer,
      display_name: "Gast im Smoke",
      email: `${benutzer}@example.test`,
      password: `Gast-${randomUUID()}-9x`,
    },
  });
  pruefe(
    beitritt.status === 201 && beitritt.daten?.joined === true,
    "Beitritt mit neuem Konto scheitert",
  );
  const neueBandId = beitritt.daten?.band?.id;
  pruefe(Number(neueBandId) === Number(bandId), "Beitritt meldet die falsche Band");

  const alsMitglied = await gast.ruf(bandPfad);
  pruefe(
    alsMitglied.status === 200 &&
      alsMitglied.daten?.role === "member" &&
      alsMitglied.daten?.can_manage === false,
    "Neues Mitglied liest die Band nicht als Mitglied",
  );
  pruefe(
    alsMitglied.daten?.genre === "Rock" &&
      alsMitglied.daten?.internal_notes === "Interne Notiz aus dem Smoke",
    "Mitglied liest die Bandfelder nicht",
  );
  pruefe(
    (await gast.ruf(bandPfad, { methode: "PATCH", koerper: { name: "Gekapert" } })).status === 403,
    "Mitglied darf Band-Einstellungen ändern",
  );
  const mitglieder = await gast.ruf(`${bandPfad}members/`);
  pruefe(
    mitglieder.status === 200 &&
      mitglieder.daten.every((eintrag) => !("email" in eintrag)),
    "Mitgliederliste enthält E-Mail-Adressen",
  );

  const eigeneZeile = mitglieder.daten.find((eintrag) => eintrag.is_self);
  pruefe(eigeneZeile?.role === "member", "Neues Mitglied hat nicht die Rolle member");
  const zweiteZeile = mitglieder.daten.find((eintrag) => eintrag.role === "owner");
  pruefe(
    (await gast.ruf(`${bandPfad}members/${zweiteZeile.id}/`, { methode: "DELETE" })).status ===
      403,
    "Mitglied entfernt einen anderen",
  );

  const hoch = await erste.ruf(`${bandPfad}members/${eigeneZeile.id}/`, {
    methode: "PATCH",
    koerper: { role: "owner" },
  });
  pruefe(hoch.status === 200, "Owner stuft Mitglied nicht hoch");
  const runter = await erste.ruf(`${bandPfad}members/${eigeneZeile.id}/`, {
    methode: "PATCH",
    koerper: { role: "member" },
  });
  pruefe(runter.status === 200, "Owner stuft Mitglied nicht herab");
  pruefe(
    (await erste.ruf(`${bandPfad}members/${eigeneZeile.id}/`, { methode: "DELETE" })).status ===
      204,
    "Owner entfernt Mitglied nicht",
  );
  pruefe((await gast.ruf(bandPfad)).status === 404, "Entferntes Mitglied sieht die Band weiter");

  const wieder = await gast.ruf(`${vorschauPfad}accept/`, { methode: "POST", koerper: {} });
  pruefe(
    wieder.status === 200 && wieder.daten?.joined === true,
    "Wiedereintritt über den Link scheitert",
  );
  pruefe(
    (await gast.ruf(bandPfad)).daten?.role === "member",
    "Wiedereintritt ergibt nicht die Rolle member",
  );
  const erneut = await gast.ruf(`${vorschauPfad}accept/`, { methode: "POST", koerper: {} });
  pruefe(
    erneut.status === 200 && erneut.daten?.joined === false,
    "Wiederholter Beitritt ist nicht idempotent",
  );

  const widerrufen = await erste.ruf(`${bandPfad}invitations/${einladungId}/`, {
    methode: "DELETE",
  });
  pruefe(widerrufen.status === 200, "Widerruf scheitert");
  const vorschauNachher = await gast.ruf(vorschauPfad);
  pruefe(
    vorschauNachher.status === 404,
    `Widerrufener Link liefert in der Vorschau ${vorschauNachher.status}`,
  );
  const beitrittNachher = await gast.ruf(`${vorschauPfad}accept/`, {
    methode: "POST",
    koerper: {},
  });
  pruefe(
    beitrittNachher.status === 404,
    `Widerrufener Link erlaubt den Beitritt mit ${beitrittNachher.status}`,
  );

  const limitEinladung = await erste.ruf(`${bandPfad}invitations/`, {
    methode: "POST",
    koerper: { note: "Rate-Limit", max_uses: null },
  });
  pruefe(limitEinladung.status === 201, "Zweiter Link für das Rate-Limit fehlt");
  const limitPfad = `/api/invitations/${encodeURIComponent(limitEinladung.daten.token)}/`;
  const limitSitzung = new Sitzung(basis);
  const status = [];
  for (let lauf = 0; lauf < 12; lauf += 1) {
    status.push((await limitSitzung.ruf(limitPfad)).status);
  }
  pruefe(
    status.filter((wert) => wert === 429).length > 0,
    `nginx-Rate-Limit greift nicht (${status.join(",")})`,
  );
  await warte(3500);
  const erholt = await limitSitzung.ruf(limitPfad);
  pruefe(
    erholt.status === 200,
    `Vorschau bleibt nach dem Rate-Limit gesperrt (${erholt.status})`,
  );
}
