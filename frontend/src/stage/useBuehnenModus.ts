import { useEffect, useRef, useState } from "react";

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (art: string, rueckruf: () => void) => void;
}

interface NavigatorMitWakeLock {
  wakeLock?: {
    request: (art: "screen") => Promise<WakeLockSentinelLike>;
  };
}

export function useBuehnenModus(behaelter: React.RefObject<HTMLElement | null>) {
  const [wakeAktiv, setWakeAktiv] = useState(false);
  const [vollbild, setVollbild] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const sentinel = useRef<WakeLockSentinelLike | null>(null);

  async function wakeLockAnfordern() {
    const api = (navigator as Navigator & NavigatorMitWakeLock).wakeLock;
    if (!api) {
      setHinweis("Dieser Browser unterstützt den Screen Wake Lock nicht.");
      return;
    }
    try {
      sentinel.current = await api.request("screen");
      setWakeAktiv(true);
      sentinel.current.addEventListener("release", () => setWakeAktiv(false));
    } catch {
      setHinweis("Der Bildschirm bleibt möglicherweise nicht an.");
    }
  }

  async function wakeLockFreigeben() {
    const aktuell = sentinel.current;
    sentinel.current = null;
    setWakeAktiv(false);
    await aktuell?.release().catch(() => undefined);
  }

  async function vollbildUmschalten() {
    if (!behaelter.current) {
      return;
    }
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setVollbild(false);
      } else {
        await behaelter.current.requestFullscreen();
        setVollbild(true);
      }
    } catch {
      setHinweis("Vollbild wurde abgelehnt.");
      setVollbild(false);
    }
  }

  useEffect(() => {
    const beiVollbild = () => setVollbild(Boolean(document.fullscreenElement));
    const beiSichtbarkeit = () => {
      if (document.visibilityState === "visible" && sentinel.current === null) {
        setWakeAktiv(false);
      }
    };
    document.addEventListener("fullscreenchange", beiVollbild);
    document.addEventListener("visibilitychange", beiSichtbarkeit);
    return () => {
      document.removeEventListener("fullscreenchange", beiVollbild);
      document.removeEventListener("visibilitychange", beiSichtbarkeit);
      void wakeLockFreigeben();
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => undefined);
      }
    };
  }, []);

  return {
    wakeAktiv,
    vollbild,
    hinweis,
    wakeLockAnfordern,
    wakeLockFreigeben,
    vollbildUmschalten,
  };
}
