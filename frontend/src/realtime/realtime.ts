import { AUSFALL_MS, HEARTBEAT_MS, socketUrl, standardZeit, wartezeit } from "./verbindung";
import type { SyncOptionen, Verbindungszustand, WebSocketLike, Zaehler, Zeitgeber } from "./typen";

export class BandSync {
  private readonly optionen: SyncOptionen;
  private readonly zeit: Zeitgeber;
  private socket: WebSocketLike | null = null;
  private laeuft = false;
  private aufgeben = false;
  private versuch = 0;
  private verbindungsLauf = 0;
  private abgleichLauf = 0;
  private zaehler: Zaehler = { band: 0, personal: 0 };
  private letzterKontakt = 0;
  private heartbeat: number | null = null;
  private nachholen: number | null = null;
  private abgleichAktiv = false;
  private puffer: Record<string, unknown>[] = [];

  constructor(optionen: SyncOptionen) {
    this.optionen = optionen;
    this.zeit = optionen.zeit ?? standardZeit();
  }

  start(): void {
    if (this.laeuft) {
      return;
    }
    this.laeuft = true;
    this.aufgeben = false;
    this.versuch = 0;
    this.oeffnen();
  }

  stop(): void {
    this.laeuft = false;
    this.puffer = [];
    this.verbindungsLauf += 1;
    this.abgleichLauf += 1;
    this.raeumeZeit();
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      try {
        socket.close(1000, "client wechselt");
      } catch {
        // Ein bereits geschlossener Socket braucht keine weitere Behandlung.
      }
    }
  }

  sende(nachricht: Record<string, unknown>): void {
    if (!this.socket) {
      return;
    }
    try {
      this.socket.send(JSON.stringify(nachricht));
    } catch {
      // Ein geschlossener Socket wird über onclose behandelt.
    }
  }

  /** Erneuter Abgleich nach sichtbarem Fehler. Startet die Verbindung neu. */
  erneutVersuchen(): void {
    if (!this.laeuft) {
      this.start();
      return;
    }
    this.aufgeben = false;
    this.versuch = 0;
    this.raeumeZeit();
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      try {
        socket.close(1000, "erneut");
      } catch {
        // ignorieren
      }
    }
    this.oeffnen();
  }

  private oeffnen(): void {
    if (!this.laeuft || this.aufgeben) {
      return;
    }
    const lauf = ++this.verbindungsLauf;
    this.melde(this.versuch === 0 ? "verbinden" : "unterbrochen");
    const bauen =
      this.optionen.socketBauen ?? ((url: string) => new WebSocket(url) as WebSocketLike);
    let socket: WebSocketLike;
    try {
      socket = bauen(socketUrl(this.optionen.bandId));
    } catch {
      this.planeNeu(++this.versuch);
      return;
    }
    this.socket = socket;
    this.letzterKontakt = this.zeit.now();

    socket.onopen = () => {
      if (lauf !== this.verbindungsLauf) {
        return;
      }
      void this.gleicheAb();
    };
    socket.onmessage = (ereignis) => {
      if (lauf !== this.verbindungsLauf) {
        return;
      }
      this.letzterKontakt = this.zeit.now();
      this.verarbeite(ereignis.data);
    };
    socket.onerror = () => {
      // onclose folgt. Kein doppeltes Neuplanen.
    };
    socket.onclose = () => {
      if (lauf !== this.verbindungsLauf) {
        return;
      }
      this.raeumeZeit();
      this.socket = null;
      if (!this.laeuft || this.aufgeben) {
        return;
      }
      this.melde("unterbrochen");
      this.optionen.beiVerbindungsverlust?.();
      this.planeNeu(++this.versuch);
    };
  }

  private planeNeu(versuch: number): void {
    if (!this.laeuft || this.aufgeben || this.nachholen !== null) {
      return;
    }
    this.nachholen = this.zeit.setTimeout(() => {
      this.nachholen = null;
      this.oeffnen();
    }, wartezeit(versuch, this.optionen.zufall));
  }

  private async gleicheAb(): Promise<void> {
    const lauf = ++this.abgleichLauf;
    this.abgleichAktiv = true;
    this.melde("abgleich");
    try {
      const daten = await this.optionen.ladeAbgleich(this.optionen.bandId);
      if (lauf !== this.abgleichLauf || !this.laeuft) {
        return;
      }
      this.zaehler = { ...daten.counters };
      this.abgleichAktiv = false;
      this.versuch = 0;
      this.optionen.beiAbgleich?.(daten.daten);
      this.melde("verbunden");
      this.verarbeitePuffer();
      this.startHeartbeat();
    } catch {
      if (lauf !== this.abgleichLauf || !this.laeuft) {
        return;
      }
      this.abgleichAktiv = false;
      this.puffer = [];
      this.melde("abgleich-fehlgeschlagen");
      const socket = this.socket;
      this.socket = null;
      this.verbindungsLauf += 1;
      if (socket) {
        try {
          socket.close(1000, "abgleich fehlgeschlagen");
        } catch {
          // ignorieren
        }
      }
      this.planeNeu(++this.versuch);
    }
  }

  private startHeartbeat(): void {
    this.stoppeHeartbeat();
    const tick = () => {
      if (!this.laeuft || this.socket === null) {
        return;
      }
      if (this.zeit.now() - this.letzterKontakt >= AUSFALL_MS) {
        this.melde("unterbrochen");
        const socket = this.socket;
        this.socket = null;
        if (socket) {
          try {
            socket.close(4000, "heartbeat");
          } catch {
            // ignorieren
          }
        }
        this.planeNeu(++this.versuch);
        return;
      }
      try {
        this.socket.send(JSON.stringify({ type: "ping" }));
      } catch {
        return;
      }
      this.heartbeat = this.zeit.setTimeout(tick, HEARTBEAT_MS);
    };
    this.heartbeat = this.zeit.setTimeout(tick, HEARTBEAT_MS);
  }

  private stoppeHeartbeat(): void {
    if (this.heartbeat !== null) {
      this.zeit.clearTimeout(this.heartbeat);
      this.heartbeat = null;
    }
  }

  private raeumeZeit(): void {
    this.stoppeHeartbeat();
    if (this.nachholen !== null) {
      this.zeit.clearTimeout(this.nachholen);
      this.nachholen = null;
    }
  }

  private verarbeitePuffer(): void {
    const puffer = this.puffer;
    this.puffer = [];
    for (const nachricht of puffer) {
      this.verarbeiteEreignis(nachricht);
    }
  }

  private verarbeite(roh: unknown): void {
    if (typeof roh !== "string") {
      return;
    }
    let nachricht: Record<string, unknown>;
    try {
      nachricht = JSON.parse(roh) as Record<string, unknown>;
    } catch {
      return;
    }
    if (nachricht.type === "event") {
      if (this.abgleichAktiv) {
        this.puffer.push(nachricht);
        return;
      }
      this.verarbeiteEreignis(nachricht);
      return;
    }
    if (nachricht.type === "ready") {
      const zahlen = nachricht.counters as Zaehler | undefined;
      this.optionen.beiBereit?.({
        connection:
          typeof nachricht.connection === "string" ? nachricht.connection : undefined,
        counters: zahlen ?? { band: 0, personal: 0 },
      });
      if (zahlen) {
        this.pruefeZaehler(zahlen);
      }
      return;
    }
    if (nachricht.type === "pong") {
      const zahlen = nachricht.counters as Zaehler | undefined;
      if (zahlen) {
        this.pruefeZaehler(zahlen);
      }
      return;
    }
    if (
      nachricht.type === "stage.result" ||
      nachricht.type === "text.result" ||
      nachricht.type === "text.error" ||
      nachricht.type === "command.result" ||
      nachricht.type === "command.error"
    ) {
      this.optionen.beiAntwort?.(nachricht);
      return;
    }
    if (nachricht.type === "closed") {
      this.aufgeben = true;
      this.melde("abgleich-fehlgeschlagen");
      this.optionen.beiVerbindungsverlust?.("ohne-recht");
      this.raeumeZeit();
      const socket = this.socket;
      this.socket = null;
      if (socket) {
        try {
          socket.close(1000, "ohne recht");
        } catch {
          // ignorieren
        }
      }
    }
  }

  private verarbeiteEreignis(nachricht: Record<string, unknown>): void {
    const strom = nachricht.stream;
    const seq = nachricht.seq;
    if ((strom !== "band" && strom !== "personal") || typeof seq !== "number") {
      return;
    }
    const stand = this.zaehler[strom];
    if (seq <= stand) {
      return;
    }
    if (seq !== stand + 1) {
      void this.gleicheAb();
      return;
    }
    this.zaehler = { ...this.zaehler, [strom]: seq };
    this.optionen.beiEreignis({
      stream: strom,
      seq,
      event: String(nachricht.event ?? ""),
      data:
        nachricht.data && typeof nachricht.data === "object"
          ? (nachricht.data as Record<string, unknown>)
          : {},
    });
  }

  private pruefeZaehler(zahlen: Zaehler): void {
    if (this.abgleichAktiv) {
      return;
    }
    if (zahlen.band > this.zaehler.band || zahlen.personal > this.zaehler.personal) {
      void this.gleicheAb();
    }
  }

  private melde(zustand: Verbindungszustand): void {
    this.optionen.beiZustand(zustand);
  }
}
