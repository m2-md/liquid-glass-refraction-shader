export interface BackdropVram {
  capture: number;
  sample: number;
  total: number;
}

/** RGBA8 hedefler: piksel başına 4 bayt. */
export function backdropBytes(
  width: number,
  height: number,
  scale: number,
): BackdropVram {
  const capture = width * height * 4;
  if (scale >= 1) return { capture, sample: 0, total: capture };
  const sw = Math.max(1, Math.round(width * scale));
  const sh = Math.max(1, Math.round(height * scale));
  const sample = sw * sh * 4;
  return { capture, sample, total: capture + sample };
}
