#!/usr/bin/env node
// Screenshots der Alt-App für die Analyse. Nur lesend, kein Produktcode.
// Headless Chrome über das DevTools-Protokoll, ohne npm-Abhängigkeit.

import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const APP = path.join(ROOT, "alte_projektdatein", "index.html");
const OUT = path.join(ROOT, "docs", "analyse", "screens");
const CHROME = process.env.CHROME_BIN || "google-chrome";
const PORT = 9222 + Math.floor(Math.random() * 500);
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), "beusti-shots-"));
const WIDTH = 390;
const HEIGHT = 844;

if (!fs.existsSync(APP)) {
  console.error(`Alt-App fehlt: ${APP}`);
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--allow-file-access-from-files",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);

let chromeError = "";
chrome.stderr.on("data", (d) => {
  chromeError += d.toString();
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getJson(url, method = "GET") {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Antwort kein JSON: ${body.slice(0, 200)}`));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(2000, () => req.destroy(new Error("timeout")));
    req.end();
  });
}

async function waitForChrome() {
  for (let i = 0; i < 60; i++) {
    try {
      const v = await getJson(`http://127.0.0.1:${PORT}/json/version`);
      if (v.webSocketDebuggerUrl) {
        return v;
      }
    } catch {
      // Chrome startet noch.
    }
    await sleep(200);
  }
  throw new Error(`Chrome nicht erreichbar. ${chromeError.slice(0, 400)}`);
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener("open", () => resolve(ws), { once: true });
    ws.addEventListener("error", () => reject(new Error("WebSocket-Fehler")), { once: true });
  });
}

function cdp(ws) {
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) {
        reject(new Error(`${msg.error.message} (${msg.error.code})`));
      } else {
        resolve(msg.result);
      }
      return;
    }
    for (const fn of listeners.get(msg.method) || []) {
      fn(msg.params);
    }
  });
  return {
    send(method, params = {}) {
      const msgId = ++id;
      return new Promise((resolve, reject) => {
        pending.set(msgId, { resolve, reject });
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    },
    on(method, fn) {
      if (!listeners.has(method)) {
        listeners.set(method, []);
      }
      listeners.get(method).push(fn);
    },
  };
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime-Fehler");
  }
  return result.result?.value;
}

async function waitFor(client, expression, timeout = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(client, expression)) {
      return true;
    }
    await sleep(100);
  }
  return false;
}

async function shot(client, name) {
  const { data } = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  const file = path.join(OUT, name);
  fs.writeFileSync(file, Buffer.from(data, "base64"));
  console.log(`  ${name}`);
}

async function setViewport(client, width, height, mobile) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  });
}

const clickText = (text) => `(() => {
  const t = ${JSON.stringify(text)};
  const all = [...document.querySelectorAll("button, a, [role=button]")];
  const el = all.find((e) => (e.textContent || "").trim() === t)
    || all.find((e) => (e.textContent || "").includes(t));
  if (!el) return "notfound";
  el.click();
  return "ok";
})()`;

const setInput = (id, value) => `(() => {
  const el = document.getElementById(${JSON.stringify(id)});
  if (!el) return "notfound";
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return "ok";
})()`;

async function main() {
  const version = await waitForChrome();
  console.log(`Chrome bereit auf Port ${PORT}`);

  const target = await getJson(
    `http://127.0.0.1:${PORT}/json/new?${encodeURIComponent("about:blank")}`,
    "PUT",
  );
  const ws = await connect(target.webSocketDebuggerUrl);
  const client = cdp(ws);

  // Alerts der Alt-App automatisch bestätigen, sonst blockiert der Flow.
  client.on("Page.javascriptDialogOpening", () => {
    client.send("Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
  });

  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await setViewport(client, WIDTH, HEIGHT, true);

  const fileUrl = `file://${APP}`;
  console.log("Öffne Alt-App");
  await client.send("Page.navigate", { url: fileUrl });
  const ready = await waitFor(client, `document.body && document.body.textContent.includes("Deine Band.")`, 10000);
  if (!ready) {
    throw new Error("Startansicht nicht erkannt");
  }
  await sleep(800);
  console.log("Screenshots:");
  await shot(client, "01-start.png");

  await evaluate(client, clickText("Band beitreten"));
  await waitFor(client, `!!document.getElementById("j-code")`);
  await evaluate(client, setInput("j-code", process.env.BAND_CODE || ""));
  await evaluate(client, setInput("j-myname", process.env.MEMBER_NAME || ""));
  await sleep(200);
  await shot(client, "02-join.png");

  await evaluate(client, clickText("Beitreten"));
  await waitFor(client, `document.body.textContent.includes("Mitglieder")`, 8000);
  await sleep(900);

  // Fallback: falls der Alert-Flow die Ansicht nicht wechselt, hart nachziehen.
  if (!(await evaluate(client, `document.body.textContent.includes("GESAMTZEIT")`))) {
    const ok = await evaluate(client, `(() => {
      const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Dashboard");
      if (btn) { btn.click(); return "dashboard"; }
      return "none";
    })()`);
    if (ok === "none") {
      throw new Error("Übersicht nicht erreichbar");
    }
    await sleep(800);
  }
  await shot(client, "03-overview.png");

  await evaluate(client, clickText("Songs"));
  await waitFor(client, `document.body.textContent.includes("SONGS HINZUFÜGEN")`);
  await sleep(500);
  await shot(client, "04-songs.png");

  await evaluate(client, clickText("Setlists"));
  await waitFor(client, `document.body.textContent.includes("NEUE SETLIST") || document.body.textContent.includes("Neue Setlist")`);
  await sleep(500);
  await shot(client, "05-setlists.png");

  await evaluate(client, clickText("Members"));
  await waitFor(client, `document.body.textContent.includes("NEUES MITGLIED")`);
  await sleep(500);
  await shot(client, "06-members.png");

  await evaluate(client, clickText("Setlists"));
  await sleep(400);
  const perf = await evaluate(client, clickText("▶ Performance"));
  if (perf !== "ok") {
    console.warn("  Performance-Button nicht gefunden, überspringe Ansicht");
  } else {
    await sleep(1200);
    await shot(client, "07-performance.png");
  }

  // Übersicht noch einmal im Desktop-Layout.
  await evaluate(client, clickText("Zurück"));
  await sleep(400);
  await evaluate(client, clickText("Overview"));
  await sleep(400);
  await setViewport(client, 1280, 800, false);
  await sleep(600);
  await shot(client, "08-overview-desktop.png");

  ws.close();
  console.log(`Fertig: ${OUT}`);
}

try {
  await main();
} catch (err) {
  console.error(`Fehler: ${err.message}`);
  process.exitCode = 1;
} finally {
  chrome.kill("SIGKILL");
  await sleep(300);
  fs.rmSync(PROFILE, { recursive: true, force: true });
}
