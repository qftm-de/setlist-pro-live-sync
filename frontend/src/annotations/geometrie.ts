import type { Geometrie } from "./annotations";

export interface Punkt {
  x: number;
  y: number;
}

export function begrenze(wert: number): number {
  return Math.min(1, Math.max(0, wert));
}

export function rechteckAusPunkten(a: Punkt, b: Punkt): Geometrie | null {
  const x = begrenze(Math.min(a.x, b.x));
  const y = begrenze(Math.min(a.y, b.y));
  const width = begrenze(Math.max(a.x, b.x)) - x;
  const height = begrenze(Math.max(a.y, b.y)) - y;
  if (width <= 0.001 || height <= 0.001) {
    return null;
  }
  return { x, y, width, height };
}

export function alsProzent(wert: number): string {
  return `${(wert * 100).toFixed(1)} %`;
}

export function gueltig(geometrie: Geometrie): boolean {
  return (
    Number.isFinite(geometrie.x) &&
    Number.isFinite(geometrie.y) &&
    Number.isFinite(geometrie.width) &&
    Number.isFinite(geometrie.height) &&
    geometrie.x >= 0 &&
    geometrie.y >= 0 &&
    geometrie.width > 0 &&
    geometrie.height > 0 &&
    geometrie.x + geometrie.width <= 1.0000001 &&
    geometrie.y + geometrie.height <= 1.0000001
  );
}
