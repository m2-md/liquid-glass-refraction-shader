import { describe, expect, it } from "vitest";
import backdropFrag from "../src/shaders/backdrop.frag.glsl?raw";
import blitVert from "../src/shaders/blit.vert.glsl?raw";
import glassFrag from "../src/shaders/glass.frag.glsl?raw";
import panelVert from "../src/shaders/panel.vert.glsl?raw";
import { FRINGE_SCALE_PX } from "../src/fringe";

const sources: Array<[string, string]> = [
  ["backdrop.frag", backdropFrag],
  ["blit.vert", blitVert],
  ["glass.frag", glassFrag],
  ["panel.vert", panelVert],
];

describe("shader sources", () => {
  it("has #version 300 es as the FIRST line of every file", () => {
    for (const [name, source] of sources) {
      expect(`${name}: ${source.split("\n")[0]}`).toBe(
        `${name}: #version 300 es`,
      );
    }
  });

  it("has no empty source", () => {
    for (const [, source] of sources) {
      expect(source.length).toBeGreaterThan(100);
    }
  });
});

describe("glass.frag constants", () => {
  it("keeps FRINGE_SCALE equal to FRINGE_SCALE_PX in fringe.ts", () => {
    const match = /#define\s+FRINGE_SCALE\s+([0-9.]+)/.exec(glassFrag);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBe(FRINGE_SCALE_PX);
  });

  it("defines MAX_SAMPLES and matches the loop ceiling", () => {
    const match = /#define\s+MAX_SAMPLES\s+(\d+)/.exec(glassFrag);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBe(8);
    expect(glassFrag).toContain("for (int i = 0; i < MAX_SAMPLES; i++)");
  });

  it("defines all three view modes", () => {
    for (const mode of ["MODE_GLASS 0", "MODE_NORMAL 1", "MODE_FRINGE 2"]) {
      expect(glassFrag).toContain(`#define ${mode}`);
    }
  });

  it("carries the GLSL twin of all three functions in sdf2d.ts", () => {
    expect(glassFrag).toContain("float sdRoundedBox(vec2 p, vec2 b, float r)");
    expect(glassFrag).toContain("float glassHeight(float d, float w)");
    expect(glassFrag).toContain("vec3 glassNormal(");
  });
});

describe("vertex shaders use no attributes", () => {
  it("makes panel and blit read only gl_VertexID", () => {
    for (const source of [blitVert, panelVert]) {
      expect(source).toContain("gl_VertexID");
      expect(source).not.toContain("in vec");
    }
  });
});
