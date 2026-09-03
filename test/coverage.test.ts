import { describe, expect, it } from "vitest";
import { coveragePct, roundedRectArea } from "../src/coverage";

describe("roundedRectArea", () => {
  it("is the plain rectangle area when the radius is zero", () => {
    expect(roundedRectArea(100, 100, 0)).toBe(10000);
  });

  it("is the circle area when the radius is half the side", () => {
    expect(roundedRectArea(100, 100, 50)).toBeCloseTo(Math.PI * 50 * 50, 10);
  });

  it("clamps the radius to half of the shorter side", () => {
    expect(roundedRectArea(100, 60, 90)).toBeCloseTo(
      roundedRectArea(100, 60, 30),
      10,
    );
  });

  it("treats a negative radius as zero", () => {
    expect(roundedRectArea(100, 100, -5)).toBe(10000);
  });
});

describe("coveragePct", () => {
  it("puts the demo panel/stage ratio at 20.80 percent", () => {
    expect(coveragePct(420, 260, 40, 960, 540)).toBeCloseTo(20.8, 2);
  });

  it("returns zero for a zero-sized screen", () => {
    expect(coveragePct(420, 260, 40, 0, 540)).toBe(0);
    expect(coveragePct(420, 260, 40, 960, 0)).toBe(0);
  });

  it("is 100 percent when the panel covers the whole screen", () => {
    expect(coveragePct(960, 540, 0, 960, 540)).toBeCloseTo(100, 10);
  });
});
