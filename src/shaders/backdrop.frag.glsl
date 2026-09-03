#version 300 es
precision highp float;

// Camın arkasında duran desen. Kırılma "taşıma" olduğu için desenin kenarları
// KESKİN olmak zorunda: yumuşak bir gradyanda pikselin yer değiştirdiğini gözle
// göremezsiniz. Bu yüzden her katman step() ile eşikleniyor.

uniform vec2 uResolution;
uniform float uTime;

out vec4 outColor;

const vec3 PAPER = vec3(0.86, 0.89, 0.94);
const vec3 INK = vec3(0.05, 0.06, 0.09);
const vec3 WARM = vec3(0.98, 0.60, 0.22);
const vec3 COOL = vec3(0.24, 0.70, 0.96);

void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 uv = px / uResolution;

  // 1) yatay bantlar — dikey kaymayı okunur kılar
  float band = step(0.5, fract(px.y / 18.0));

  // 2) nokta ızgarası — yatay kaymayı okunur kılar
  vec2 cell = fract(px / 48.0) - 0.5;
  float dots = 1.0 - step(0.16, length(cell));

  // 3) kayan diyagonal — sahne durağan kalmasın
  float diag = step(0.62, fract((px.x + px.y) / 96.0 - uTime * 0.12));

  vec3 col = mix(PAPER, INK, band * 0.6);
  col = mix(col, WARM, diag * 0.55);
  col = mix(col, COOL, dots);
  col *= 0.84 + 0.16 * uv.y;

  outColor = vec4(col, 1.0);
}
