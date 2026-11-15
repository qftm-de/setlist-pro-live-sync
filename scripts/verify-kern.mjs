#!/usr/bin/env node
/**
 * Kern-Smoke für R6 bis R12: baut den Core, legt Konten an und fährt den
 * echten Weg über nginx und die API. Kein Mock, keine Testdatenbank.
 * PDFs und Anmerkungen prüfen eigene Smoke-Module samt Chromium im selben Lauf.
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Sitzung } from "./lib/verify-session.mjs";
import { pruefeAktivesLimit, pruefeOhneLimit } from "./lib/verify-pdf-limits.mjs";
import { pruefeAnmerkungen } from "./lib/verify-annotations.mjs";
import { pruefeDokumente } from "./lib/verify-documents.mjs";
import { pruefeGigs } from "./lib/verify-gigs.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Eigener Projektname und Port je Lauf. Zwei gleichzeitige Gates würden sonst
// dieselben Container und denselben Port benutzen und sich gegenseitig
// wegräumen (Fehlerbild: "No such container" beim Recreate).
const projekt = `setlist-kern-${process.pid}`;
const port = process.env.WEB_PORT || String(18081 + (process.pid % 400));
const basis = `http://127.0.0.1:${port}`;
const passwort = `pilot-${randomUUID()}`;
const env = {
  ...process.env,
  APP_MODE: "core",
  DJANGO_SECRET_KEY: `kern-${randomUUID()}-${randomUUID()}`,
  DJANGO_DEBUG: "false",
  ALLOWED_HOSTS: "127.0.0.1,localhost,api,web",
  TRUST_PROXY_HEADERS: "false",
  POSTGRES_PASSWORD: `kern-${randomUUID()}`,
  WEB_PORT: port,
  PDF_MAX_UPLOAD_BYTES: "20971520",
  PDF_MAX_PAGES: "100",
};

function compose(args, umgebung = env) {
  return spawnSync("docker", ["compose", "-p", projekt, ...args], {
    cwd: root,
    env: umgebung,
    encoding: "utf8",
  });
}

function aufraeumen() {
  compose(["down", "-v", "--remove-orphans"]);
}

function abbruch(text, detail = "") {
  console.error(`Fehlgeschlagen: ${text}`);
  if (detail) {
    console.error(detail);
  }
  aufraeumen();
  process.exit(1);
}

function schritt(args, text, versuche = 1, umgebung = env) {
  let ergebnis = null;
  for (let lauf = 0; lauf < versuche; lauf += 1) {
    ergebnis = compose(args, umgebung);
    if ((ergebnis.status ?? 1) === 0) {
      return ergebnis;
    }
    // Docker raeumt nach einem down gelegentlich noch Container weg, dann
    // scheitert das Recreate. Ein zweiter Anlauf nach down -v reicht.
    if (lauf + 1 < versuche) {
      aufraeumen();
    }
  }
  abbruch(text, `${ergebnis.stdout || ""}${ergebnis.stderr || ""}`);
}

function ausgabe(args, text) {
  return (schritt(args, text).stdout || "").trim();
}


function pruefe(bedingung, text) {
  if (!bedingung) {
    abbruch(text);
  }
}

function frontendPruefen() {
  const frontend = path.join(root, "frontend");
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const lauf = (args, text) => {
    const ergebnis = spawnSync(npm, args, { cwd: frontend, encoding: "utf8" });
    if ((ergebnis.status ?? 1) !== 0) {
      abbruch(text, `${ergebnis.stdout || ""}${ergebnis.stderr || ""}`);
    }
  };
  if (!fs.existsSync(path.join(frontend, "node_modules", "vitest"))) {
    lauf(["ci", "--no-audit", "--no-fund"], "Frontend-Abhängigkeiten installieren");
  }
  lauf(["test"], "Frontend-Tests");
  lauf(["run", "build"], "Frontend-Build");
}

function kontoAnlegen(name) {
  schritt(
    [
      "run",
      "--rm",
      "--no-deps",
      "-e",
      `DJANGO_SUPERUSER_USERNAME=${name}`,
      "-e",
      `DJANGO_SUPERUSER_EMAIL=${name}@example.test`,
      "-e",
      `DJANGO_SUPERUSER_PASSWORD=${passwort}`,
      "api",
      "python",
      "manage.py",
      "createsuperuser",
      "--noinput",
    ],
    `Konto ${name} anlegen`,
  );
}

try {
  frontendPruefen();

  schritt(["config", "-q"], "Compose-Konfiguration");
  schritt(["build"], "Images bauen");
  schritt(["up", "-d", "--wait"], "Core starten", 2);
  schritt(
    [
      "exec",
      "-T",
      "api",
      "python",
      "manage.py",
      "test",
      "api",
      "bands",
      "library",
      "setlists",
      "gigs",
      "annotations",
    ],
    "Backend-Tests",
  );
  kontoAnlegen("pilot");
  kontoAnlegen("pilot2");

  const gesund = await new Sitzung(basis).ruf("/api/health/");
  pruefe(gesund.status === 200 && gesund.daten?.status === "ok", "Health antwortet nicht ok");

  const admin = await fetch(`${basis}/admin/login/`);
  const adminHtml = await admin.text();
  pruefe(admin.status === 200, "Admin-Anmeldung antwortet nicht");
  pruefe(adminHtml.includes('"/static/admin/'), "Admin-Assets zeigen nicht auf /static/");
  pruefe((await fetch(`${basis}/static/admin/css/base.css`)).status === 200, "Admin-Stylesheet fehlt");

  const anonym = new Sitzung(basis);
  const konfiguration = await anonym.ruf("/api/config/");
  pruefe(konfiguration.daten?.mode === "core", "Konfiguration meldet nicht core");
  pruefe((await anonym.ruf("/api/session/")).status === 401, "Session ohne Anmeldung ist nicht 401");
  pruefe((await anonym.ruf("/api/bands/")).status === 401, "Bands ohne Anmeldung sind nicht 401");

  const ohneToken = await fetch(`${basis}/api/anmeldung/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "pilot", password: passwort }),
  });
  pruefe(ohneToken.status === 403, "Anmeldung ohne CSRF-Token ist nicht 403");

  const falsch = await anonym.ruf("/api/anmeldung/", {
    methode: "POST",
    koerper: { username: "pilot", password: "falsch" },
  });
  pruefe(falsch.status === 400 && !JSON.stringify(falsch.daten).includes("pilot"), "Falsches Passwort verrät das Konto");

  const erste = new Sitzung(basis);
  await erste.ruf("/api/config/");
  const anmeldung = await erste.ruf("/api/anmeldung/", {
    methode: "POST",
    koerper: { username: "pilot", password: passwort },
  });
  pruefe(anmeldung.status === 200, "Anmeldung des ersten Kontos scheitert");
  pruefe((await erste.ruf("/api/session/")).daten?.username === "pilot", "Session nennt nicht das Konto");
  const sessionVorher = erste.cookies.get("sessionid");

  pruefe((await erste.ruf("/api/bands/")).daten?.length === 0, "Neues Konto hat schon Bands");

  const band = await erste.ruf("/api/bands/", {
    methode: "POST",
    koerper: { name: "Pilotband" },
  });
  pruefe(band.status === 201 && band.daten?.id, "Band anlegen scheitert");
  pruefe((await erste.ruf("/api/bands/", { methode: "POST", koerper: { name: "" } })).status === 400, "Leerer Bandname wird akzeptiert");

  const bandId = band.daten.id;
  const leer = await erste.ruf(`/api/bands/${bandId}/`);
  pruefe(Array.isArray(leer.daten?.songs) && leer.daten.songs.length === 0, "Banddetail ohne Songliste");

  const song = await erste.ruf(`/api/bands/${bandId}/songs/`, {
    methode: "POST",
    koerper: { title: "Abrissbirne", artist: "Pilotband", key: "Am", bpm: 128, notes: "Capo 2" },
  });
  pruefe(song.status === 201 && song.daten?.title === "Abrissbirne", "Song anlegen scheitert");
  pruefe(song.daten?.notes === "Capo 2", "Notiz wird nicht gespeichert");

  const detail = await erste.ruf(`/api/bands/${bandId}/`);
  pruefe(detail.daten?.songs?.[0]?.title === "Abrissbirne", "Banddetail enthält den Song nicht");
  pruefe(
    (await erste.ruf(`/api/bands/${bandId}/songs/`, { methode: "POST", koerper: { title: "", bpm: 500 } })).status === 400,
    "Ungültiger Song wird akzeptiert",
  );

  const geaendert = await erste.ruf(`/api/bands/${bandId}/songs/${song.daten.id}/`, {
    methode: "PATCH",
    koerper: { title: "Abrissbirne (neu)", bpm: 120, notes: "Capo 3" },
  });
  pruefe(
    geaendert.status === 200 &&
      geaendert.daten?.title === "Abrissbirne (neu)" &&
      geaendert.daten?.bpm === 120 &&
      geaendert.daten?.notes === "Capo 3",
    "Song ändern scheitert",
  );
  const nachAenderung = await erste.ruf(`/api/bands/${bandId}/`);
  pruefe(nachAenderung.daten?.songs?.[0]?.title === "Abrissbirne (neu)", "Änderung steht nicht in der Bandliste");
  pruefe(
    (await erste.ruf(`/api/bands/${bandId}/songs/${song.daten.id}/`, { methode: "PATCH", koerper: { bpm: 500 } })).status === 400,
    "Ungültige Änderung wird akzeptiert",
  );

  const setlist = await erste.ruf(`/api/bands/${bandId}/setlists/`, {
    methode: "POST",
    koerper: { name: "Hauptset" },
  });
  pruefe(setlist.status === 201 && Array.isArray(setlist.daten?.sections), "Setlist anlegen scheitert");
  const setlistId = setlist.daten.id;
  const setlistPfad = `/api/bands/${bandId}/setlists/${setlistId}`;

  const inhalt = await erste.ruf(`${setlistPfad}/content/`, {
    methode: "PUT",
    koerper: {
      sections: [
        {
          name: "Set 1",
          kind: "set",
          entries: [
            { entry_type: "song", song_id: song.daten.id },
            { entry_type: "song", song_id: song.daten.id },
          ],
        },
        { name: "Pause", kind: "pause", entries: [{ entry_type: "pause" }] },
      ],
    },
  });
  pruefe(inhalt.status === 200, "Setlist-Inhalt speichern scheitert");
  const bereiche = inhalt.daten?.sections ?? [];
  pruefe(bereiche.length === 2, "Setlist hat nicht zwei Abschnitte");
  pruefe(
    bereiche[0]?.entries?.length === 2 &&
      bereiche[0].entries[0].position === 1 &&
      bereiche[0].entries[1].position === 2,
    "Doppelter Song oder Positionen stimmen nicht",
  );
  pruefe(bereiche[1]?.entries?.[0]?.label === "Pause", "Pause ohne Bezeichnung");

  pruefe(
    (await erste.ruf(`/api/bands/${bandId}/songs/${song.daten.id}/`, { methode: "DELETE" })).status === 400,
    "Song in einer Setlist lässt sich löschen",
  );

  const umsortiert = await erste.ruf(`${setlistPfad}/content/`, {
    methode: "PUT",
    koerper: {
      sections: [
        { name: "Zugabe", kind: "zugabe", entries: [{ entry_type: "notiz", label: "Zugabe offen" }] },
      ],
    },
  });
  pruefe(
    umsortiert.status === 200 && umsortiert.daten?.sections?.[0]?.position === 1,
    "Umsortieren scheitert",
  );

  const zweite = new Sitzung(basis);
  await zweite.ruf("/api/config/");
  pruefe(
    (await zweite.ruf("/api/anmeldung/", { methode: "POST", koerper: { username: "pilot2", password: passwort } })).status === 200,
    "Anmeldung des zweiten Kontos scheitert",
  );
  pruefe((await zweite.ruf("/api/bands/")).daten?.length === 0, "Zweites Konto sieht fremde Bands");
  pruefe((await zweite.ruf(`/api/bands/${bandId}/`)).status === 404, "Fremde Band ist nicht 404");
  pruefe((await zweite.ruf(`/api/bands/${bandId}/songs/`)).status === 404, "Fremde Songs sind nicht 404");
  pruefe((await zweite.ruf(`/api/bands/${bandId}/setlists/`)).status === 404, "Fremde Setlists sind nicht 404");
  pruefe((await zweite.ruf(`${setlistPfad}/`)).status === 404, "Fremde Setlist ist nicht 404");

  await pruefeGigs({ erste, zweite, bandId, setlistId, pruefe });

  pruefe(
    (await erste.ruf(`/api/bands/${bandId}/songs/${song.daten.id}/`, { methode: "DELETE" })).status === 204,
    "Song löschen nach dem Entfernen aus der Setlist scheitert",
  );
  pruefe((await erste.ruf(`/api/bands/${bandId}/`)).daten?.songs?.length === 0, "Gelöschter Song bleibt");

  await pruefeDokumente({
    erste,
    zweite,
    bandId,
    pruefe,
    basis,
    benutzer: "pilot",
    passwort,
  });

  await pruefeAnmerkungen({
    erste,
    zweite,
    bandId,
    pruefe,
    basis,
    benutzer: "pilot",
    passwort,
  });

  const starteMitPdfLimits = (werte) =>
    schritt(
      ["up", "-d", "--wait", "api", "web"],
      "Core mit neuen PDF-Limits starten",
      2,
      { ...env, ...werte },
    );
  await pruefeAktivesLimit({
    erste,
    bandId,
    pruefe,
    starteStack: starteMitPdfLimits,
  });
  await pruefeOhneLimit({
    erste,
    bandId,
    pruefe,
    starteStack: () =>
      starteMitPdfLimits({ PDF_MAX_UPLOAD_BYTES: "0", PDF_MAX_PAGES: "0" }),
  });

  pruefe((await erste.ruf("/api/abmeldung/", { methode: "POST" })).status === 200, "Abmelden scheitert");
  pruefe((await erste.ruf("/api/session/")).status === 401, "Session lebt nach dem Abmelden weiter");

  const hash = ausgabe(
    ["exec", "api", "python", "manage.py", "shell", "-c",
      "from accounts.models import User; print(User.objects.get(username='pilot').password.split('$')[0])"],
    "Passwort-Hash lesen",
  )
    .split("\n")
    .pop()
    .trim();
  pruefe(hash === "argon2", `Passwort liegt nicht als Argon2-Hash vor (${hash})`);

  const altesCookie = sessionVorher;
  const erneut = await erste.ruf("/api/anmeldung/", {
    methode: "POST",
    koerper: { username: "pilot", password: passwort },
  });
  pruefe(erneut.status === 200, "Erneute Anmeldung scheitert");
  pruefe(erste.cookies.get("sessionid") !== altesCookie, "Session-Schluessel bleibt bei der Anmeldung gleich");
} catch (fehler) {
  abbruch("Unerwarteter Fehler", fehler?.stack || String(fehler));
} finally {
  aufraeumen();
}

console.log("verify-kern ok");
