#!/usr/bin/env node
/**
 * Verify für die Echtzeit-Pakete. R13 prüft Ausgangspuffer, Relay, Abgleich,
 * Rechte und Wiederverbindungslogik. R14 prüft Revision, UUID-Abgleich,
 * Einzelbefehle, zusammengeführte Texte und Anmerkungsrechte. R15 prüft die
 * gemeinsame Bühnensitzung. Alle Läufe nutzen echte Container.
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Sitzung } from "./lib/verify-session.mjs";
import { pruefeLast, pruefeWebSocket } from "./lib/verify-realtime/echtzeit.mjs";
import { pruefeMitarbeit } from "./lib/verify-realtime/mitarbeit.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ziel = process.argv[2];
if (!["R13", "R14", "R15"].includes(ziel)) {
  console.error("Aufruf: node scripts/verify-realtime.mjs R13|R14|R15");
  process.exit(1);
}

const projekt = `setlist-echtzeit-${process.pid}`;
const port = process.env.WEB_PORT || String(19081 + (process.pid % 300));
const basis = `http://127.0.0.1:${port}`;
const passwort = `pilot-${randomUUID()}`;
const env = {
  ...process.env,
  APP_MODE: "core",
  DJANGO_SECRET_KEY: `echtzeit-${randomUUID()}-${randomUUID()}`,
  DJANGO_DEBUG: "false",
  ALLOWED_HOSTS: "127.0.0.1,localhost,api,web",
  TRUST_PROXY_HEADERS: "false",
  POSTGRES_PASSWORD: `echtzeit-${randomUUID()}`,
  WEB_PORT: port,
  PDF_MAX_UPLOAD_BYTES: "20971520",
  PDF_MAX_PAGES: "100",
};

function compose(args, umgebung = env, ausgeben = true) {
  return spawnSync("docker", ["compose", "-p", projekt, ...args], {
    cwd: root,
    env: umgebung,
    encoding: "utf8",
    stdio: ausgeben ? "pipe" : "pipe",
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
  return (ergebnis.stdout || "").trim();
}

function pruefe(bedingung, text) {
  if (!bedingung) {
    abbruch(text);
  }
}

function shell(code) {
  const ausgabe = schritt(
    ["exec", "-T", "api", "python", "manage.py", "shell", "-c", code],
    `Shell-Aufruf fehlgeschlagen: ${code.slice(0, 300)}`,
  );
  // manage.py shell schreibt einen Import-Hinweis vor die eigentliche Ausgabe.
  return ausgabe.split("\n").map((zeile) => zeile.trim()).filter(Boolean).pop() || "";
}

function kontoAnlegen(name) {
  schritt(
    [
      "exec",
      "-T",
      "-e",
      `DJANGO_SUPERUSER_USERNAME=${name}`,
      "-e",
      `DJANGO_SUPERUSER_EMAIL=${name}@example.test`,
      "-e",
      `DJANGO_SUPERUSER_PASSWORD=${passwort}`,
      "-e",
      "DJANGO_SUPERUSER_DISPLAY_NAME=Testkonto",
      "api",
      "python",
      "manage.py",
      "createsuperuser",
      "--noinput",
    ],
    `Konto ${name} anlegen`,
  );
}

async function anmelden(name) {
  const sitzung = new Sitzung(basis);
  await sitzung.ruf("/api/config/");
  const antwort = await sitzung.ruf("/api/anmeldung/", {
    methode: "POST",
    koerper: { username: name, password: passwort },
  });
  pruefe(antwort.status === 200, `Anmeldung ${name} scheitert`);
  return sitzung;
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

async function warteAuf(pruefung, text, versuche = 80) {
  for (let lauf = 0; lauf < versuche; lauf += 1) {
    try {
      if (await pruefung()) {
        return;
      }
    } catch {
      // Der Dienst startet noch. Nächster Versuch.
    }
    await new Promise((fertig) => setTimeout(fertig, 500));
  }
  throw new Error(text);
}

async function bandMitgliedAnlegen(erste, zweite, name) {
  const band = await erste.ruf("/api/bands/", {
    methode: "POST",
    koerper: { name: `${name} ${randomUUID().slice(0, 8)}` },
  });
  pruefe(band.status === 201, "Band anlegen scheitert");
  shell(
    `from bands.models import Membership; from accounts.models import User; ` +
      `Membership.objects.get_or_create(band_id=${band.daten.id}, user=User.objects.get(username='${zweite}'), defaults={'role':'member'})`,
  );
  return band.daten.id;
}

async function pruefeR13() {
  schritt(
    ["exec", "-T", "api", "python", "manage.py", "test", "realtime"],
    "Backend-Tests Echtzeit",
  );

  kontoAnlegen("funk1");
  kontoAnlegen("funk2");
  kontoAnlegen("fremd");
  const erste = await anmelden("funk1");
  const zweite = await anmelden("funk2");
  const fremd = await anmelden("fremd");

  const band = await erste.ruf("/api/bands/", {
    methode: "POST",
    koerper: { name: `Echtzeitband ${randomUUID().slice(0, 8)}` },
  });
  pruefe(band.status === 201, "Band anlegen scheitert");
  const bandId = band.daten.id;

  shell(
    `from bands.models import Membership; from accounts.models import User; ` +
      `Membership.objects.get_or_create(band_id=${bandId}, user=User.objects.get(username='funk2'), defaults={'role':'member'})`,
  );

  const song = await erste.ruf(`/api/bands/${bandId}/songs/`, {
    methode: "POST",
    koerper: { title: "Echtzeitsong", bpm: 120 },
  });
  pruefe(song.status === 201, "Song anlegen scheitert");

  await warteAuf(
    () => shell("from realtime.models import OutboxEvent; print(OutboxEvent.objects.filter(published_at__isnull=True).count())") === "0",
    "Relay veröffentlicht das Ereignis nicht",
  );
  pruefe(
    shell("from realtime.models import OutboxEvent; print(OutboxEvent.objects.count())") !== "0",
    "Ausgangspuffer ist leer",
  );

  const abgleich = await erste.ruf(`/api/bands/${bandId}/sync/`);
  pruefe(abgleich.status === 200, "Abgleich antwortet nicht");
  pruefe(abgleich.daten?.counters?.band >= 1, "Bandzähler zählt nicht");
  pruefe(abgleich.daten?.songs?.[0]?.title === "Echtzeitsong", "Abgleich enthält den Song nicht");
  pruefe(
    (await zweite.ruf(`/api/bands/${bandId}/sync/`)).status === 200,
    "Zweites Mitglied erhält keinen Abgleich",
  );
  pruefe(
    (await fremd.ruf(`/api/bands/${bandId}/sync/`)).status === 404,
    "Fremde Band liefert keinen 404",
  );
  pruefe(
    (await new Sitzung(basis).ruf(`/api/bands/${bandId}/sync/`)).status === 401,
    "Anonymer Abgleich ist nicht 401",
  );

  const vorRollback = shell("from realtime.models import OutboxEvent; print(OutboxEvent.objects.count())");
  pruefe(
    (await erste.ruf(`/api/bands/${bandId}/songs/`, { methode: "POST", koerper: { title: "" } })).status === 400,
    "Ungültiger Song wird akzeptiert",
  );
  pruefe(
    shell("from realtime.models import OutboxEvent; print(OutboxEvent.objects.count())") === vorRollback,
    "Abgelehnte Mutation erzeugt ein Ereignis",
  );

  const vorNeustart = abgleich.daten?.counters?.band;
  schritt(["restart", "api"], "API neu starten");
  await warteAuf(async () => {
    try {
      return (await erste.ruf(`/api/bands/${bandId}/sync/`)).status === 200;
    } catch {
      return false;
    }
  }, "API antwortet nach Neustart nicht");
  const nachNeustart = await erste.ruf(`/api/bands/${bandId}/sync/`);
  pruefe(nachNeustart.status === 200, "Abgleich nach Neustart scheitert");
  pruefe(
    nachNeustart.daten?.counters?.band >= vorNeustart,
    "Zähler fällt nach dem Neustart zurück",
  );

  schritt(["stop", "cache"], "Redis stoppen");
  const zweiterSong = await erste.ruf(`/api/bands/${bandId}/songs/`, {
    methode: "POST",
    koerper: { title: "Ohne Redis", bpm: 90 },
  });
  pruefe(zweiterSong.status === 201, "Mutation scheitert bei Redis-Ausfall");
  const offen = Number(
    shell(
      "from realtime.models import OutboxEvent; print(OutboxEvent.objects.filter(published_at__isnull=True).count())",
    ),
  );
  pruefe(offen >= 1, "Ausfall hinterlässt kein offenes Ereignis");
  schritt(["start", "cache"], "Redis starten");
  await warteAuf(
    () =>
      shell(
        "from realtime.models import OutboxEvent; print(OutboxEvent.objects.filter(published_at__isnull=True).count())",
      ) === "0",
    "Relay veröffentlicht nach Redis-Neustart nicht",
  );
  const nachAusfall = await erste.ruf(`/api/bands/${bandId}/sync/`);
  pruefe(
    nachAusfall.daten?.songs?.some((eintrag) => eintrag.title === "Ohne Redis"),
    "Bestätigte Änderung fehlt nach dem Redis-Ausfall",
  );

  schritt(["stop", "cache"], "Redis für den Kaltstart stoppen");
  schritt(["restart", "api"], "API ohne Redis neu starten");
  await warteAuf(async () => {
    try {
      return (await erste.ruf(`/api/bands/${bandId}/sync/`)).status === 200;
    } catch {
      return false;
    }
  }, "API startet ohne Redis nicht");
  schritt(["start", "cache"], "Redis nach dem Kaltstart starten");

  await pruefeWebSocket({
    basis,
    erste,
    zweite,
    fremd,
    bandId,
    songId: song.daten.id,
    pruefe,
    shell,
  });

  const lastBands = [];
  for (let nummer = 0; nummer < 5; nummer += 1) {
    const neu = await erste.ruf("/api/bands/", {
      methode: "POST",
      koerper: { name: `Lastband ${nummer} ${randomUUID().slice(0, 6)}` },
    });
    pruefe(neu.status === 201, "Lastband anlegen scheitert");
    lastBands.push(neu.daten.id);
  }
  await pruefeLast({ basis, erste, bandIds: lastBands, pruefe });
}

async function pruefeR14() {
  schritt(
    [
      "exec",
      "-T",
      "api",
      "python",
      "manage.py",
      "test",
      "realtime",
      "api.test_mitarbeit",
      "api.test_annotation_mitarbeit",
      "api.test_setlists",
      "api.test_annotations",
      "api.test_annotations_rechte",
    ],
    "Backend-Tests R14",
  );

  kontoAnlegen("mit1");
  kontoAnlegen("mit2");
  const erste = await anmelden("mit1");
  const zweite = await anmelden("mit2");
  const bandId = await bandMitgliedAnlegen(erste, "mit2", "Mitarbeitsband");

  const songA = await erste.ruf(`/api/bands/${bandId}/songs/`, {
    methode: "POST",
    koerper: { title: "Mitarbeit A", bpm: 120 },
  });
  const songB = await erste.ruf(`/api/bands/${bandId}/songs/`, {
    methode: "POST",
    koerper: { title: "Mitarbeit B", bpm: 100 },
  });
  pruefe(songA.status === 201 && songB.status === 201, "Songs anlegen scheitert");

  shell(
    "from documents.models import Document, DocumentVersion\n" +
      "from library.models import Song\n" +
      "from accounts.models import User\n" +
      "import uuid\n" +
      `song = Song.objects.get(id=${songA.daten.id})\n` +
      "dokument, _ = Document.objects.get_or_create(song=song)\n" +
      "konto = User.objects.get(username='mit1')\n" +
      "if not DocumentVersion.objects.filter(document=dokument).exists():\n" +
      "    DocumentVersion.objects.create(document=dokument, number=1, upload_id=uuid.uuid4(), file_key='mit-'+uuid.uuid4().hex, original_name='privat.pdf', byte_size=1, page_count=2, sha256='b'*64, uploaded_by=konto)\n" +
      "print('ok')",
  );
  await warteAuf(
    () => shell("from realtime.models import OutboxEvent; print(OutboxEvent.objects.filter(published_at__isnull=True).count())") === "0",
    "Relay veröffentlicht nicht",
  );

  await pruefeMitarbeit({
    basis,
    erste,
    zweite,
    bandId,
    songIdA: songA.daten.id,
    songIdB: songB.daten.id,
    pruefe,
    shell,
    warteAuf,
  });
}

async function pruefeR15() {
  const { pruefeBuehne } = await import("./lib/verify-realtime/buehne.mjs");
  schritt(
    [
      "exec",
      "-T",
      "api",
      "python",
      "manage.py",
      "test",
      "realtime",
      "api.test_stage",
      "api.test_stage_race",
    ],
    "Backend-Tests R15",
  );

  kontoAnlegen("buehne1");
  kontoAnlegen("buehne2");
  kontoAnlegen("buehne3");
  kontoAnlegen("fremd15");
  const leitung = await anmelden("buehne1");
  const mitglied = await anmelden("buehne2");
  const owner = await anmelden("buehne3");
  const fremd = await anmelden("fremd15");
  const bandId = await bandMitgliedAnlegen(leitung, "buehne2", "Buehnenband");
  shell(
    `from bands.models import Membership; from accounts.models import User; ` +
      `Membership.objects.get_or_create(band_id=${bandId}, user=User.objects.get(username='buehne3'), defaults={'role':'owner'})`,
  );

  const songA = await leitung.ruf(`/api/bands/${bandId}/songs/`, {
    methode: "POST",
    koerper: { title: "Buehne A", bpm: 120 },
  });
  const songB = await leitung.ruf(`/api/bands/${bandId}/songs/`, {
    methode: "POST",
    koerper: { title: "Buehne B", bpm: 90 },
  });
  pruefe(songA.status === 201 && songB.status === 201, "Bühnensongs scheitern");

  await pruefeBuehne({
    basis,
    leitung,
    mitglied,
    owner,
    fremd,
    bandId,
    songIds: [songA.daten.id, songB.daten.id],
    pruefe,
    shell,
    warteAuf,
  });
}

try {
  frontendPruefen();
  schritt(["config", "-q"], "Compose-Konfiguration");
  schritt(["build"], "Images bauen");
  schritt(["up", "-d", "--wait"], "Core starten");
  if (ziel === "R13") {
    await pruefeR13();
  } else if (ziel === "R14") {
    await pruefeR14();
  } else {
    await pruefeR15();
  }
} catch (fehler) {
  abbruch("Unerwarteter Fehler", fehler?.stack || String(fehler));
} finally {
  aufraeumen();
}

console.log(`verify-realtime ${ziel} ok`);
