import { describe, expect, it } from "vitest";
import { median, percentile } from "../src/stats";

describe("percentile", () => {
  it("boş dizide NaN döner", () => {
    expect(Number.isNaN(percentile([], 50))).toBe(true);
    expect(Number.isNaN(median([]))).toBe(true);
  });

  it("0 minimumu, 100 maksimumu verir", () => {
    const v = [8, 1, 5, 3];
    expect(percentile(v, 0)).toBe(1);
    expect(percentile(v, 100)).toBe(8);
  });

  it("p aralık dışına taşarsa kelepçelenir", () => {
    const v = [8, 1, 5, 3];
    expect(percentile(v, -20)).toBe(1);
    expect(percentile(v, 140)).toBe(8);
  });

  it("p95 doğrusal interpolasyonu elle doğrulanır", () => {
    // 11 eleman -> rank = 0.95 * 10 = 9.5 -> sorted[9] ile sorted[10] ortası
    const v = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(v, 95)).toBeCloseTo(9.5, 12);
  });

  it("girdi dizisini mutasyona uğratmaz", () => {
    const v = [3, 1, 2];
    percentile(v, 50);
    expect(v).toEqual([3, 1, 2]);
  });
});

describe("median", () => {
  it("tek uzunlukta ortadaki elemanı verir", () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it("çift uzunlukta iki ortancanın ortasını verir", () => {
    expect(median([1, 2, 3, 4])).toBeCloseTo(2.5, 12);
  });

  it("tek elemanlı dizide o elemanı verir", () => {
    expect(median([42])).toBe(42);
  });
});
