import { describe, expect, it } from "vitest";
import { MAX_PIXELS, backingSize, fitPixelBudget } from "../src/viewport";

describe("backingSize", () => {
  it("clamps devicePixelRatio at 2", () => {
    expect(backingSize(960, 540, 3, 1)).toEqual({ width: 1920, height: 1080 });
  });

  it("does not let dpr fall below 1", () => {
    expect(backingSize(960, 540, 0.5, 1)).toEqual({ width: 960, height: 540 });
  });

  it("shrinks the backing buffer by the scale", () => {
    expect(backingSize(960, 540, 1, 0.5)).toEqual({ width: 480, height: 270 });
  });

  it("does not let the scale fall below 0.25", () => {
    expect(backingSize(960, 540, 1, 0.05)).toEqual({ width: 240, height: 135 });
  });

  it("always returns integers of at least 1", () => {
    const size = backingSize(3, 2, 1, 0.25);
    expect(Number.isInteger(size.width)).toBe(true);
    expect(Number.isInteger(size.height)).toBe(true);
    expect(size.width).toBeGreaterThanOrEqual(1);
    expect(size.height).toBeGreaterThanOrEqual(1);
  });

  it("applies the pixel budget after the dpr clamp too", () => {
    const size = backingSize(2560, 1440, 2, 1);
    expect(size.width * size.height).toBeLessThanOrEqual(MAX_PIXELS);
  });
});

describe("fitPixelBudget", () => {
  it("leaves a size under budget untouched", () => {
    expect(fitPixelBudget(960, 540)).toEqual({ width: 960, height: 540 });
  });

  it("shrinks a size that exceeds the budget", () => {
    const size = fitPixelBudget(4000, 2000, 1_000_000);
    expect(size.width * size.height).toBeLessThanOrEqual(1_000_000);
  });

  it("preserves the aspect ratio to within 1 percent", () => {
    const source = 4000 / 2250;
    const size = fitPixelBudget(4000, 2250, 1_000_000);
    expect(Math.abs(size.width / size.height / source - 1)).toBeLessThan(0.01);
  });
});
