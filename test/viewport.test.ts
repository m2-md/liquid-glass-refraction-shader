import { describe, expect, it } from "vitest";
import { MAX_PIXELS, backingSize, fitPixelBudget } from "../src/viewport";

describe("backingSize", () => {
  it("devicePixelRatio 2'de kelepçelenir", () => {
    expect(backingSize(960, 540, 3, 1)).toEqual({ width: 1920, height: 1080 });
  });

  it("dpr 1'in altına düşemez", () => {
    expect(backingSize(960, 540, 0.5, 1)).toEqual({ width: 960, height: 540 });
  });

  it("ölçek arka tamponu küçültür", () => {
    expect(backingSize(960, 540, 1, 0.5)).toEqual({ width: 480, height: 270 });
  });

  it("ölçek 0.25'in altına inemez", () => {
    expect(backingSize(960, 540, 1, 0.05)).toEqual({ width: 240, height: 135 });
  });

  it("sonuç her zaman tam sayı ve en az 1", () => {
    const size = backingSize(3, 2, 1, 0.25);
    expect(Number.isInteger(size.width)).toBe(true);
    expect(Number.isInteger(size.height)).toBe(true);
    expect(size.width).toBeGreaterThanOrEqual(1);
    expect(size.height).toBeGreaterThanOrEqual(1);
  });

  it("piksel bütçesi dpr kelepçesinden sonra da uygulanır", () => {
    const size = backingSize(2560, 1440, 2, 1);
    expect(size.width * size.height).toBeLessThanOrEqual(MAX_PIXELS);
  });
});

describe("fitPixelBudget", () => {
  it("bütçenin altındaki boyutu değiştirmez", () => {
    expect(fitPixelBudget(960, 540)).toEqual({ width: 960, height: 540 });
  });

  it("bütçeyi aşan boyutu küçültür", () => {
    const size = fitPixelBudget(4000, 2000, 1_000_000);
    expect(size.width * size.height).toBeLessThanOrEqual(1_000_000);
  });

  it("en-boy oranını yüzde 1 içinde korur", () => {
    const source = 4000 / 2250;
    const size = fitPixelBudget(4000, 2250, 1_000_000);
    expect(Math.abs(size.width / size.height / source - 1)).toBeLessThan(0.01);
  });
});
