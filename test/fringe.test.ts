import { describe, expect, it } from "vitest";
import { FRINGE_SCALE_PX, maxFringePx } from "../src/fringe";

describe("maxFringePx", () => {
  it("is zero for an empty buffer", () => {
    expect(maxFringePx(new Uint8Array(0))).toBe(0);
  });

  it("maps 255 to the full scale", () => {
    expect(maxFringePx(new Uint8Array([255, 0, 0, 255]))).toBe(FRINGE_SCALE_PX);
  });

  it("reads only the R channel", () => {
    // G and B are pinned to the ceiling but R is zero: the result must be zero.
    const pixels = new Uint8Array([0, 255, 255, 255, 0, 200, 40, 255]);
    expect(maxFringePx(pixels)).toBe(0);
  });

  it("takes the largest R value", () => {
    const pixels = new Uint8Array([
      10, 0, 0, 255, 200, 0, 0, 255, 5, 0, 0, 255,
    ]);
    expect(maxFringePx(pixels)).toBeCloseTo((200 / 255) * 32, 12);
  });

  it("multiplies by a custom scale", () => {
    expect(maxFringePx(new Uint8Array([255, 0, 0, 255]), 8)).toBe(8);
  });

  it("has a quantization step of scale/255", () => {
    expect(maxFringePx(new Uint8Array([1, 0, 0, 255]))).toBeCloseTo(
      FRINGE_SCALE_PX / 255,
      12,
    );
  });
});
