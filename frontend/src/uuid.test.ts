import { describe, expect, it } from "vitest";
import { neueUuid } from "./uuid";

describe("neueUuid", () => {
  it("nutzt randomUUID, wenn vorhanden", () => {
    const quelle = {
      randomUUID: () => "11111111-2222-4333-8444-555555555555",
    } as unknown as Crypto;
    expect(neueUuid(quelle)).toBe("11111111-2222-4333-8444-555555555555");
  });

  it("baut ohne randomUUID eine eigene v4-Kennung", () => {
    let zaehler = 0;
    const quelle = {
      getRandomValues: (bytes: Uint8Array) => {
        zaehler += 1;
        bytes.fill(zaehler);
        return bytes;
      },
    } as unknown as Crypto;
    const erste = neueUuid(quelle);
    const zweite = neueUuid(quelle);
    expect(erste).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(zweite).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(erste).not.toBe(zweite);
  });
});
