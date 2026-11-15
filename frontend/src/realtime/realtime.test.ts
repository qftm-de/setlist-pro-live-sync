import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BandSync } from "./realtime";
import { wartezeit } from "./verbindung";
import type {
  Ereignis,
  Verbindungszustand,
  WebSocketLike,
  Zeitgeber,
  Zaehler,
} from "./typen";

class TestSocket implements WebSocketLike {
  static letzte: TestSocket | null = null;
  onopen: ((ereignis: Event) => void) | null = null;
  onmessage: ((ereignis: MessageEvent) => void) | null = null;
  onclose: ((ereignis: CloseEvent) => void) | null = null;
  onerror: ((ereignis: Event) => void) | null = null;
  gesendet: string[] = [];
  geschlossen = false;

  constructor(public url: string) {
    TestSocket.letzte = this;
  }

  send(daten: string): void {
    this.gesendet.push(daten);
  }

  close(): void {
    this.geschlossen = true;
  }

  oeffnen(): void {
    this.onopen?.(new Event("open"));
  }

  nachricht(inhalt: unknown): void {
    this.onmessage?.({ data: JSON.stringify(inhalt) } as MessageEvent);
  }

  trennen(): void {
    this.onclose?.({} as CloseEvent);
  }
}

function zeitgeber(): Zeitgeber {
  return {
    setTimeout: (rueckruf, ms) => setTimeout(rueckruf, ms) as unknown as number,
    clearTimeout: (kennung) => clearTimeout(kennung),
    now: () => Date.now(),
  };
}

async function microtasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

interface Aufbau {
  client: BandSync;
  ereignisse: Ereignis[];
  zustaende: Verbindungszustand[];
  abgleiche: number;
  abgleichRueckrufe: number;
  verluste: number;
  setzeZaehler: (zahlen: Zaehler) => void;
  scheitern: (wert: boolean) => void;
}

function baue(zahlen: Zaehler = { band: 0, personal: 0 }): Aufbau {
  const ereignisse: Ereignis[] = [];
  const zustaende: Verbindungszustand[] = [];
  const steuerung = {
    naechste: zahlen,
    scheitern: false,
    abgleiche: 0,
    abgleichRueckrufe: 0,
    verluste: 0,
  };
  const client = new BandSync({
    bandId: "7",
    ladeAbgleich: () => {
      steuerung.abgleiche += 1;
      if (steuerung.scheitern) {
        return Promise.reject(new Error("abgleich"));
      }
      return Promise.resolve({ counters: steuerung.naechste });
    },
    beiEreignis: (ereignis) => ereignisse.push(ereignis),
    beiZustand: (zustand) => zustaende.push(zustand),
    beiAbgleich: () => {
      steuerung.abgleichRueckrufe += 1;
    },
    beiVerbindungsverlust: () => {
      steuerung.verluste += 1;
    },
    socketBauen: (url) => new TestSocket(url),
    zeit: zeitgeber(),
    zufall: () => 0,
  });
  return {
    client,
    ereignisse,
    zustaende,
    get abgleiche() {
      return steuerung.abgleiche;
    },
    get abgleichRueckrufe() {
      return steuerung.abgleichRueckrufe;
    },
    get verluste() {
      return steuerung.verluste;
    },
    setzeZaehler: (neu) => {
      steuerung.naechste = neu;
    },
    scheitern: (wert) => {
      steuerung.scheitern = wert;
    },
  };
}

async function verbinde(aufbau: Aufbau): Promise<TestSocket> {
  aufbau.client.start();
  const socket = TestSocket.letzte as TestSocket;
  socket.oeffnen();
  await microtasks();
  return socket;
}

