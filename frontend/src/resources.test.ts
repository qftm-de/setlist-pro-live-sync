import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { apiFetch } from "./api/client";

function quelldateien(verzeichnis: string): string[] {
  const eintraege = fs.readdirSync(verzeichnis, { withFileTypes: true });
  const dateien: string[] = [];
  for (const eintrag of eintraege) {
    const voll = path.join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      dateien.push(...quelldateien(voll));
      continue;
    }
    if (!/\.(ts|tsx|css)$/.test(eintrag.name) || /\.test\.tsx?$/.test(eintrag.name)) {
      continue;
    }
    dateien.push(voll);
  }
  return dateien;
}

describe("lokale Ressourcen", () => {
  it("lädt im Quellcode keine externen Schriften oder Hub-Ressourcen", () => {
    const treffer = quelldateien(path.resolve(process.cwd(), "src")).filter((datei) =>
      /https?:\/\//.test(fs.readFileSync(datei, "utf8")),
    );
    expect(treffer).toEqual([]);
  });

  it("baut die API nur über die eigene Origin an", async () => {
    await expect(apiFetch("https://hub.example/api/")).rejects.toThrow();
  });

  it("liefert Deep-Links über den SPA-Fallback und proxyt die API", () => {
    const nginx = fs.readFileSync(path.resolve(process.cwd(), "nginx.conf"), "utf8");
    expect(nginx).toContain("try_files $uri $uri/ /index.html");
    expect(nginx).toContain("proxy_pass http://api:8000");
  });

  it("setzt Proxy-Header für alle proxeten Bereiche", () => {
    const nginx = fs.readFileSync(path.resolve(process.cwd(), "nginx.conf"), "utf8");
    const header = nginx.indexOf("X-Forwarded-For");
    const ersterProxy = nginx.indexOf("location /api/");
    expect(header).toBeGreaterThan(-1);
    expect(ersterProxy).toBeGreaterThan(-1);
    expect(header).toBeLessThan(ersterProxy);
  });

  it("liefert gesammelte statische Dateien aus dem Volume", () => {
    const nginx = fs.readFileSync(path.resolve(process.cwd(), "nginx.conf"), "utf8");
    const start = nginx.indexOf("location /static/");
    const ende = nginx.indexOf("location /assets/", start);
    expect(start).toBeGreaterThan(-1);
    expect(ende).toBeGreaterThan(start);
    expect(nginx.slice(start, ende)).toContain("alias /usr/share/nginx/static/");

    const compose = fs.readFileSync(path.resolve(process.cwd(), "../docker-compose.yml"), "utf8");
    expect(compose).toContain("/app/staticfiles");
    expect(compose).toContain("/usr/share/nginx/static");

    const settings = fs.readFileSync(
      path.resolve(process.cwd(), "../backend/core/settings.py"),
      "utf8",
    );
    expect(settings).toContain('STATIC_ROOT = BASE_DIR / "staticfiles"');
  });

  it("wiederholt die Security-Header im Assets-Block", () => {
    const nginx = fs.readFileSync(path.resolve(process.cwd(), "nginx.conf"), "utf8");
    const start = nginx.indexOf("location /assets/");
    const ende = nginx.indexOf("location / {", start);
    expect(start).toBeGreaterThan(-1);
    expect(ende).toBeGreaterThan(start);
    const block = nginx.slice(start, ende);
    for (const header of [
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Cache-Control",
    ]) {
      expect(block).toContain(header);
    }
  });
});
