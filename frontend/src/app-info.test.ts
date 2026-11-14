import { describe, expect, it } from "vitest";
import { appName, betriebsmodus } from "./app-info";

describe("app-info", () => {
  it("nennt den App-Namen", () => {
    expect(appName).toBe("Setlist Pro Live Sync");
  });

  it("läuft ohne Community-URL im Modus core", () => {
    expect(betriebsmodus(undefined)).toBe("core");
  });

  it("läuft mit Community-URL im Modus hub", () => {
    expect(betriebsmodus("https://hub.example")).toBe("hub");
  });
});
