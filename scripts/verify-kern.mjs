#!/usr/bin/env node
/**
 * Kern-Smoke für R6 bis R8: baut den Core, legt Konten an und fährt den
 * echten Weg über nginx und die API. Kein Mock, keine Testdatenbank.
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projekt = "setlist-kern";
const port = process.env.WEB_PORT || "18081";
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
};

function compose(args) {
  return spawnSync("docker", ["compose", "-p", projekt, ...args], {
    cwd: root,
    env,
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

function schritt(args, text) {
  const ergebnis = compose(args);
  if ((ergebnis.status ?? 1) !== 0) {
    abbruch(text, `${ergebnis.stdout || ""}${ergebnis.stderr || ""}`);
  }
  return ergebnis;
}

function ausgabe(args, text) {
  return (schritt(args, text).stdout || "").trim();
}

class Sitzung {
  constructor() {
    this.cookies = new Map();
  }

  merke(antwort) {
    for (const eintrag of antwort.headers.getSetCookie()) {
      const paar = eintrag.split(";")[0];
      const trenner = paar.indexOf("=");
      this.cookies.set(paar.slice(0, trenner), paar.slice(trenner + 1));
    }
  }

  token() {
    return this.cookies.get("csrftoken") || "";
  }

  async ruf(pfad, { methode = "GET", koerper } = {}) {
    const kopfzeilen = { Accept: "application/json" };
    if (this.cookies.size) {
      kopfzeilen.Cookie = [...this.cookies]
        .map(([name, wert]) => `${name}=${wert}`)
        .join("; ");
    }
    if (methode !== "GET" && this.token()) {
      kopfzeilen["X-CSRFToken"] = this.token();
    }
    if (koerper !== undefined) {
      kopfzeilen["Content-Type"] = "application/json";
    }
    const antwort = await fetch(`${basis}${pfad}`, {
      method: methode,
      headers: kopfzeilen,
      body: koerper === undefined ? undefined : JSON.stringify(koerper),
      redirect: "manual",
    });
    this.merke(antwort);
    const text = await antwort.text();
    let daten = null;
    try {
      daten = text ? JSON.parse(text) : null;
    } catch {
      daten = text;
    }
    return { status: antwort.status, daten };
  }
}

function pruefe(bedingung, text) {
  if (!bedingung) {
    abbruch(text);
  }
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
  schritt(["config", "-q"], "Compose-Konfiguration");
  schritt(["build"], "Images bauen");
  schritt(["up", "-d", "--wait"], "Core starten");
  kontoAnlegen("pilot");
  kontoAnlegen("pilot2");

  const gesund = await new Sitzung().ruf("/api/health/");
  pruefe(gesund.status === 200 && gesund.daten?.status === "ok", "Health antwortet nicht ok");

  const admin = await fetch(`${basis}/admin/login/`);
  const adminHtml = await admin.text();
  pruefe(admin.status === 200, "Admin-Anmeldung antwortet nicht");
  pruefe(adminHtml.includes('"/static/admin/'), "Admin-Assets zeigen nicht auf /static/");
  pruefe((await fetch(`${basis}/static/admin/css/base.css`)).status === 200, "Admin-Stylesheet fehlt");

  const anonym = new Sitzung();
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

  const erste = new Sitzung();
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

  const zweite = new Sitzung();
  await zweite.ruf("/api/config/");
  pruefe(
    (await zweite.ruf("/api/anmeldung/", { methode: "POST", koerper: { username: "pilot2", password: passwort } })).status === 200,
    "Anmeldung des zweiten Kontos scheitert",
  );
  pruefe((await zweite.ruf("/api/bands/")).daten?.length === 0, "Zweites Konto sieht fremde Bands");
  pruefe((await zweite.ruf(`/api/bands/${bandId}/`)).status === 404, "Fremde Band ist nicht 404");
  pruefe((await zweite.ruf(`/api/bands/${bandId}/songs/`)).status === 404, "Fremde Songs sind nicht 404");

  pruefe(
    (await erste.ruf(`/api/bands/${bandId}/songs/${song.daten.id}/`, { methode: "DELETE" })).status === 204,
    "Song löschen scheitert",
  );
  pruefe((await erste.ruf(`/api/bands/${bandId}/`)).daten?.songs?.length === 0, "Gelöschter Song bleibt");

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
