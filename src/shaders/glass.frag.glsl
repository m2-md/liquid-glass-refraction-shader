#version 300 es
precision highp float;
precision highp int;

#define MAX_SAMPLES 8
#define MODE_GLASS 0
#define MODE_NORMAL 1
#define MODE_FRINGE 2
// Saçak kodlamasının tavanı (piksel). fringe.ts'teki FRINGE_SCALE_PX ile AYNI.
#define FRINGE_SCALE 32.0

// Panel geometrisi ve malzeme. Arka plan örneklemesinin uniform'ları
// sampleBackdrop'un hemen üstünde bildiriliyor.
uniform vec2 uPanelCenter;
uniform vec2 uPanelHalf;
uniform float uRadius;
uniform float uBevel;
uniform float uThickness;
uniform float uNormalEps;
uniform float uDepth;
uniform float uIor;
uniform float uSpread;
uniform int uSamples;
uniform int uMode;
uniform float uF0;
uniform float uSpecular;
uniform vec3 uTint;

out vec4 outColor;

// p: panel merkezine göre piksel koordinatı
// b: yarı boyut (piksel), r: köşe yarıçapı (piksel)
float sdRoundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

// d: kenara işaretli mesafe (içeride negatif), w: pah genişliği (piksel)
// Kenarda 0, pahın bittiği yerde 1 döner.
float glassHeight(float d, float w) {
  float x = clamp(-d / max(w, 1e-3), 0.0, 1.0);
  float t = 1.0 - x;
  return sqrt(max(1.0 - t * t, 0.0));
}

vec3 glassNormal(
  vec2 p, vec2 halfSize, float radius, float bevel, float thickness, float eps
) {
  vec2 e = vec2(eps, 0.0);
  float hx =
      glassHeight(sdRoundedBox(p + e.xy, halfSize, radius), bevel)
    - glassHeight(sdRoundedBox(p - e.xy, halfSize, radius), bevel);
  float hy =
      glassHeight(sdRoundedBox(p + e.yx, halfSize, radius), bevel)
    - glassHeight(sdRoundedBox(p - e.yx, halfSize, radius), bevel);

  float k = thickness / (2.0 * eps);
  return normalize(vec3(-hx * k, -hy * k, 1.0));
}

// n: yüzey normali, eta: n1/n2, depth: cam kalınlığı (piksel)
// Dönen değer arka plan dokusunda kaç piksel yana kayacağımız.
vec2 refractOffset(vec3 n, float eta, float depth) {
  vec3 i = vec3(0.0, 0.0, -1.0); // ortografik bakış: ekrana dik giriyoruz
  vec3 r = refract(i, n, eta);
  if (dot(r, r) < 0.5) return vec2(0.0); // tam iç yansıma
  return r.xy * (depth / max(abs(r.z), 1e-3));
}

uniform sampler2D uBackdrop;
uniform vec2 uResolution;
uniform vec2 uHalfTexel;

vec3 sampleBackdrop(vec2 fragPx) {
  vec2 uv = fragPx / uResolution;
  // Yarım texel içeri kırp: kenarda LINEAR filtrenin doku dışına uzanmasını engeller.
  return texture(uBackdrop, clamp(uv, uHalfTexel, 1.0 - uHalfTexel)).rgb;
}

// Schlick yaklaşığı — optics.ts'teki fresnelSchlick ile aynı formül.
float fresnelSchlick(float cosTheta, float f0) {
  float c = clamp(1.0 - cosTheta, 0.0, 1.0);
  return f0 + (1.0 - f0) * pow(c, 5.0);
}

// t: 0 kırmızı ucu, 1 mavi ucu. Üç tepeli kaba bir spektrum ağırlığı.
vec3 spectrumWeight(float t) {
  return vec3(
    exp(-16.0 * (t - 0.15) * (t - 0.15)),
    exp(-16.0 * (t - 0.50) * (t - 0.50)),
    exp(-16.0 * (t - 0.85) * (t - 0.85))
  );
}

vec3 refractBackdrop(vec2 fragPx, vec3 n, float ior, float spread, float depth) {
  if (uSamples <= 1) {
    return sampleBackdrop(fragPx + refractOffset(n, 1.0 / ior, depth));
  }

  vec3 sum = vec3(0.0);
  vec3 wsum = vec3(0.0);
  for (int i = 0; i < MAX_SAMPLES; i++) {
    if (i >= uSamples) break;
    float t = float(i) / float(uSamples - 1);
    float ni = ior + spread * (t - 0.5);      // mavi uç daha yüksek indis
    vec2 off = refractOffset(n, 1.0 / ni, depth);
    vec3 w = spectrumWeight(t);
    sum += sampleBackdrop(fragPx + off) * w;
    wsum += w;
  }
  // Her kanal kendi ağırlık toplamına bölünüyor: beyaz beyaz kalıyor.
  return sum / max(wsum, vec3(1e-4));
}

void main() {
  vec2 p = gl_FragCoord.xy - uPanelCenter;
  float d = sdRoundedBox(p, uPanelHalf, uRadius);
  float alpha = 1.0 - smoothstep(-1.0, 1.0, d); // 2 piksellik yumuşak kenar
  if (alpha <= 0.0) discard;

  vec3 n = glassNormal(p, uPanelHalf, uRadius, uBevel, uThickness, uNormalEps);

  if (uMode == MODE_NORMAL) {
    outColor = vec4(n * 0.5 + 0.5, alpha);
    return;
  }

  // Kanallar arası ayrımı piksel olarak FRINGE_SCALE'e göre kodla.
  if (uMode == MODE_FRINGE) {
    vec2 offR = refractOffset(n, 1.0 / (uIor - uSpread * 0.5), uDepth);
    vec2 offB = refractOffset(n, 1.0 / (uIor + uSpread * 0.5), uDepth);
    float sep = length(offR - offB);
    outColor = vec4(clamp(sep / FRINGE_SCALE, 0.0, 1.0), 0.0, 0.0, 1.0);
    return;
  }

  vec3 refr = refractBackdrop(gl_FragCoord.xy, n, uIor, uSpread, uDepth);

  vec3 view = vec3(0.0, 0.0, 1.0);
  float f = fresnelSchlick(max(dot(n, view), 0.0), uF0);
  vec3 sky = uTint * (0.55 + 0.45 * n.y); // ucuz ortam: normalden gelen gradyan
  vec3 col = mix(refr, sky, f);

  vec3 l = normalize(vec3(-0.35, 0.72, 0.60));
  float spec = pow(max(dot(reflect(-view, n), l), 0.0), 48.0);
  col += vec3(1.0, 0.98, 0.94) * spec * uSpecular;

  outColor = vec4(col, alpha);
}
