#!/usr/bin/env node
// Gate-Schritt docs-sync: hält die Projektdokumentation am Änderungsbereich.
// Regeln:
//   1. Ändert sich Produktcode, bekommt CHANGELOG.md im selben Änderungsbereich
//      eine neue Zeile im Abschnitt "## [Unreleased]". Verglichen wird der
//      Abschnitt der Diff-Basis mit dem der Arbeitsdatei, damit gestagte und
//      committete Änderungen gleichermaßen zählen. Reine Doku, Agenten-
//      konfiguration und Meta-Dateien brauchen keinen Eintrag.
//   2. CHANGELOG.md, PROGRESS.md und DECISIONS.md bleiben vorhanden, und der
//      CHANGELOG behält seinen Unreleased-Abschnitt.
//   3. Ohne Git-Kontext ist der Änderungsbereich unbekannt und der Schritt rot.
// Schreibt keine Dateien.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gitText, resolveDiffBase } from "./lib/git-base.mjs";
import { listChangedFiles } from "./lib/requirements.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const STAND_DATEIEN = ["CHANGELOG.md", "PROGRESS.md", "DECISIONS.md"];
const UNRELEASED = /^##\s*\[Unreleased\]/i;

// Dateien ohne CHANGELOG-Pflicht: Meta, Werkzeug und lokale Konfiguration.
const META_DATEIEN = new Set([
  ".editorconfig",
  ".env.example",
  ".gitattributes",
  ".gitignore",
  "LICENSE",
  "harness/lock.json",
]);
const LOKALE_ORDNER = [
  ".agents/",
  ".claude/",
  ".codex/",
  ".cursor/",
  ".kilo/",
  ".tmp/",
  "_lokal/",
  "docs/",
  "harness/",
];

function istDoku(datei) {
  if (META_DATEIEN.has(datei) || LOKALE_ORDNER.some((ordner) => datei.startsWith(ordner))) {
    return true;
  }
  // Markdown im Wurzelverzeichnis ist Projekt-Doku (README, PROGRESS, ...).
  return !datei.includes("/") && /\.(md|mdc)$/i.test(datei);
}

/** Nicht-leere Zeilen des Unreleased-Abschnitts, oder null ohne diesen Abschnitt. */
function unreleasedZeilen(changelog) {
  const zeilen = String(changelog).split(/\r?\n/);
  const start = zeilen.findIndex((zeile) => UNRELEASED.test(zeile));
  if (start === -1) {
    return null;
  }
  let ende = zeilen.length;
  for (let i = start + 1; i < zeilen.length; i += 1) {
    if (/^##\s/.test(zeilen[i])) {
      ende = i;
      break;
    }
  }
  return new Set(
    zeilen
      .slice(start + 1, ende)
      .map((zeile) => zeile.trim())
      .filter(Boolean),
  );
}

/** Unreleased-Zeilen der Vergleichsbasis; leer, wenn es sie dort nicht gibt. */
function basisZeilen() {
  const head = (gitText(root, ["rev-parse", "HEAD"]) || "").trim();
  const basis = resolveDiffBase(root) || head;
  if (!basis) {
    return null;
  }
  const text = gitText(root, ["show", `${basis}:CHANGELOG.md`]);
  if (text === null) {
    return new Set();
  }
  return unreleasedZeilen(text) ?? new Set();
}

function kurzListe(dateien, grenze = 5) {
  const rest = dateien.length - grenze;
  return dateien.slice(0, grenze).join(", ") + (rest > 0 ? `, … (${rest} weitere)` : "");
}

const fehler = [];

if (gitText(root, ["rev-parse", "--verify", "HEAD"]) === null) {
  fehler.push(
    "Kein Git-Kontext: Repository oder Commit fehlt. Der Änderungsbereich ist unbekannt, " +
      "die Dokumentationspflicht lässt sich nicht prüfen.",
  );
}

for (const datei of STAND_DATEIEN) {
  if (!fs.existsSync(path.join(root, datei))) {
    fehler.push(`${datei} fehlt.`);
  }
}

const changelogPfad = path.join(root, "CHANGELOG.md");
let changelog = null;
if (fs.existsSync(changelogPfad)) {
  changelog = fs.readFileSync(changelogPfad, "utf8");
  if (unreleasedZeilen(changelog) === null) {
    fehler.push("CHANGELOG.md hat keinen Abschnitt '## [Unreleased]' (Keep a Changelog).");
  }
}

const geaendert = listChangedFiles(root);
const produkt = geaendert.filter((datei) => !istDoku(datei));

if (produkt.length > 0) {
  if (!geaendert.includes("CHANGELOG.md")) {
    fehler.push(
      `Produktdateien geändert, CHANGELOG.md fehlt im Diff: ${kurzListe(produkt)}. ` +
        "Trage den Eintrag unter '## [Unreleased]' ein.",
    );
  } else {
    const vorher = basisZeilen();
    const jetzt = changelog === null ? null : unreleasedZeilen(changelog);
    if (vorher !== null && jetzt !== null && ![...jetzt].some((zeile) => !vorher.has(zeile))) {
      fehler.push(
        "Keine neue Zeile unter '## [Unreleased]'. " +
          "Der Eintrag gehört in diesen Abschnitt, nicht in ein freigegebenes Release oder ins Intro.",
      );
    }
  }
}

if (fehler.length > 0) {
  for (const eintrag of fehler) {
    process.stderr.write(`${eintrag}\n`);
  }
  process.exit(1);
}

const umfang =
  produkt.length > 0
    ? `${produkt.length} Produktdatei(en) im Änderungsbereich`
    : "keine Produktdatei im Änderungsbereich, kein CHANGELOG-Eintrag nötig";
console.log(`docs-sync ok: ${umfang}.`);
process.exit(0);
