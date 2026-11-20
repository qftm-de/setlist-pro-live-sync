import { afterEach, describe, expect, it, vi } from "vitest";
import { starteDownload } from "./export";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("starteDownload", () => {
  it("gibt die Object-URL erst nach einer Sekunde frei", () => {
    vi.useFakeTimers();
    const create = vi.fn(() => "blob:export");
    const revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
    const klick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    starteDownload({ blob: new Blob(["inhalt"]), name: "band-export.zip" });

    expect(create).toHaveBeenCalledOnce();
    expect(klick).toHaveBeenCalledOnce();
    expect(revoke).not.toHaveBeenCalled();

    vi.advanceTimersByTime(999);
    expect(revoke).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(revoke).toHaveBeenCalledWith("blob:export");
  });
});
