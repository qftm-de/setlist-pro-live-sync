import fs from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const RESSOURCEN = ["cmaps", "standard_fonts", "wasm"];

function kopierePdfjsRessourcen(): Plugin {
  let wurzel = process.cwd();
  let ausgabe = path.join(wurzel, "dist");

  function quelle(ordner: string, datei: string): string | null {
    const basis = path.join(wurzel, "node_modules", "pdfjs-dist", ordner);
    const ziel = path.resolve(basis, datei);
    if (!ziel.startsWith(`${path.resolve(basis)}${path.sep}`) || !fs.existsSync(ziel)) {
      return null;
    }
    return ziel;
  }

  function kopiere() {
    for (const ordner of RESSOURCEN) {
      const von = path.join(wurzel, "node_modules", "pdfjs-dist", ordner);
      const nach = path.join(ausgabe, "pdfjs", ordner);
      if (!fs.existsSync(von)) {
        continue;
      }
      fs.mkdirSync(nach, { recursive: true });
      fs.cpSync(von, nach, { recursive: true });
    }
  }

  return {
    name: "pdfjs-ressourcen",
    configResolved(config) {
      wurzel = config.root;
      ausgabe = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use((anfrage, antwort, weiter) => {
        const pfad = (anfrage.url ?? "").split("?")[0];
        const treffer = pfad.match(/^\/pdfjs\/(cmaps|standard_fonts|wasm)\/([A-Za-z0-9_.-]+)$/);
        if (!treffer) {
          weiter();
          return;
        }
        const datei = quelle(treffer[1], treffer[2]);
        if (!datei) {
          weiter();
          return;
        }
        const endung = path.extname(datei);
        const typ =
          endung === ".wasm"
            ? "application/wasm"
            : endung === ".js"
              ? "text/javascript"
              : "application/octet-stream";
        antwort.setHeader("Content-Type", typ);
        fs.createReadStream(datei).pipe(antwort);
      });
    },
    closeBundle() {
      kopiere();
    },
  };
}

export default defineConfig({
  plugins: [react(), kopierePdfjsRessourcen()],
  server: {
    proxy: {
      "/api": "http://localhost:8000",
      "/ws": {
        target: "ws://localhost:8000",
        ws: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    maxWorkers: 4,
    setupFiles: ["./src/test-setup.ts"],
    exclude: ["e2e/**", "node_modules/**"],
    testTimeout: 30_000,
  },
});
