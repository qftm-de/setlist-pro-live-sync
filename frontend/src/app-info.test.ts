import { describe, expect, it } from "vitest";
import { appName } from "./app-info";

describe("app-info", () => {
  it("nennt den App-Namen", () => {
    expect(appName).toBe("Setlist Pro Live Sync");
  });
});
