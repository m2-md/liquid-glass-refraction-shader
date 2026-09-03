#version 300 es

uniform vec2 uResolution;
uniform vec2 uPanelCenter;
uniform vec2 uPanelHalf;
uniform float uPad; // a few pixels of overhang for the soft edge

void main() {
  // gl_VertexID: 0 -> (0,0), 1 -> (1,0), 2 -> (0,1), 3 -> (1,1)
  vec2 c = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1));
  vec2 px = uPanelCenter + (c * 2.0 - 1.0) * (uPanelHalf + uPad);
  gl_Position = vec4((px / uResolution) * 2.0 - 1.0, 0.0, 1.0);
}
