import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Ereignis } from "../realtime/typen";
import { TEXT_EREIGNISSE_GRENZE, useTextEreignisse } from "./useTextEreignisse";

function textEreignis(objectUuid: string, field = "name"): Ereignis {
  return {
    stream: "band",
    seq: 1,
    event: "text.updated",
    data: {
      object_uuid: objectUuid,
      field,
      update: "AA==",
      epoch: 3,
      revision: 7,
    },
  };
}

describe("useTextEreignisse", () => {
  it("speichert ein Textupdate unter dem Feld-Schlüssel", () => {
    const { result } = renderHook(() => useTextEreignisse());

    act(() => {
      result.current.textEreignisSpeichern(textEreignis("a"));
    });

    expect(result.current.textEreignisse).toEqual({
      "a:name": {
        object_uuid: "a",
        field: "name",
        update: "AA==",
        epoch: 3,
        revision: 7,
      },
    });
  });

  it("ignoriert andere Ereignisse", () => {
    const { result } = renderHook(() => useTextEreignisse());

    act(() => {
      result.current.textEreignisSpeichern({
        stream: "band",
        seq: 2,
        event: "setlist.created",
        data: { object_uuid: "b" },
      });
    });

    expect(result.current.textEreignisse).toEqual({});
  });

  it("leert die Map wie bei Bandwechsel und Abgleich", () => {
    const { result } = renderHook(() => useTextEreignisse());

    act(() => {
      result.current.textEreignisSpeichern(textEreignis("a"));
      result.current.textEreignisSpeichern(textEreignis("b"));
    });
    expect(Object.keys(result.current.textEreignisse)).toHaveLength(2);

    act(() => {
      result.current.leeren();
    });
    expect(result.current.textEreignisse).toEqual({});
  });

  it("behält höchstens 128 Einträge und verwirft den ältesten", () => {
    const { result } = renderHook(() => useTextEreignisse());

    act(() => {
      for (let i = 0; i < TEXT_EREIGNISSE_GRENZE + 1; i += 1) {
        result.current.textEreignisSpeichern(textEreignis(`objekt-${i}`));
      }
    });

    const schluessel = Object.keys(result.current.textEreignisse);
    expect(schluessel).toHaveLength(TEXT_EREIGNISSE_GRENZE);
    expect(schluessel).not.toContain("objekt-0:name");
    expect(schluessel).toContain(`objekt-${TEXT_EREIGNISSE_GRENZE}:name`);
    expect(result.current.verlust).toBe(1);
  });

  it("ersetzt ein bekanntes Feld und hält es aktuell", () => {
    const { result } = renderHook(() => useTextEreignisse());

    act(() => {
      result.current.textEreignisSpeichern(textEreignis("a"));
      for (let i = 0; i < TEXT_EREIGNISSE_GRENZE - 1; i += 1) {
        result.current.textEreignisSpeichern(textEreignis(`objekt-${i}`));
      }
      result.current.textEreignisSpeichern(textEreignis("a"));
      result.current.textEreignisSpeichern(textEreignis("neu"));
    });

    const schluessel = Object.keys(result.current.textEreignisse);
    expect(schluessel).toHaveLength(TEXT_EREIGNISSE_GRENZE);
    expect(schluessel).toContain("a:name");
    expect(schluessel).not.toContain("objekt-0:name");
  });
});
