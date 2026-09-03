export const FRINGE_SCALE_PX = 32;

/** Kırmızı kanaldaki en büyük kodlanmış ayrımı piksele çevirir. */
export function maxFringePx(
  pixels: Uint8Array,
  scalePx: number = FRINGE_SCALE_PX,
): number {
  let max = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] > max) max = pixels[i];
  }
  return (max / 255) * scalePx;
}