describe("BandSync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    TestSocket.letzte = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("gleicht beim Öffnen ab und meldet verbunden", async () => {
    const aufbau = baue({ band: 2, personal: 0 });
    await verbinde(aufbau);
    expect(aufbau.zustaende).toContain("abgleich");
    expect(aufbau.zustaende.at(-1)).toBe("verbunden");
    expect(aufbau.abgleiche).toBe(1);
    expect(aufbau.abgleichRueckrufe).toBe(1);
  });

  it("ignoriert Duplikate und ältere Ereignisse", async () => {
    const aufbau = baue({ band: 2, personal: 0 });
    const socket = await verbinde(aufbau);
    socket.nachricht({ type: "event", stream: "band", seq: 2, event: "song.created", data: {} });
    socket.nachricht({ type: "event", stream: "band", seq: 1, event: "song.created", data: {} });
    expect(aufbau.ereignisse).toHaveLength(0);
    socket.nachricht({ type: "event", stream: "band", seq: 3, event: "song.created", data: {} });
    expect(aufbau.ereignisse).toHaveLength(1);
    expect(aufbau.ereignisse[0].seq).toBe(3);
  });

  it("löst bei einer Lücke einen Vollabgleich aus", async () => {
    const aufbau = baue({ band: 2, personal: 0 });
    const socket = await verbinde(aufbau);
    socket.nachricht({ type: "event", stream: "band", seq: 5, event: "song.created", data: {} });
    await microtasks();
    expect(aufbau.ereignisse).toHaveLength(0);
    expect(aufbau.abgleiche).toBe(2);
  });

  it("hält persönliche und Bandzähler getrennt", async () => {
    const aufbau = baue({ band: 0, personal: 0 });
    const socket = await verbinde(aufbau);
    socket.nachricht({ type: "event", stream: "personal", seq: 1, event: "annotation.updated", data: {} });
    expect(aufbau.ereignisse[0].stream).toBe("personal");
    socket.nachricht({ type: "event", stream: "band", seq: 1, event: "song.created", data: {} });
    expect(aufbau.ereignisse[1].stream).toBe("band");
  });

  it("erkennt ein verlorenes letztes Ereignis am Pong-Zähler", async () => {
    const aufbau = baue({ band: 1, personal: 0 });
    const socket = await verbinde(aufbau);
    socket.nachricht({ type: "pong", counters: { band: 3, personal: 0 } });
    await microtasks();
    expect(aufbau.abgleiche).toBe(2);
  });

  it("wartet bei der Wiederverbindung zwischen 1 und 30 Sekunden", async () => {
    expect(wartezeit(0, () => 0)).toBe(1000);
    expect(wartezeit(1, () => 0.999)).toBeLessThanOrEqual(2000);
    expect(wartezeit(10, () => 0.999)).toBeLessThanOrEqual(30000);
    expect(wartezeit(10, () => 0.999)).toBeGreaterThanOrEqual(1000);

    const aufbau = baue({ band: 0, personal: 0 });
    const socket = await verbinde(aufbau);
    socket.trennen();
    expect(aufbau.zustaende.at(-1)).toBe("unterbrochen");
    await vi.advanceTimersByTimeAsync(999);
    expect(TestSocket.letzte).toBe(socket);
    await vi.advanceTimersByTimeAsync(1);
    expect(TestSocket.letzte).not.toBe(socket);
  });

  it("sendet Heartbeat nach 20 Sekunden und bricht nach 60 Sekunden ab", async () => {
    const aufbau = baue({ band: 0, personal: 0 });
    const socket = await verbinde(aufbau);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(socket.gesendet).toContain(JSON.stringify({ type: "ping" }));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(aufbau.zustaende.at(-1)).toBe("unterbrochen");
    expect(socket.geschlossen).toBe(true);
  });

  it("zeigt einen fehlgeschlagenen Abgleich und erlaubt den erneuten Versuch", async () => {
    const aufbau = baue({ band: 0, personal: 0 });
    aufbau.scheitern(true);
    aufbau.client.start();
    const socket = TestSocket.letzte as TestSocket;
    socket.oeffnen();
    await microtasks();
    expect(aufbau.zustaende).toContain("abgleich-fehlgeschlagen");
    aufbau.scheitern(false);
    aufbau.client.erneutVersuchen();
    (TestSocket.letzte as TestSocket).oeffnen();
    await microtasks();
    expect(aufbau.zustaende.at(-1)).toBe("verbunden");
  });

  it("puffert Ereignisse während des Abgleichs", async () => {
    const ereignisse: Ereignis[] = [];
    const steuerung: { aufloesen: ((wert: { counters: Zaehler }) => void) | null } = {
      aufloesen: null,
    };
    const client = new BandSync({
      bandId: "7",
      ladeAbgleich: () =>
        new Promise((fertig) => {
          steuerung.aufloesen = fertig;
        }),
      beiEreignis: (ereignis) => ereignisse.push(ereignis),
      beiZustand: () => undefined,
      socketBauen: (url) => new TestSocket(url),
      zeit: zeitgeber(),
      zufall: () => 0,
    });
    client.start();
    const socket = TestSocket.letzte as TestSocket;
    socket.oeffnen();
    await microtasks();
    socket.nachricht({ type: "event", stream: "band", seq: 1, event: "song.created", data: {} });
    expect(ereignisse).toHaveLength(0);
    steuerung.aufloesen?.({ counters: { band: 0, personal: 0 } });
    await microtasks();
    expect(ereignisse).toHaveLength(1);
    client.stop();
  });

  it("erlaubt nach einer Serverschließung einen neuen Versuch", async () => {
    const aufbau = baue({ band: 0, personal: 0 });
    const socket = await verbinde(aufbau);
    socket.nachricht({ type: "closed", reason: "unauthorized" });
    expect(aufbau.zustaende.at(-1)).toBe("abgleich-fehlgeschlagen");
    expect(aufbau.verluste).toBe(1);
    aufbau.client.erneutVersuchen();
    const neu = TestSocket.letzte as TestSocket;
    expect(neu).not.toBe(socket);
    neu.oeffnen();
    await microtasks();
    expect(aufbau.zustaende.at(-1)).toBe("verbunden");
  });

  it("beendet die Verbindung ohne weitere Versuche", async () => {
    const aufbau = baue({ band: 0, personal: 0 });
    const socket = await verbinde(aufbau);
    aufbau.client.stop();
    socket.trennen();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(TestSocket.letzte).toBe(socket);
  });
});
