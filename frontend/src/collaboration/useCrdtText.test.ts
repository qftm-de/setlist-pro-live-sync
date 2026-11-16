import { act, renderHook } from "@testing-library/react";
import { ApiFehler } from "../api/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { useCrdtText } from "./useCrdtText";
import {
  aufschub,
  antwort,
  serverAus,
  stand,
} from "./crdtTestHelfer";
import {
  base64AusBytes,
  bytesAusBase64,
  type TextAntwort,
  type TextStand,
} from "./texte";

afterEach(() => {
  vi.useRealTimers();
});

describe("useCrdtText", () => {
  it("behält den lokalen Text bei einem Namenskonflikt", async () => {
    vi.useFakeTimers();
    const basis = stand("A");
    const senden = vi
      .fn()
      .mockRejectedValue(
        new ApiFehler(409, "conflict", "Der Name ist vergeben."),
      );
    const onKonflikt = vi.fn();
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
    expect(result.current.wert).toBe("AB");
    expect(result.current.zustand).toBe("abgelehnt");
    expect(result.current.fehler).toContain("Der Name ist vergeben.");
    expect(onKonflikt).not.toHaveBeenCalled();
  });

  it("zeigt einen Sendefehler und wiederholt ihn", async () => {
    vi.useFakeTimers();
    const basis = stand("A");
    const server = serverAus(basis);
    let aufrufe = 0;
    const senden = (update: string, epoch: number) => {
      aufrufe += 1;
      if (aufrufe === 1) {
        return Promise.reject(new ApiFehler(0, "network"));
      }
      Y.applyUpdate(server, bytesAusBase64(update));
      return Promise.resolve(antwort(server, epoch, 1));
    };
    const { result } = renderHook(() =>
      useCrdtText({ stand: basis, wert: "A", aktiv: true, senden }),
    );
    act(() => result.current.setWert("AB"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(result.current.fehler).toContain("Senden fehlgeschlagen");
    expect(result.current.zustand).toBe("fehler");

    act(() => result.current.sendeJetzt());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.fehler).toBeNull();
    expect(result.current.zustand).toBe("bestaetigt");
    expect(server.getText("t").toString()).toBe("AB");
  });

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
  it("nimmt einen neueren Lesestand trotz älterem Ereignis an", () => {
    const basis = stand("A");
    const ereignisDoc = serverAus(basis);
    ereignisDoc.getText("t").insert(1, "B");
    const neuerDoc = new Y.Doc();
    Y.applyUpdate(neuerDoc, Y.encodeStateAsUpdate(ereignisDoc));
    neuerDoc.getText("t").insert(2, "!");
    const senden = vi.fn(async () => antwort(serverAus(basis), 0, 1));
    const { result, rerender } = renderHook(
      (optionen: { standWert: TextStand }) =>
        useCrdtText({
          stand: optionen.standWert,
          wert: "A",
          aktiv: true,
          senden,
        }),
      { initialProps: { standWert: basis } },
    );
    act(() =>
      result.current.wendeRemoteAn(
        base64AusBytes(Y.encodeStateAsUpdate(ereignisDoc)),
        0,
        1,
      ),
    );
    expect(result.current.wert).toBe("AB");
    const neuerStand = {
      ...stand("AB!", 0),
      revision: 2,
      state: base64AusBytes(Y.encodeStateAsUpdate(neuerDoc)),
    };
    rerender({ standWert: neuerStand });
    expect(result.current.wert).toBe("AB!");
  });

});
