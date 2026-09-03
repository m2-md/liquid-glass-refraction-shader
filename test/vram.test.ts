import { describe, expect, it } from "vitest";
import { backdropBytes } from "../src/vram";

describe("backdropBytes", () => {
  it("keeps a single target at full scale", () => {
    expect(backdropBytes(960, 540, 1)).toEqual({
      capture: 2_073_600,
      sample: 0,
      total: 2_073_600,
    });
  });

  it("adds a second target at half scale", () => {
    expect(backdropBytes(960, 540, 0.5)).toEqual({
      capture: 2_073_600,
      sample: 518_400,
      total: 2_592_000,
    });
  });

  it("makes the total 1.0625x the capture at quarter scale", () => {
    const { capture, total } = backdropBytes(960, 540, 0.25);
    expect(total / capture).toBeCloseTo(1.0625, 10);
  });

  it("creates no second target when the scale is above 1", () => {
    expect(backdropBytes(960, 540, 2).sample).toBe(0);
  });

  it("keeps at least a 1x1 target even at a very small scale", () => {
    expect(backdropBytes(4, 4, 0.01).sample).toBe(4);
  });
});
