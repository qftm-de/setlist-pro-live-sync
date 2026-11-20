#!/usr/bin/env node
/**
 * R17-Verify: Release-Workflow, GHCR-Images und Release-Compose.
 * Prüft nur Struktur und Verweise, ohne Netz und ohne Docker.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fehler = [];

function lies(rel) {
  const pfad = path.join(root, rel);
  if (!fs.existsSync(pfad)) {
    fehler.push(`Datei fehlt: ${rel}`);
    return null;
  }
  return fs.readFileSync(pfad, "utf8");
}

function textEnthaelt(text, teil, meldung) {
  if (!String(text || "").includes(teil)) {
    fehler.push(meldung);
  }
}

const workflowText = lies(".github/workflows/release.yml");
const composeText = lies("docker-compose.release.yml");
const betrieb = lies("docs/betrieb.md");
const readme = lies("README.md");
const paket = JSON.parse(lies("frontend/package.json") || "{}");

const WEB = "ghcr.io/qftm-de/setlist-pro-live-sync/web";
const API = "ghcr.io/qftm-de/setlist-pro-live-sync/api";

if (workflowText) {
  const workflow = parse(workflowText);
  const tags = workflow?.on?.push?.tags;
  if (!Array.isArray(tags) || !tags.includes("v*")) {
    fehler.push("Release-Workflow startet nicht bei Tags v*.");
  }
  if (workflow?.on?.pull_request || workflow?.on?.pull_request_target) {
    fehler.push("Release-Workflow läuft auch bei Pull Requests.");
  }
  if (workflow?.permissions?.contents !== "read") {
    fehler.push("Release-Workflow braucht contents: read.");
  }
  if (workflow?.permissions?.packages !== "write") {
    fehler.push("Release-Workflow braucht packages: write.");
  }
  const schritte = workflow?.jobs?.images?.steps || [];
  const alle = JSON.stringify(schritte);
  const tagText = schritte.map((schritt) => String(schritt?.with?.tags || "")).join("\n");
  const kontexte = schritte.map((schritt) => String(schritt?.with?.context || ""));
  const volleVersion = "${{ steps.version.outputs.version }}";
  const minorVersion = "${{ steps.version.outputs.minor }}";
  const commitTag = "${{ steps.version.outputs.sha }}";
  textEnthaelt(alle, "docker/login-action", "GHCR-Login fehlt.");
  textEnthaelt(alle, "docker/setup-buildx-action", "Buildx fehlt.");
  textEnthaelt(alle, "docker/build-push-action", "Build und Push fehlen.");
  if (!kontexte.includes("./frontend")) {
    fehler.push("Frontend-Kontext fehlt.");
  }
  if (!kontexte.includes("./backend")) {
    fehler.push("Backend-Kontext fehlt.");
  }
  for (const [image, name] of [
    [WEB, "Web"],
    [API, "API"],
  ]) {
    for (const [tag, beschreibung] of [
      [volleVersion, "volle Version"],
      [minorVersion, "major.minor"],
      [commitTag, "Commit-Tag"],
    ]) {
      textEnthaelt(
        tagText,
        `${image}:${tag}`,
        `${name}-Image ohne ${beschreibung}.`,
      );
    }
  }
  for (const schritt of schritte) {
    const uses = String(schritt?.uses || "");
    if (uses.startsWith("docker/") && !/@[0-9a-f]{40}$/.test(uses)) {
      fehler.push(`Docker-Action ohne Commit-Pin: ${uses}.`);
    }
  }
  if (schritte.some((schritt) => schritt["continue-on-error"] === true)) {
    fehler.push("Release-Workflow hat einen fehlertoleranten Schritt.");
  }
}

let version = null;
if (composeText) {
  const compose = parse(composeText);
  const dienste = compose?.services || {};
  for (const name of ["web", "api", "relay", "db", "cache"]) {
    if (!dienste[name]) {
      fehler.push(`Release-Compose ohne Dienst ${name}.`);
    }
  }
  for (const [name, dienst] of Object.entries(dienste)) {
    if (dienst?.build) {
      fehler.push(`Release-Compose baut ${name} lokal statt aus der Registry.`);
    }
  }
  const web = String(dienste.web?.image || "");
  const api = String(dienste.api?.image || "");
  const relay = String(dienste.relay?.image || "");
  if (!web.startsWith(`${WEB}:`)) {
    fehler.push("Web-Dienst zieht nicht das GHCR-Web-Image.");
  }
  if (!api.startsWith(`${API}:`)) {
    fehler.push("API-Dienst zieht nicht das GHCR-API-Image.");
  }
  if (relay !== api) {
    fehler.push("Relay nutzt nicht dasselbe API-Image.");
  }
  version = web.slice(WEB.length + 1);
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    fehler.push(`Release-Compose pinnt keine SemVer-Version (${version || "leer"}).`);
  }
  if (String(paket.version || "") !== version) {
    fehler.push(
      `frontend/package.json (${paket.version || "leer"}) und Release-Compose (${version || "leer"}) passen nicht zusammen.`,
    );
  }
  if (!dienste.web?.pull_policy) {
    fehler.push("Web-Dienst ohne pull_policy, ein Update lädt das Image nicht neu.");
  }
}

if (betrieb) {
  textEnthaelt(betrieb, "docker login ghcr.io", "Betriebsdoku nennt den GHCR-Login nicht.");
  textEnthaelt(betrieb, "docker compose -f docker-compose.release.yml pull", "Betriebsdoku nennt den Pull nicht.");
  textEnthaelt(betrieb, "Rollback", "Betriebsdoku beschreibt keinen Rollback.");
  textEnthaelt(betrieb, WEB, "Betriebsdoku nennt das Web-Image nicht.");
  textEnthaelt(betrieb, API, "Betriebsdoku nennt das API-Image nicht.");
}
if (readme) {
  textEnthaelt(readme, "GHCR", "README nennt GHCR nicht.");
}

if (fehler.length) {
  console.error("Release-Prüfung rot:");
  for (const eintrag of fehler) {
    console.error(`- ${eintrag}`);
  }
  process.exit(1);
}

console.log("verify-release ok");
