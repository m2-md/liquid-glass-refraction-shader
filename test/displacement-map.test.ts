import { describe, expect, it } from "vitest";
import { buildDisplacementRGBA } from "../src/displacement-map";

const small = { width: 64, height: 40, radius: 10, bevel: 8, thickness: 6 };
const panel = { width: 420, height: 260, radius: 40, bevel: 34, thickness: 6 };

describe("buildDisplacementRGBA", () => {
  it("merkez piksel nötr kodlanır (0.5, 0.5)", () => {
    const shape = { width: 64, height: 40, radius: 10, bevel: 8, thickness: 6 };
    const data = buildDisplacementRGBA(shape);
    const i = ((shape.height / 2) * shape.width + shape.width / 2) * 4;
    expect(data[i]).toBe(128);
    expect(data[i + 1]).toBe(128);
  });

  it("piksel başına dört bayt üretir", () => {
    const data = buildDisplacementRGBA(small);
    expect(data.length).toBe(small.width * small.height * 4);
  });

  it("alfa hep 255, mavi kanal hep 0", () => {
    const data = buildDisplacementRGBA(small);
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i + 2]).toBe(0);
      expect(data[i + 3]).toBe(255);
    }
  });

  it("x ekseninde 128 etrafında simetriktir", () => {
    const data = buildDisplacementRGBA(panel);
    const y = 130;
    for (const x of [4, 40, 120, 209]) {
      const a = data[(y * panel.width + x) * 4];
      const b = data[(y * panel.width + (panel.width - 1 - x)) * 4];
      // Yuvarlama 128'in iki yanına birer birim kayabilir.
      expect(Math.abs(a - 128 + (b - 128))).toBeLessThanOrEqual(1);
    }
  });

  it("pahta kayma içeri doğrudur", () => {
    // Kırılma örneği panelin içine doğru taşıyor: sağ pahta x sapması negatif,
    // alt pahta y sapması negatif (SVG'nin y-aşağı çerçevesinde yukarı).
    const data = buildDisplacementRGBA(panel);
    const right = (130 * panel.width + 410) * 4;
    const bottom = (250 * panel.width + 210) * 4;
    expect(data[right]).toBeLessThan(128);
    expect(data[bottom + 1]).toBeLessThan(128);
  });

  it("platoda nötr, pahta nötr değil", () => {
    const data = buildDisplacementRGBA(panel);
    const plateau = (130 * panel.width + 210) * 4;
    const bevel = (130 * panel.width + 405) * 4;
    expect(data[plateau]).toBe(128);
    expect(Math.abs(data[bevel] - 128)).toBeGreaterThan(4);
  });
});
