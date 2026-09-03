import { describe, expect, it } from "vitest";
import {
  IOR,
  abbeSpread,
  dispersedIor,
  fresnelSchlick,
  iorToEta,
  refract,
  refractOffsetPx,
  schlickF0,
  type Vec3,
} from "../src/optics";

const N: Vec3 = [0, 0, 1];

describe("refract", () => {
  it("leaves a ray parallel to the normal unbent", () => {
    const r = refract([0, 0, -1], N, iorToEta(IOR.air, IOR.crownGlass));
    expect(r[0]).toBeCloseTo(0, 12);
    expect(r[1]).toBeCloseTo(0, 12);
    expect(r[2]).toBeCloseTo(-1, 12);
  });

  it("satisfies Snell's law: sin(t) = eta * sin(i)", () => {
    const a = Math.PI / 6; // 30 degrees
    const i: Vec3 = [Math.sin(a), 0, -Math.cos(a)];
    const eta = iorToEta(IOR.air, IOR.crownGlass);
    const r = refract(i, N, eta);
    const sinT = Math.hypot(r[0], r[1]);
    expect(sinT).toBeCloseTo(eta * Math.sin(a), 10);
  });

  it("returns the zero vector past the critical angle", () => {
    const a = Math.PI / 4;
    const i: Vec3 = [Math.sin(a), 0, -Math.cos(a)];
    const r = refract(i, N, iorToEta(IOR.crownGlass, IOR.air)); // glass -> air
    expect(r).toEqual([0, 0, 0]);
  });
});

describe("refractOffsetPx", () => {
  const tilted: Vec3 = [0.6, 0, 0.8]; // a typical normal off the bevel

  it("has zero offset on a flat surface", () => {
    const off = refractOffsetPx([0, 0, 1], iorToEta(1, IOR.crownGlass), 90);
    expect(Math.hypot(off[0], off[1])).toBeCloseTo(0, 10);
  });

  it("grows the offset as the IOR grows", () => {
    const water = refractOffsetPx(tilted, iorToEta(1, IOR.water), 90);
    const glass = refractOffsetPx(tilted, iorToEta(1, IOR.crownGlass), 90);
    const diamond = refractOffsetPx(tilted, iorToEta(1, IOR.diamond), 90);
    const mag = (v: readonly [number, number]) => Math.hypot(v[0], v[1]);
    expect(mag(water)).toBeLessThan(mag(glass));
    expect(mag(glass)).toBeLessThan(mag(diamond));
  });

  it("grows the offset linearly with the glass thickness", () => {
    const a = refractOffsetPx(tilted, iorToEta(1, IOR.crownGlass), 45);
    const b = refractOffsetPx(tilted, iorToEta(1, IOR.crownGlass), 90);
    expect(b[0]).toBeCloseTo(a[0] * 2, 10);
  });

  it("bends the blue channel more than the red one", () => {
    const red = refractOffsetPx(tilted, iorToEta(1, 1.5168 - 0.0081 / 2), 90);
    const blue = refractOffsetPx(tilted, iorToEta(1, 1.5168 + 0.0081 / 2), 90);
    expect(Math.hypot(blue[0], blue[1])).toBeGreaterThan(
      Math.hypot(red[0], red[1]),
    );
  });
});

describe("material constants", () => {
  it("puts normal-incidence reflection at about 4% for the air-glass interface", () => {
    expect(schlickF0(IOR.air, IOR.crownGlass)).toBeCloseTo(0.0426, 4);
  });

  it("puts BK7's Abbe spread at around eight thousandths", () => {
    expect(abbeSpread(1.5168, 64.17)).toBeCloseTo(0.00805, 5);
  });

  it("drives Fresnel to one at the grazing angle", () => {
    expect(fresnelSchlick(1, 0.04)).toBeCloseTo(0.04, 6);
    expect(fresnelSchlick(0, 0.04)).toBeCloseTo(1, 6);
  });
});

describe("edge cases", () => {
  it("does not mutate the input vectors of refract", () => {
    const i: Vec3 = [0.3, 0.2, -0.9327379053088815];
    const n: Vec3 = [0, 0, 1];
    refract(i, n, 0.658);
    expect(i).toEqual([0.3, 0.2, -0.9327379053088815]);
    expect(n).toEqual([0, 0, 1]);
  });

  it("has zero offset on total internal reflection", () => {
    // A normal near the grazing angle in the glass -> air direction: refract() dies.
    const grazing: Vec3 = [0.99, 0, Math.sqrt(1 - 0.99 * 0.99)];
    const off = refractOffsetPx(grazing, iorToEta(IOR.crownGlass, IOR.air), 90);
    expect(off).toEqual([0, 0]);
  });

  it("gives 1/n from air to glass", () => {
    expect(iorToEta(1, 1.5)).toBeCloseTo(2 / 3, 12);
    expect(iorToEta(1.5, 1)).toBeCloseTo(1.5, 12);
  });

  it("puts the blue end above the red end", () => {
    const red = dispersedIor(1.5168, 0.008, 0);
    const blue = dispersedIor(1.5168, 0.008, 1);
    expect(red).toBeLessThan(blue);
    expect(blue - red).toBeCloseTo(0.008, 12);
    expect(dispersedIor(1.5168, 0.008, 0.5)).toBeCloseTo(1.5168, 12);
  });

  it("keeps Fresnel inside the [f0, 1] range", () => {
    for (let i = 0; i <= 20; i++) {
      const f = fresnelSchlick(i / 20, 0.0426);
      expect(f).toBeGreaterThanOrEqual(0.0426 - 1e-12);
      expect(f).toBeLessThanOrEqual(1 + 1e-12);
    }
  });
});
