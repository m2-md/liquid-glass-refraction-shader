import { describe, expect, it } from "vitest";
import { backdropBytes } from "../src/vram";

describe("backdropBytes", () => {
  it("tam ölçekte tek hedef tutulur", () => {
    expect(backdropBytes(960, 540, 1)).toEqual({
      capture: 2_073_600,
      sample: 0,
      total: 2_073_600,
    });
  });

  it("yarım ölçekte ikinci hedef eklenir", () => {
    expect(backdropBytes(960, 540, 0.5)).toEqual({
      capture: 2_073_600,
      sample: 518_400,
      total: 2_592_000,
    });
  });

  it("çeyrek ölçekte toplam capture'ın 1,0625 katı", () => {
    const { capture, total } = backdropBytes(960, 540, 0.25);
    expect(total / capture).toBeCloseTo(1.0625, 10);
  });

  it("ölçek 1'in üstündeyse ikinci hedef üretilmez", () => {
    expect(backdropBytes(960, 540, 2).sample).toBe(0);
  });

  it("çok küçük ölçekte bile en az 1x1 hedef", () => {
    expect(backdropBytes(4, 4, 0.01).sample).toBe(4);
  });
});
