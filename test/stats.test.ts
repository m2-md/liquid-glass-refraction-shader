import { describe, expect, it } from "vitest";
import { median, percentile } from "../src/stats";

describe("percentile", () => {
  it("returns NaN for an empty array", () => {
    expect(Number.isNaN(percentile([], 50))).toBe(true);
    expect(Number.isNaN(median([]))).toBe(true);
  });

  it("gives the minimum at 0 and the maximum at 100", () => {
    const v = [8, 1, 5, 3];
    expect(percentile(v, 0)).toBe(1);
    expect(percentile(v, 100)).toBe(8);
  });

  it("clamps p when it falls outside the range", () => {
    const v = [8, 1, 5, 3];
    expect(percentile(v, -20)).toBe(1);
    expect(percentile(v, 140)).toBe(8);
  });

  it("matches a hand-checked linear interpolation at p95", () => {
    // 11 elements -> rank = 0.95 * 10 = 9.5 -> midway between sorted[9] and sorted[10]
    const v = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(v, 95)).toBeCloseTo(9.5, 12);
  });

  it("does not mutate the input array", () => {
    const v = [3, 1, 2];
    percentile(v, 50);
    expect(v).toEqual([3, 1, 2]);
  });
});

describe("median", () => {
  it("returns the middle element for an odd length", () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it("returns the midpoint of the two middles for an even length", () => {
    expect(median([1, 2, 3, 4])).toBeCloseTo(2.5, 12);
  });

  it("returns the only element of a single-element array", () => {
    expect(median([42])).toBe(42);
  });
});
