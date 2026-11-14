import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiFehler, apiFetch } from "./client";

function antwort(status: number, koerper: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => koerper,
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  it("ruft nur relative Pfade auf", async () => {
    await expect(apiFetch("https://fremd.example/api/")).rejects.toThrow(
      "API-Pfad muss relativ zur eigenen Origin sein.",
    );
    await expect(apiFetch("//fremd.example/api/")).rejects.toThrow(
      "API-Pfad muss relativ zur eigenen Origin sein.",
    );
  });

  it("nutzt dieselbe Origin und Credentials", async () => {
    const fetchMock = vi.fn(async () => antwort(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch("/api/config/");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/config/",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("meldet 401 als Anmeldezustand", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => antwort(401)));
    await expect(apiFetch("/api/session/")).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("meldet 403 als fehlende Berechtigung", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => antwort(403)));
    await expect(apiFetch("/api/bands/")).rejects.toMatchObject({ code: "forbidden" });
  });

  it("meldet 404 als noch nicht verfügbaren Bereich", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => antwort(404)));
    await expect(apiFetch("/api/bands/")).rejects.toEqual(
      expect.objectContaining({
        code: "not_found",
        message: "Bereich noch nicht verfügbar.",
      }),
    );
  });

  it("meldet 500 ohne interne Details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => antwort(500, { detail: "Traceback intern" })),
    );
    await expect(apiFetch("/api/bands/")).rejects.toEqual(
      expect.objectContaining({
        code: "server",
        message: "Serverfehler. Bitte erneut versuchen.",
      }),
    );
  });

  it("meldet Verbindungsverlust getrennt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("netz weg");
      }),
    );
    await expect(apiFetch("/api/config/")).rejects.toBeInstanceOf(ApiFehler);
    await expect(apiFetch("/api/config/")).rejects.toMatchObject({ code: "network" });
  });

  it("lehnt unlesbare Antworten ab", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => {
              throw new Error("kaputt");
            },
          }) as unknown as Response,
      ),
    );
    await expect(apiFetch("/api/config/")).rejects.toMatchObject({
      code: "invalid_response",
    });
  });
});
