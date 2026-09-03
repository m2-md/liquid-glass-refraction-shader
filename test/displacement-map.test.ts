import { describe, expect, it } from "vitest";
import { buildDisplacementRGBA } from "../src/displacement-map";

const small = { width: 64, height: 40, radius: 10, bevel: 8, thickness: 6 };
const panel = { width: 420, height: 260, radius: 40, bevel: 34, thickness: 6 };

describe("buildDisplacementRGBA", () => {
  it("encodes the center pixel as neutral (0.5, 0.5)", () => {
    const shape = { width: 64, height: 40, radius: 10, bevel: 8, thickness: 6 };
    const data = buildDisplacementRGBA(shape);
    const i = ((shape.height / 2) * shape.width + shape.width / 2) * 4;
    expect(data[i]).toBe(128);
    expect(data[i + 1]).toBe(128);
  });

  it("produces four bytes per pixel", () => {
    const data = buildDisplacementRGBA(small);
    expect(data.length).toBe(small.width * small.height * 4);
  });

  it("keeps alpha at 255 and the blue channel at 0", () => {
    const data = buildDisplacementRGBA(small);
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i + 2]).toBe(0);
      expect(data[i + 3]).toBe(255);
    }
  });

  it("is symmetric around 128 on the x axis", () => {
    const data = buildDisplacementRGBA(panel);
    const y = 130;
    for (const x of [4, 40, 120, 209]) {
      const a = data[(y * panel.width + x) * 4];
      const b = data[(y * panel.width + (panel.width - 1 - x)) * 4];
      // Rounding can drift by one unit on either side of 128.
      expect(Math.abs(a - 128 + (b - 128))).toBeLessThanOrEqual(1);
    }
  });

  it("points the displacement inward on the bevel", () => {
    // The refracted sample moves inward: on the right bevel the x offset is negative,
    // on the bottom bevel the y offset is negative (upward in SVG's y-down frame).
    const data = buildDisplacementRGBA(panel);
    const right = (130 * panel.width + 410) * 4;
    const bottom = (250 * panel.width + 210) * 4;
    expect(data[right]).toBeLessThan(128);
    expect(data[bottom + 1]).toBeLessThan(128);
  });

  it("is neutral on the plateau and not neutral on the bevel", () => {
    const data = buildDisplacementRGBA(panel);
    const plateau = (130 * panel.width + 210) * 4;
    const bevel = (130 * panel.width + 405) * 4;
    expect(data[plateau]).toBe(128);
    expect(Math.abs(data[bevel] - 128)).toBeGreaterThan(4);
  });
});
