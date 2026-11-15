/** HTTP-Sitzung mit Cookies, CSRF und einem Retry nach Container-Neustart. */
export class Sitzung {
  constructor(basis) {
    this.basis = basis;
    this.cookies = new Map();
  }

  merke(antwort) {
    for (const eintrag of antwort.headers.getSetCookie()) {
      const paar = eintrag.split(";")[0];
      const trenner = paar.indexOf("=");
      this.cookies.set(paar.slice(0, trenner), paar.slice(trenner + 1));
    }
  }

  token() {
    return this.cookies.get("csrftoken") || "";
  }

  async hole(url, optionen) {
    let letzter = null;
    for (let versuch = 0; versuch < 2; versuch += 1) {
      try {
        return await fetch(url, optionen);
      } catch (fehler) {
        letzter = fehler;
        // Nach einem Container-Neustart kann ein Keep-Alive-Socket tot sein.
        await new Promise((fertig) => setTimeout(fertig, 300));
      }
    }
    throw letzter;
  }

  async ruf(pfad, { methode = "GET", koerper } = {}) {
    const kopfzeilen = { Accept: "application/json" };
    if (this.cookies.size) {
      kopfzeilen.Cookie = [...this.cookies]
        .map(([name, wert]) => `${name}=${wert}`)
        .join("; ");
    }
    if (methode !== "GET" && this.token()) {
      kopfzeilen["X-CSRFToken"] = this.token();
    }
    if (koerper !== undefined) {
      kopfzeilen["Content-Type"] = "application/json";
    }
    const antwort = await this.hole(`${this.basis}${pfad}`, {
      method: methode,
      headers: kopfzeilen,
      body: koerper === undefined ? undefined : JSON.stringify(koerper),
      redirect: "manual",
    });
    this.merke(antwort);
    const text = await antwort.text();
    let daten = null;
    try {
      daten = text ? JSON.parse(text) : null;
    } catch {
      daten = text;
    }
    return { status: antwort.status, daten };
  }

  kopfzeilen() {
    const werte = { Accept: "application/json" };
    if (this.cookies.size) {
      werte.Cookie = [...this.cookies]
        .map(([name, wert]) => `${name}=${wert}`)
        .join("; ");
    }
    return werte;
  }

  async datei(pfad, daten, { name = "partitur.pdf", uploadId } = {}) {
    const form = new FormData();
    form.set("file", new Blob([daten], { type: "application/pdf" }), name);
    form.set("upload_id", uploadId);
    const kopfzeilen = this.kopfzeilen();
    if (this.token()) {
      kopfzeilen["X-CSRFToken"] = this.token();
    }
    const antwort = await this.hole(`${this.basis}${pfad}`, {
      method: "POST",
      headers: kopfzeilen,
      body: form,
    });
    this.merke(antwort);
    const text = await antwort.text();
    let datenJson = null;
    try {
      datenJson = text ? JSON.parse(text) : null;
    } catch {
      datenJson = text;
    }
    return { status: antwort.status, daten: datenJson };
  }

  async roh(pfad, { methode = "GET", kopf = {}, koerper } = {}) {
    const antwort = await this.hole(`${this.basis}${pfad}`, {
      method: methode,
      headers: { ...this.kopfzeilen(), ...kopf },
      body: koerper,
    });
    this.merke(antwort);
    return {
      status: antwort.status,
      headers: antwort.headers,
      bytes: Buffer.from(await antwort.arrayBuffer()),
    };
  }
}
