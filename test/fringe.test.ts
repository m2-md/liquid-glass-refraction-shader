import { describe, expect, it } from "vitest";
import { FRINGE_SCALE_PX, maxFringePx } from "../src/fringe";

describe("maxFringePx", () => {
  it("boş tamponda sıfır", () => {
    expect(maxFringePx(new Uint8Array(0))).toBe(0);
  });

  it("255 tam ölçeğe karşılık gelir", () => {
    expect(maxFringePx(new Uint8Array([255, 0, 0, 255]))).toBe(FRINGE_SCALE_PX);
  });

  it("yalnızca R kanalını okur", () => {
    // G ve B tavana dayalı ama R sıfır: sonuç sıfır olmalı.
    const pixels = new Uint8Array([0, 255, 255, 255, 0, 200, 40, 255]);
    expect(maxFringePx(pixels)).toBe(0);
  });

  it("en büyük R değerini alır", () => {
    const pixels = new Uint8Array([
      10, 0, 0, 255, 200, 0, 0, 255, 5, 0, 0, 255,
    ]);
    expect(maxFringePx(pixels)).toBeCloseTo((200 / 255) * 32, 12);
  });

  it("özel ölçekle çarpılır", () => {
    expect(maxFringePx(new Uint8Array([255, 0, 0, 255]), 8)).toBe(8);
  });

  it("kuantizasyon adımı ölçek/255", () => {
    expect(maxFringePx(new Uint8Array([1, 0, 0, 255]))).toBeCloseTo(
      FRINGE_SCALE_PX / 255,
      12,
    );
  });
});
