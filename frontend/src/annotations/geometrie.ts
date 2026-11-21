import type { Geometrie } from "./annotations";

export interface Punkt {
  x: number;
  y: number;
}

export function begrenze(wert: number): number {
  return Math.min(1, Math.max(0, wert));
}

export function rundeKoordinate(wert: number): number {
  return Math.round(begrenze(wert) * 10000) / 10000;
}

export function rundeGeometrie(geometrie: Geometrie): Geometrie {
  const x = rundeKoordinate(geometrie.x);
  const y = rundeKoordinate(geometrie.y);
  const width = rundeKoordinate(Math.min(1 - x, Math.max(0.0001, geometrie.width)));
  const height = rundeKoordinate(Math.min(1 - y, Math.max(0.0001, geometrie.height)));
  return { x, y, width, height };
}

export function rechteckAusPunkten(a: Punkt, b: Punkt): Geometrie | null {
  const x = begrenze(Math.min(a.x, b.x));
  const y = begrenze(Math.min(a.y, b.y));
  const width = begrenze(Math.max(a.x, b.x)) - x;
  const height = begrenze(Math.max(a.y, b.y)) - y;
  if (width <= 0.001 || height <= 0.001) {
    return null;
  }
  return rundeGeometrie({ x, y, width, height });
}

export function markerGeometrieAusPunkten(a: Punkt, b: Punkt): Geometrie {
  const minX = begrenze(Math.min(a.x, b.x));
  const maxX = begrenze(Math.max(a.x, b.x));
  const minY = begrenze(Math.min(a.y, b.y));
  const maxY = begrenze(Math.max(a.y, b.y));
  const rohBreite = maxX - minX;
  const rohHoehe = maxY - minY;
  const mitteX = (minX + maxX) / 2;
  const mitteY = (minY + maxY) / 2;

  if (rohBreite >= 0.02 && rohHoehe >= 0.02) {
    return rundeGeometrie({ x: minX, y: minY, width: rohBreite, height: rohHoehe });
  }
  if (rohBreite >= 0.02) {
    const height = 0.035;
    const y = Math.min(1 - height, Math.max(0, mitteY - height / 2));
    return rundeGeometrie({ x: minX, y, width: rohBreite, height });
  }
  if (rohHoehe >= 0.02) {
    const width = 0.035;
    const x = Math.min(1 - width, Math.max(0, mitteX - width / 2));
    return rundeGeometrie({ x, y: minY, width, height: rohHoehe });
  }
  const width = 0.12;
  const height = 0.04;
  const x = Math.min(1 - width, Math.max(0, mitteX - width / 2));
  const y = Math.min(1 - height, Math.max(0, mitteY - height / 2));
  return rundeGeometrie({ x, y, width, height });
}

export function textGeometrieAusPunkten(a: Punkt, b: Punkt): Geometrie {
  const minX = begrenze(Math.min(a.x, b.x));
  const maxX = begrenze(Math.max(a.x, b.x));
  const minY = begrenze(Math.min(a.y, b.y));
  const maxY = begrenze(Math.max(a.y, b.y));
  const rohBreite = maxX - minX;
  const rohHoehe = maxY - minY;

  if (rohBreite >= 0.02 || rohHoehe >= 0.02) {
    const width = Math.max(0.08, rohBreite);
    const height = Math.max(0.05, rohHoehe);
    const x = Math.min(1 - width, minX);
    const y = Math.min(1 - height, minY);
    return rundeGeometrie({ x, y, width, height });
  }
  const width = 0.28;
  const height = 0.07;
  const x = Math.min(1 - width, Math.max(0, a.x));
  const y = Math.min(1 - height, Math.max(0, a.y));
  return rundeGeometrie({ x, y, width, height });
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
