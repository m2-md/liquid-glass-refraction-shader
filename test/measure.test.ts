import { describe, expect, it } from "vitest";
import { frameStats, isMeasureMode, isVsyncBound } from "../src/measure";

describe("frameStats", () => {
  it("returns the median, the p95 and the dropped frames together", () => {
    const deltas = [16, 16, 17, 16, 60, 16, 16, 16, 16, 16];
    const stats = frameStats(deltas);
    expect(stats.frameMsMedian).toBeCloseTo(16, 12);
    expect(stats.droppedFrames).toBe(1);
    expect(stats.frameMsP95).toBeGreaterThan(stats.frameMsMedian);
  });

  it("does not count a frame exactly at the threshold as dropped", () => {
    const limit = 16.67 * 1.5; // 25.005
    expect(frameStats([limit, limit, limit]).droppedFrames).toBe(0);
    expect(frameStats([limit + 0.001, limit]).droppedFrames).toBe(1);
  });

  it("takes the vsync interval as a parameter", () => {
    // 120 Hz: 8.33 ms period -> threshold 12.5 ms
    expect(frameStats([13, 13, 8], 8.33).droppedFrames).toBe(2);
    expect(frameStats([13, 13, 8]).droppedFrames).toBe(0);
  });

  it("reports zero dropped frames and a NaN median for an empty array", () => {
    const stats = frameStats([]);
    expect(stats.droppedFrames).toBe(0);
    expect(Number.isNaN(stats.frameMsMedian)).toBe(true);
  });
});

describe("isVsyncBound", () => {
  it("flags a row stuck to the measured frame period", () => {
    expect(isVsyncBound(16.7, 16.67)).toBe(true);
    expect(isVsyncBound(8.4, 8.33)).toBe(true); // 120 Hz display
  });

  it("does not flag rows far from the ceiling", () => {
    expect(isVsyncBound(33.4, 16.67)).toBe(false);
    expect(isVsyncBound(16.7, 8.33)).toBe(false);
  });

  it("does not wrongly clear a 120 Hz row with a 60 Hz threshold", () => {
    // The old fixed range (15-18 ms) thought an 8.3 ms row was "not bound".
    expect(isVsyncBound(8.3, 8.33)).toBe(true);
  });

  it("does not flag a NaN median", () => {
    expect(isVsyncBound(Number.NaN, 16.67)).toBe(false);
  });
});

describe("isMeasureMode", () => {
  it("turns on only with measure=1", () => {
    expect(isMeasureMode("?measure=1")).toBe(true);
    expect(isMeasureMode("?measure=0")).toBe(false);
    expect(isMeasureMode("")).toBe(false);
    expect(isMeasureMode("?other=1")).toBe(false);
  });
});
