import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

function huelle() {
  render(
    <AppShell titel="Probe" pfad="/" onNavigieren={vi.fn()}>
      <p>Inhalt</p>
    </AppShell>,
  );
}

describe("AppShell", () => {
  it("nennt den Betreiber im Fuß", () => {
    huelle();
    const fuss = screen.getByRole("contentinfo");
    expect(fuss).toHaveTextContent("Powered by");
    expect(within(fuss).getByRole("link", { name: "QFTM.de" })).toHaveAttribute(
      "href",
      "https://qftm.de",
    );
  });

  it("öffnet den Betreiber-Link in einem neuen Tab ohne Referrer", () => {
    huelle();
    const link = within(screen.getByRole("contentinfo")).getByRole("link", {
      name: "QFTM.de",
    });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });
});
