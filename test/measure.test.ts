import { describe, expect, it } from "vitest";
import { frameStats, isMeasureMode, isVsyncBound } from "../src/measure";

describe("frameStats", () => {
  it("medyan, p95 ve atlanan kareyi birlikte verir", () => {
    const deltas = [16, 16, 17, 16, 60, 16, 16, 16, 16, 16];
    const stats = frameStats(deltas);
    expect(stats.frameMsMedian).toBeCloseTo(16, 12);
    expect(stats.droppedFrames).toBe(1);
    expect(stats.frameMsP95).toBeGreaterThan(stats.frameMsMedian);
  });

  it("eşiğin tam üstündeki kare atlanmış sayılmaz", () => {
    const limit = 16.67 * 1.5; // 25.005
    expect(frameStats([limit, limit, limit]).droppedFrames).toBe(0);
    expect(frameStats([limit + 0.001, limit]).droppedFrames).toBe(1);
  });

  it("vsync aralığı parametreyle değişir", () => {
    // 120 Hz: 8.33 ms periyot -> eşik 12.5 ms
    expect(frameStats([13, 13, 8], 8.33).droppedFrames).toBe(2);
    expect(frameStats([13, 13, 8]).droppedFrames).toBe(0);
  });

  it("boş dizide atlanan kare sıfır, medyan NaN", () => {
    const stats = frameStats([]);
    expect(stats.droppedFrames).toBe(0);
    expect(Number.isNaN(stats.frameMsMedian)).toBe(true);
  });
});

describe("isVsyncBound", () => {
  it("ölçülen kare periyoduna yapışan satırı işaretler", () => {
    expect(isVsyncBound(16.7, 16.67)).toBe(true);
    expect(isVsyncBound(8.4, 8.33)).toBe(true); // 120 Hz ekran
  });

  it("tavandan uzak satırları işaretlemez", () => {
    expect(isVsyncBound(33.4, 16.67)).toBe(false);
    expect(isVsyncBound(16.7, 8.33)).toBe(false);
  });

  it("60 Hz eşiği 120 Hz satırını yanlışlıkla temize çıkarmaz", () => {
    // Eski sabit aralık (15–18 ms) 8,3 ms'lik bir satırı "takılı değil" sanıyordu.
    expect(isVsyncBound(8.3, 8.33)).toBe(true);
  });

  it("NaN medyan işaretlenmez", () => {
    expect(isVsyncBound(Number.NaN, 16.67)).toBe(false);
  });
});

describe("isMeasureMode", () => {
  it("yalnızca measure=1 ile açılır", () => {
    expect(isMeasureMode("?measure=1")).toBe(true);
    expect(isMeasureMode("?measure=0")).toBe(false);
    expect(isMeasureMode("")).toBe(false);
    expect(isMeasureMode("?other=1")).toBe(false);
  });
});
