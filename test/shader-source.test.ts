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

describe("shader kaynakları", () => {
  it("#version 300 es her dosyanın İLK satırı", () => {
    for (const [name, source] of sources) {
      expect(`${name}: ${source.split("\n")[0]}`).toBe(
        `${name}: #version 300 es`,
      );
    }
  });

  it("hiçbiri boş değil", () => {
    for (const [, source] of sources) {
      expect(source.length).toBeGreaterThan(100);
    }
  });
});

describe("glass.frag sabitleri", () => {
  it("FRINGE_SCALE, fringe.ts'teki FRINGE_SCALE_PX ile aynı", () => {
    const match = /#define\s+FRINGE_SCALE\s+([0-9.]+)/.exec(glassFrag);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBe(FRINGE_SCALE_PX);
  });

  it("MAX_SAMPLES tanımlı ve döngü tavanı ile aynı", () => {
    const match = /#define\s+MAX_SAMPLES\s+(\d+)/.exec(glassFrag);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBe(8);
    expect(glassFrag).toContain("for (int i = 0; i < MAX_SAMPLES; i++)");
  });

  it("üç görüntü modu da tanımlı", () => {
    for (const mode of ["MODE_GLASS 0", "MODE_NORMAL 1", "MODE_FRINGE 2"]) {
      expect(glassFrag).toContain(`#define ${mode}`);
    }
  });

  it("sdf2d.ts'teki üç fonksiyonun GLSL ikizi de burada", () => {
    expect(glassFrag).toContain("float sdRoundedBox(vec2 p, vec2 b, float r)");
    expect(glassFrag).toContain("float glassHeight(float d, float w)");
    expect(glassFrag).toContain("vec3 glassNormal(");
  });
});

describe("vertex shader'ları attribute kullanmıyor", () => {
  it("panel ve blit yalnızca gl_VertexID okuyor", () => {
    for (const source of [blitVert, panelVert]) {
      expect(source).toContain("gl_VertexID");
      expect(source).not.toContain("in vec");
    }
  });
});
