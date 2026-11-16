import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { ApiFehler } from "../api/client";
import { useCrdtText } from "./useCrdtText";
import { antwort, serverAus, stand } from "./crdtTestHelfer";
import {
  base64AusBytes,
  bytesAusBase64,
  type TextAntwort,
  type TextStand,
} from "./texte";

afterEach(() => {
  vi.useRealTimers();
});

describe("useCrdtText Epochen und erster Stand", () => {
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

  it("übernimmt getippten Prop-Text beim ersten Serverstand", async () => {
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
      (optionen: { standWert: TextStand | null; wert: string }) =>
        useCrdtText({
          stand: optionen.standWert,
          wert: optionen.wert,
          aktiv: true,
          senden,
        }),
      {
        initialProps: {
          standWert: null as TextStand | null,
          wert: "Set 1",
        },
      },
    );
    // Der Editor tippt über den Hook und spiegelt den Wert in den Prop.
    act(() => result.current.setWert("Set 1 neu"));
    rerender({ standWert: null, wert: "Set 1 neu" });
    rerender({ standWert: basis, wert: "Set 1 neu" });
    expect(result.current.wert).toBe("Set 1 neu");
    expect(result.current.zustand).toBe("offen");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(sends).toEqual([0]);
    expect(server.getText("t").toString()).toBe("Set 1 neu");
    expect(result.current.zustand).toBe("bestaetigt");
  });

  it("überschreibt neueren Servertext nach Tippen und Zurücksetzen nicht", () => {
    const basis = stand("Alt!");
    const senden = vi.fn(async () => antwort(serverAus(basis), 0, 1));
    const { result, rerender } = renderHook(
      (optionen: { standWert: TextStand | null; wert: string }) =>
        useCrdtText({
          stand: optionen.standWert,
          wert: optionen.wert,
          aktiv: true,
          senden,
        }),
      { initialProps: { standWert: null as TextStand | null, wert: "Alt" } },
    );
    act(() => result.current.setWert("AltX"));
    act(() => result.current.setWert("Alt"));
    rerender({ standWert: basis, wert: "Alt" });
    expect(result.current.wert).toBe("Alt!");
    expect(senden).not.toHaveBeenCalled();
  });

  it("lässt neueren Servertext bei unverändertem Prop stehen", () => {
    const basis = stand("Alt!");
    const senden = vi.fn(async () => antwort(serverAus(basis), 0, 1));
    const { result, rerender } = renderHook(
      (optionen: { standWert: TextStand | null; wert: string }) =>
        useCrdtText({
          stand: optionen.standWert,
          wert: optionen.wert,
          aktiv: true,
          senden,
        }),
      { initialProps: { standWert: null as TextStand | null, wert: "Alt" } },
    );
    rerender({ standWert: basis, wert: "Alt" });
    expect(result.current.wert).toBe("Alt!");
    expect(result.current.zustand).toBe("bestaetigt");
    expect(senden).not.toHaveBeenCalled();
  });

  it("sendet eine reine Löschung", async () => {
    vi.useFakeTimers();
    const basis = stand("AB");
    const server = serverAus(basis);
    const sends: number[] = [];
    const senden = (update: string, epoch: number) => {
      sends.push(epoch);
      Y.applyUpdate(server, bytesAusBase64(update));
      return Promise.resolve(antwort(server, epoch, 1));
    };
    const { result } = renderHook(() =>
      useCrdtText({ stand: basis, wert: "AB", aktiv: true, senden }),
    );
    act(() => result.current.setWert("A"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(sends).toEqual([0]);
    expect(server.getText("t").toString()).toBe("A");
    expect(result.current.zustand).toBe("bestaetigt");
  });

  it("sendet eine reine Löschung beim ersten Stand", async () => {
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
      (optionen: { standWert: TextStand | null; wert: string }) =>
        useCrdtText({
          stand: optionen.standWert,
          wert: optionen.wert,
          aktiv: true,
          senden,
        }),
      { initialProps: { standWert: null as TextStand | null, wert: "Set 1" } },
    );
    act(() => result.current.setWert("Set "));
    rerender({ standWert: basis, wert: "Set " });
    expect(result.current.wert).toBe("Set ");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(sends).toEqual([0]);
    expect(server.getText("t").toString()).toBe("Set ");
  });

  it("behält ein Remote-Ereignis vor dem ersten Serverstand", () => {
    const eins = stand("Eins");
    const ereignis = stand("Neu", 0);
    const alt = stand("Alt", 0);
    const senden = vi.fn(async () => antwort(serverAus(eins), 0, 1));
    const { result, rerender } = renderHook(
      (optionen: { standWert: TextStand | null }) =>
        useCrdtText({
          stand: optionen.standWert,
          wert: "Eins",
          aktiv: true,
          senden,
        }),
      { initialProps: { standWert: null as TextStand | null } },
    );
    act(() => result.current.wendeRemoteAn(ereignis.state, 0));
    expect(result.current.wert).toBe("Neu");
    rerender({ standWert: alt });
    expect(result.current.wert).toBe("Neu");
  });

  it("übernimmt lokales Tippen beim ersten Remote-Ereignis", async () => {
    vi.useFakeTimers();
    const ereignis = stand("Neu", 0);
    const server = serverAus(ereignis);
    const sends: number[] = [];
    const senden = (update: string, epoch: number) => {
      sends.push(epoch);
      Y.applyUpdate(server, bytesAusBase64(update));
      return Promise.resolve(antwort(server, epoch, 1));
    };
    const { result } = renderHook(() =>
      useCrdtText({ stand: null, wert: "Eins", aktiv: true, senden }),
    );
    act(() => result.current.setWert("Eins!"));
    act(() => result.current.wendeRemoteAn(ereignis.state, 0));
    expect(result.current.wert).toBe("Eins!");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(sends).toEqual([0]);
    expect(server.getText("t").toString()).toBe("Eins!");
  });

  it("meldet Remote-Stände still über onStand", () => {
    const basis = stand("A");
    const fern = serverAus(basis);
    fern.getText("t").insert(1, "B");
    const onWert = vi.fn();
    const onStand = vi.fn();
    const { result } = renderHook(() =>
      useCrdtText({
        stand: basis,
        wert: "A",
        aktiv: true,
        senden: async () => antwort(fern, 0, 1),
        onWert,
        onStand,
      }),
    );
    act(() =>
      result.current.wendeRemoteAn(
        base64AusBytes(Y.encodeStateAsUpdate(fern)),
        0,
      ),
    );
    expect(result.current.wert).toBe("AB");
    expect(onStand).toHaveBeenCalledWith("AB");
    expect(onWert).not.toHaveBeenCalled();
  });

  it("ignoriert einen älteren Stand vor dem ersten Serverstand", () => {
    const eins = stand("Eins");
    const neu = stand("Neu", 1);
    const alt = stand("Alt", 0);
    const senden = vi.fn(async () => antwort(serverAus(eins), 0, 1));
    const { result, rerender } = renderHook(
      (optionen: { standWert: TextStand | null }) =>
        useCrdtText({
          stand: optionen.standWert,
          wert: "Eins",
          aktiv: true,
          senden,
        }),
      { initialProps: { standWert: null as TextStand | null } },
    );
    act(() => result.current.wendeRemoteAn(neu.state, 1));
    expect(result.current.wert).toBe("Neu");
    rerender({ standWert: alt });
    expect(result.current.wert).toBe("Neu");
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
