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

    // Während die Anfrage läuft, tippt der Nutzer weiter.
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

  it("übernimmt die neue Epoche aus einem 409 und sendet den Entwurf erneut", async () => {
    vi.useFakeTimers();
    const basis = stand("A");
    const server = serverAus(basis);
    const aufrufe: Array<{ update: string; epoch: number }> = [];
    const onKonflikt = vi.fn();
    const senden = (update: string, epoch: number) => {
      aufrufe.push({ update, epoch });
      if (aufrufe.length === 1) {
        return Promise.reject(
          new ApiFehler(409, "conflict", "ersetzt", { current_epoch: 1 }),
        );
      }
      Y.applyUpdate(server, bytesAusBase64(update));
      return Promise.resolve(antwort(server, 1, 2));
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
    expect(result.current.zustand).toBe("abgelehnt");
    expect(result.current.entwurf).toBe("AB");
    expect(onKonflikt).toHaveBeenCalledTimes(1);

    act(() => result.current.uebernehmen());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(aufrufe).toHaveLength(2);
    expect(aufrufe[1].epoch).toBe(1);
    expect(result.current.zustand).toBe("bestaetigt");
  });
});
