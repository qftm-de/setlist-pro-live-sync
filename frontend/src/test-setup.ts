import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

configure({ asyncUtilTimeout: 15_000 });

// Kein echter Netzverkehr in Komponententests. Der Echtzeit-Client öffnet
// einen stillen Socket, der nie antwortet; Abgleich und Takt laufen nicht an.
class StillerWebSocket {
  onopen: ((ereignis: Event) => void) | null = null;
  onmessage: ((ereignis: MessageEvent) => void) | null = null;
  onclose: ((ereignis: CloseEvent) => void) | null = null;
  onerror: ((ereignis: Event) => void) | null = null;

  constructor(public readonly url: string) {}

  send(): void {}

  close(): void {}
}

(globalThis as { WebSocket?: unknown }).WebSocket = StillerWebSocket;

afterEach(() => {
  cleanup();
});
