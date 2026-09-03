import { describe, expect, it } from "vitest";
import { glassHeight, glassNormal, sdRoundedBox } from "../src/sdf2d";

describe("sdRoundedBox", () => {
  const half = [100, 60] as const;

  it("gives the distance to the nearest edge as negative at the center", () => {
    expect(sdRoundedBox([0, 0], half, 20)).toBeCloseTo(-60, 10);
  });

  it("is zero on the edge", () => {
    expect(sdRoundedBox([100, 0], half, 20)).toBeCloseTo(0, 10);
    expect(sdRoundedBox([0, 60], half, 20)).toBeCloseTo(0, 10);
  });

  it("pulls the corner inward by the corner radius", () => {
    expect(sdRoundedBox([100, 60], half, 20)).toBeCloseTo(
      20 * Math.SQRT2 - 20,
      10,
    );
  });
});

describe("glassHeight", () => {
  it("is 0 at the edge and 1 where the bevel ends", () => {
    expect(glassHeight(0, 34)).toBeCloseTo(0, 12);
    expect(glassHeight(-34, 34)).toBeCloseTo(1, 12);
    expect(glassHeight(-200, 34)).toBeCloseTo(1, 12);
  });

  it("stays zero outside the panel", () => {
    expect(glassHeight(12, 34)).toBeCloseTo(0, 12);
  });

  it("increases monotonically inward", () => {
    let previous = glassHeight(0, 34);
    for (let d = -1; d >= -34; d--) {
      const current = glassHeight(d, 34);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
  });
});

describe("glassNormal", () => {
  const half = [210, 130] as const;

  it("is flat in the middle of the plateau", () => {
    const n = glassNormal([0, 0], half, 40, 34, 6, 1);
    expect(n[0]).toBeCloseTo(0, 8);
    expect(n[1]).toBeCloseTo(0, 8);
    expect(n[2]).toBeCloseTo(1, 8);
  });

  it("tilts outward on the bevel and stays symmetric", () => {
    const right = glassNormal([200, 0], half, 40, 34, 6, 1);
    const left = glassNormal([-200, 0], half, 40, 34, 6, 1);
    expect(right[0]).toBeGreaterThan(0.15);
    expect(left[0]).toBeCloseTo(-right[0], 8);
  });

  it("tilts more as the thickness grows", () => {
    const thin = glassNormal([200, 0], half, 40, 34, 3, 1);
    const thick = glassNormal([200, 0], half, 40, 34, 12, 1);
    expect(thick[0]).toBeGreaterThan(thin[0]);
  });
});

describe("shape edge cases", () => {
  const half = [210, 130] as const;

  it("turns sdRoundedBox into a sharp box when the radius is zero", () => {
    const box = [100, 60] as const;
    expect(sdRoundedBox([100, 60], box, 0)).toBeCloseTo(0, 10);
    expect(sdRoundedBox([103, 64], box, 0)).toBeCloseTo(5, 10);
    expect(sdRoundedBox([0, 0], box, 0)).toBeCloseTo(-60, 10);
  });

  it("always returns a unit-length normal", () => {
    for (const p of [
      [0, 0],
      [200, 0],
      [0, 125],
      [205, 127],
      [400, 0],
      [-208, -128],
    ] as const) {
      const n = glassNormal(p, half, 40, 34, 6, 1);
      expect(Math.hypot(n[0], n[1], n[2])).toBeCloseTo(1, 12);
    }
  });

  it("keeps the normal flat outside the panel", () => {
    const n = glassNormal([400, 0], half, 40, 34, 6, 1);
    expect(n[0]).toBeCloseTo(0, 12);
    expect(n[1]).toBeCloseTo(0, 12);
    expect(n[2]).toBeCloseTo(1, 12);
  });
});
