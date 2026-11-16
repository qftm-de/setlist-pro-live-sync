import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { ApiFehler } from "../api/client";
import { useCrdtText } from "./useCrdtText";
import {
  base64AusBytes,
  bytesAusBase64,
  type TextAntwort,
  type TextStand,
} from "./texte";

function stand(text: string, epoch = 0): TextStand {
  const doc = new Y.Doc();
  doc.getText("t").insert(0, text);
  return {
    object_type: "setlist",
    object_uuid: "u1",
    field: "name",
    epoch,
    revision: 0,
    state: base64AusBytes(Y.encodeStateAsUpdate(doc)),
  };
}

function serverAus(standWert: TextStand): Y.Doc {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, bytesAusBase64(standWert.state));
  return doc;
}

function antwort(server: Y.Doc, epoch: number, revision: number): TextAntwort {
  const text = server.getText("t").toString();
  return {
    text,
    epoch,
    revision,
    update: base64AusBytes(Y.encodeStateAsUpdate(server)),
  };
}

function aufschub<T>() {
  let aufloesen!: (wert: T) => void;
  let ablehnen!: (fehler: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    aufloesen = res;
    ablehnen = rej;
  });
  return { promise, aufloesen, ablehnen };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useCrdtText", () => {
  it("bestätigt keine ungesendeten lokalen Zeichen", async () => {
    vi.useFakeTimers();
    const basis = stand("A");
    const server = serverAus(basis);
    const aufrufe: Array<{
      update: string;
      epoch: number;
      aufschub: ReturnType<typeof aufschub<TextAntwort>>;
    }> = [];
    const senden = (update: string, epoch: number) => {
      const offen = aufschub<TextAntwort>();
      aufrufe.push({ update, epoch, aufschub: offen });
      return offen.promise;
    };
    const { result } = renderHook(() =>
      useCrdtText({ stand: basis, wert: "A", aktiv: true, senden }),
    );

    act(() => result.current.setWert("AB"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(aufrufe).toHaveLength(1);

    act(() => result.current.setWert("ABC"));
    Y.applyUpdate(server, bytesAusBase64(aufrufe[0].update));
    await act(async () => {
      aufrufe[0].aufschub.aufloesen(antwort(server, 0, 1));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(aufrufe.length).toBeGreaterThanOrEqual(2);
    Y.applyUpdate(server, bytesAusBase64(aufrufe[1].update));
    expect(server.getText("t").toString()).toBe("ABC");

    await act(async () => {
      aufrufe[1].aufschub.aufloesen(antwort(server, 0, 2));
    });
  });

  it("ersetzt bei einer neuen Remote-Epoche und behält den Entwurf", async () => {
    vi.useFakeTimers();
    const basis = stand("Alt");
    const neu = stand("Neu", 1);
    const server = serverAus(neu);
    const sends: Array<{ update: string; epoch: number }> = [];
    const senden = (update: string, epoch: number) => {
      sends.push({ update, epoch });
      Y.applyUpdate(server, bytesAusBase64(update));
      return Promise.resolve(antwort(server, epoch, 2));
    };
    const { result } = renderHook(() =>
      useCrdtText({ stand: basis, wert: "Alt", aktiv: true, senden }),
    );

    act(() => result.current.setWert("Alt!"));
    act(() => result.current.wendeRemoteAn(neu.state, 1));
    expect(result.current.wert).toBe("Neu");
    expect(result.current.entwurf).toBe("Alt!");
    expect(result.current.zustand).toBe("abgelehnt");

    act(() => result.current.uebernehmen());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(sends).toHaveLength(1);
    expect(sends[0].epoch).toBe(1);
    expect(server.getText("t").toString()).toBe("Alt!");
    expect(result.current.zustand).toBe("bestaetigt");
  });

  it("verdoppelt den Text beim ersten Serverstand nicht", () => {
    const basis = stand("Set 1");
    const senden = vi.fn(async () => antwort(serverAus(basis), 0, 1));
    const { result, rerender } = renderHook(
      (optionen: { stand: TextStand | null }) =>
        useCrdtText({
          stand: optionen.stand,
          wert: "Set 1",
          aktiv: true,
          senden,
        }),
      { initialProps: { stand: null as TextStand | null } },
    );
    expect(result.current.wert).toBe("Set 1");
    rerender({ stand: basis });
    expect(result.current.wert).toBe("Set 1");
    expect(result.current.zustand).toBe("bestaetigt");
    expect(senden).not.toHaveBeenCalled();
  });

  it("übernimmt getippten Text beim ersten Serverstand ohne Verdopplung", async () => {
    vi.useFakeTimers();
    const basis = stand("Set 1");
    const server = serverAus(basis);
    const sends: number[] = [];
    const senden = (update: string, epoch: number) => {
      sends.push(epoch);
      Y.applyUpdate(server, bytesAusBase64(update));
      return Promise.resolve(antwort(server, epoch, 1));
    };
    const { result, rerender } = renderHook(
      (optionen: { stand: TextStand | null }) =>
        useCrdtText({
          stand: optionen.stand,
          wert: "Set 1",
          aktiv: true,
          senden,
        }),
      { initialProps: { stand: null as TextStand | null } },
    );
    act(() => result.current.setWert("Set 1 neu"));
    rerender({ stand: basis });
    expect(result.current.wert).toBe("Set 1 neu");
    expect(result.current.zustand).toBe("offen");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(sends).toEqual([0]);
    expect(server.getText("t").toString()).toBe("Set 1 neu");
    expect(result.current.zustand).toBe("bestaetigt");
  });

  it("verwirft eine 200 der alten Epoche nach einem Remote-Wechsel", async () => {
    vi.useFakeTimers();
    const basis = stand("A");
    const neu = stand("Neu", 1);
    const server = serverAus(neu);
    const sends: number[] = [];
    let erster!: (antwortWert: TextAntwort) => void;
    const senden = (update: string, epoch: number) => {
      sends.push(epoch);
      if (sends.length === 1) {
        return new Promise<TextAntwort>((res) => {
          erster = res;
        });
      }
      Y.applyUpdate(server, bytesAusBase64(update));
      return Promise.resolve(antwort(server, epoch, 2));
    };
    const { result } = renderHook(() =>
      useCrdtText({ stand: basis, wert: "A", aktiv: true, senden }),
    );

    act(() => result.current.setWert("AB"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    act(() => result.current.wendeRemoteAn(neu.state, 1));
    expect(result.current.wert).toBe("Neu");
    expect(result.current.entwurf).toBe("AB");
    expect(result.current.zustand).toBe("abgelehnt");

    await act(async () => {
      erster(antwort(serverAus(basis), 0, 1));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.wert).toBe("Neu");
    expect(result.current.entwurf).toBe("AB");
    expect(result.current.zustand).toBe("abgelehnt");
    expect(sends).toEqual([0]);

    act(() => result.current.uebernehmen());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(sends).toEqual([0, 1]);
    expect(server.getText("t").toString()).toBe("AB");
    expect(result.current.zustand).toBe("bestaetigt");
  });

  it("behält den Entwurf, wenn ein 409 der alten Epoche verspätet eintrifft", async () => {
    vi.useFakeTimers();
    const basis = stand("A");
    const neu = stand("Neu", 1);
    const server = serverAus(neu);
    const sends: number[] = [];
    let erster!: (fehler: unknown) => void;
    const onKonflikt = vi.fn();
    const senden = (update: string, epoch: number) => {
      sends.push(epoch);
      if (sends.length === 1) {
        return new Promise<TextAntwort>((_res, rej) => {
          erster = rej;
        });
      }
      Y.applyUpdate(server, bytesAusBase64(update));
      return Promise.resolve(antwort(server, epoch, 2));
    };
    const { result } = renderHook(() =>
      useCrdtText({
        stand: basis,
        wert: "A",
        aktiv: true,
        senden,
        onKonflikt,
      }),
    );

    act(() => result.current.setWert("AB"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    act(() => result.current.wendeRemoteAn(neu.state, 1));
    await act(async () => {
      erster(new ApiFehler(409, "conflict", "ersetzt", { current_epoch: 1 }));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.wert).toBe("Neu");
    expect(result.current.entwurf).toBe("AB");
    expect(result.current.zustand).toBe("abgelehnt");
    expect(onKonflikt).not.toHaveBeenCalled();

    act(() => result.current.uebernehmen());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(sends).toEqual([0, 1]);
    expect(server.getText("t").toString()).toBe("AB");
  });

  it("ignoriert einen verspäteten Stand mit älterer Epoche", () => {
    const eins = stand("Eins");
    const zwei = stand("Zwei", 1);
    const alt = stand("Alt", 0);
    const senden = vi.fn(async () => antwort(serverAus(eins), 0, 1));
    const { result, rerender } = renderHook(
      (optionen: { stand: TextStand }) =>
        useCrdtText({
          stand: optionen.stand,
          wert: "Eins",
          aktiv: true,
          senden,
        }),
      { initialProps: { stand: eins } },
    );
    act(() => result.current.wendeRemoteAn(zwei.state, 1));
    expect(result.current.wert).toBe("Zwei");
    rerender({ stand: alt });
    expect(result.current.wert).toBe("Zwei");
  });

  it("lädt nach einem 409 den neuen Stand und sendet den Entwurf mit der neuen Epoche", async () => {
    vi.useFakeTimers();
    const basis = stand("A");
    const neu = stand("Neu", 1);
    let aktuellerServer = serverAus(basis);
    const aufrufe: Array<{ update: string; epoch: number }> = [];
    const onKonflikt = vi.fn();
    const senden = (update: string, epoch: number) => {
      aufrufe.push({ update, epoch });
      if (aufrufe.length === 1) {
        return Promise.reject(
          new ApiFehler(409, "conflict", "ersetzt", { current_epoch: 1 }),
        );
      }
      Y.applyUpdate(aktuellerServer, bytesAusBase64(update));
      return Promise.resolve(antwort(aktuellerServer, epoch, 2));
    };
    const { result, rerender } = renderHook(
      (optionen: { stand: TextStand }) =>
        useCrdtText({
          stand: optionen.stand,
          wert: optionen.stand.epoch === 0 ? "A" : "Neu",
          aktiv: true,
          senden,
          onKonflikt,
        }),
      { initialProps: { stand: basis } },
    );

    act(() => result.current.setWert("AB"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(result.current.zustand).toBe("abgelehnt");
    expect(result.current.entwurf).toBe("AB");
    expect(onKonflikt).toHaveBeenCalledTimes(1);

    // Der Editor lädt nach dem Konflikt den neuen Stand.
    aktuellerServer = serverAus(neu);
    rerender({ stand: neu });
    expect(result.current.wert).toBe("Neu");
    expect(result.current.entwurf).toBe("AB");
    expect(result.current.zustand).toBe("abgelehnt");

    act(() => result.current.uebernehmen());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(aufrufe).toHaveLength(2);
    expect(aufrufe[1].epoch).toBe(1);
    expect(result.current.zustand).toBe("bestaetigt");
    expect(result.current.wert).toBe("AB");
  });
});
