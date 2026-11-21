import { describe, expect, it } from "vitest";
import {
  gueltig,
  markerGeometrieAusPunkten,
  rundeKoordinate,
  textGeometrieAusPunkten,
} from "./geometrie";

describe("Anmerkungs-Geometrie und Touch-Gesten", () => {
  it("rundet Koordinaten auf vier Nachkommastellen", () => {
    expect(rundeKoordinate(0.45961002785515315)).toBe(0.4596);
    expect(rundeKoordinate(-0.2)).toBe(0);
    expect(rundeKoordinate(1.4)).toBe(1);
  });

  it("erhält beim Aufziehen eines 2D-Marker-Rechtecks die exakten Maße", () => {
    const rechteck = markerGeometrieAusPunkten(
      { x: 0.2, y: 0.2 },
      { x: 0.4, y: 0.4 },
    );
    expect(rechteck).toEqual({ x: 0.2, y: 0.2, width: 0.2, height: 0.2 });
    expect(gueltig(rechteck)).toBe(true);
  });

  it("erzeugt bei waagerechtem Fingerwischen einen Textmarker-Streifen", () => {
    const streifen = markerGeometrieAusPunkten(
      { x: 0.15, y: 0.5 },
      { x: 0.65, y: 0.502 },
    );
    expect(streifen.x).toBe(0.15);
    expect(streifen.width).toBe(0.5);
    expect(streifen.height).toBe(0.035);
    expect(streifen.y).toBeCloseTo(0.4835, 3);
    expect(gueltig(streifen)).toBe(true);
  });

  it("erzeugt bei kurzem Antippen im Marker-Modus eine Akkordmarkierung im Seitenbereich", () => {
    const mitte = markerGeometrieAusPunkten(
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
    );
    expect(mitte).toEqual({ x: 0.44, y: 0.48, width: 0.12, height: 0.04 });

    const rand = markerGeometrieAusPunkten(
      { x: 0.98, y: 0.99 },
      { x: 0.98, y: 0.99 },
    );
    expect(rand).toEqual({ x: 0.88, y: 0.96, width: 0.12, height: 0.04 });
    expect(gueltig(rand)).toBe(true);
  });

  it("hält Textboxen beim Antippen am rechten oder unteren Seitenrand vollständig im Blatt", () => {
    const box = textGeometrieAusPunkten(
      { x: 0.95, y: 0.98 },
      { x: 0.95, y: 0.98 },
    );
    expect(box).toEqual({ x: 0.72, y: 0.93, width: 0.28, height: 0.07 });
    expect(gueltig(box)).toBe(true);
  });
});
