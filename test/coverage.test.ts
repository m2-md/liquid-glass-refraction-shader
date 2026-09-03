import { describe, expect, it } from "vitest";
import { coveragePct, roundedRectArea } from "../src/coverage";

describe("roundedRectArea", () => {
  it("yarıçap sıfırken dikdörtgen alanı", () => {
    expect(roundedRectArea(100, 100, 0)).toBe(10000);
  });

  it("yarıçap yarım kenarken daire alanı", () => {
    expect(roundedRectArea(100, 100, 50)).toBeCloseTo(Math.PI * 50 * 50, 10);
  });

  it("yarıçap kısa kenarın yarısını aşamaz", () => {
    expect(roundedRectArea(100, 60, 90)).toBeCloseTo(
      roundedRectArea(100, 60, 30),
      10,
    );
  });

  it("negatif yarıçap sıfır sayılır", () => {
    expect(roundedRectArea(100, 100, -5)).toBe(10000);
  });
});

describe("coveragePct", () => {
  it("demonun panel/sahne oranı yüzde 20,80", () => {
    expect(coveragePct(420, 260, 40, 960, 540)).toBeCloseTo(20.8, 2);
  });

  it("sıfır ekranda sıfır döner", () => {
    expect(coveragePct(420, 260, 40, 0, 540)).toBe(0);
    expect(coveragePct(420, 260, 40, 960, 0)).toBe(0);
  });

  it("panel ekranı tamamen kaplarsa yüzde 100", () => {
    expect(coveragePct(960, 540, 0, 960, 540)).toBeCloseTo(100, 10);
  });
});
