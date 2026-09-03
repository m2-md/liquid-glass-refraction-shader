// optics.ts — GLSL tarafındaki kırılma matematiğinin TypeScript ikizi.
// Saf: WebGL, DOM, zamanlayıcı yok. Testlerin tamamı buradan geçiyor.

export type Vec3 = readonly [number, number, number];

/**
 * GLSL refract(I, N, eta) ile birebir aynı davranış.
 * I: yüzeye gelen birim vektör, N: birim normal, eta: n1 / n2.
 * Tam iç yansımada sıfır vektör döner.
 */
export function refract(i: Vec3, n: Vec3, eta: number): Vec3 {
  const ni = i[0] * n[0] + i[1] * n[1] + i[2] * n[2];
  const k = 1 - eta * eta * (1 - ni * ni);
  if (k < 0) return [0, 0, 0];
  const s = eta * ni + Math.sqrt(k);
  return [eta * i[0] - s * n[0], eta * i[1] - s * n[1], eta * i[2] - s * n[2]];
}

export function refractOffsetPx(
  n: Vec3,
  eta: number,
  depthPx: number,
): readonly [number, number] {
  const r = refract([0, 0, -1], n, eta);
  if (r[0] === 0 && r[1] === 0 && r[2] === 0) return [0, 0];
  const rz = Math.max(Math.abs(r[2]), 1e-3);
  return [(r[0] * depthPx) / rz, (r[1] * depthPx) / rz];
}

export const IOR = {
  air: 1.0,
  water: 1.333,
  acrylic: 1.49,
  crownGlass: 1.52,
  sapphire: 1.77,
  diamond: 2.417,
} as const;

export function iorToEta(from: number, to: number): number {
  return from / to;
}

/**
 * Abbe sayısı: V = (n_d - 1) / (n_F - n_C).
 * Dönen değer, mavi (486 nm) ile kırmızı (656 nm) arasındaki indis farkı.
 */
export function abbeSpread(nd: number, abbe: number): number {
  return (nd - 1) / abbe;
}

/** t: 0 = kırmızı ucu, 1 = mavi ucu. Uçlar arasında doğrusal tarama. */
export function dispersedIor(nd: number, spread: number, t: number): number {
  return nd + spread * (t - 0.5);
}

/** Dik bakışta yansıma oranı: ((n1 - n2) / (n1 + n2))². */
export function schlickF0(n1: number, n2: number): number {
  const r = (n1 - n2) / (n1 + n2);
  return r * r;
}

export function fresnelSchlick(cosTheta: number, f0: number): number {
  const c = Math.min(Math.max(1 - cosTheta, 0), 1);
  return f0 + (1 - f0) * c ** 5;
}
