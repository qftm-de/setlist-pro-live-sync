import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiFehler, apiFetch, apiFetchDatei, fehlerText } from "./client";

function antwort(status: number, koerper: unknown = {}): Response {
  const text = koerper === undefined ? "" : JSON.stringify(koerper);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => JSON.parse(text),
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
    await expect(apiFetch("/\\fremd.example/api/")).rejects.toThrow(
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

  it("schickt bei Schreibmethoden den CSRF-Token", async () => {
    document.cookie = "csrftoken=abc123";
    const fetchMock = vi.fn(
      async (_pfad: RequestInfo | URL, _init?: RequestInit) => antwort(200, {}),
    );
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch("/api/notiz/", { method: "PUT", body: "{}" });
    const kopfzeilen = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(kopfzeilen.get("X-CSRFToken")).toBe("abc123");
    expect(kopfzeilen.get("Content-Type")).toBe("application/json");
    document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  });

  it("behandelt leere Erfolgsantworten ohne JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => antwort(204, undefined)));
    await expect(apiFetch("/api/notiz/", { method: "DELETE" })).resolves.toBeUndefined();
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
            text: async () => "kein json",
          }) as unknown as Response,
      ),
    );
    await expect(apiFetch("/api/config/")).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("zeigt die Klartextmeldung des Servers bei 400", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        antwort(400, { detail: "Song steht in einer Setlist. Erst dort entfernen." }),
      ),
    );
    let fehler: unknown;
    try {
      await apiFetch("/api/bands/1/songs/2/", { method: "DELETE" });
    } catch (ursache) {
      fehler = ursache;
    }
    expect(fehler).toBeInstanceOf(ApiFehler);
    expect((fehler as ApiFehler).code).toBe("bad_request");
    expect(fehlerText(fehler)).toBe("Song steht in einer Setlist. Erst dort entfernen.");
  });

  it("bleibt bei fehlender Meldung beim allgemeinen Text", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => antwort(400, {})));
    let fehler: unknown;
    try {
      await apiFetch("/api/bands/", { method: "POST" });
    } catch (ursache) {
      fehler = ursache;
    }
    expect(fehlerText(fehler)).toBe("Die Anfrage wurde abgelehnt. Bitte Eingaben prüfen.");
  });

  it("zeigt keine internen Details bei 500", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => antwort(500, { detail: "Traceback intern" })),
    );
    let fehler: unknown;
    try {
      await apiFetch("/api/bands/");
    } catch (ursache) {
      fehler = ursache;
    }
    expect(fehlerText(fehler)).toBe("Serverfehler. Bitte erneut versuchen.");
  });

  it("meldet Konflikt und zu große Dateien getrennt", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => antwort(409, {})));
    await expect(apiFetch("/api/bands/1/")).rejects.toMatchObject({ code: "conflict" });
    vi.stubGlobal("fetch", vi.fn(async () => antwort(413, {})));
    await expect(apiFetch("/api/bands/1/")).rejects.toMatchObject({ code: "too_large" });
  });

  it("lädt private Dateien als Binärdaten und meldet 401", async () => {
    const daten = new Uint8Array([1, 2, 3]).buffer;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        arrayBuffer: async () => daten,
      }) as Response),
    );
    await expect(apiFetchDatei("/api/datei/")).resolves.toBe(daten);
    vi.stubGlobal("fetch", vi.fn(async () => antwort(401)));
    await expect(apiFetchDatei("/api/datei/")).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });
});
