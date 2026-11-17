/**
 * The region palette lock (ADR 0119): a board's baked plates and uprights remapped, pixel by pixel,
 * to the nearest colour of one shared palette, in OKLab, with no dithering, so every object and
 * tile of an area reads as one hand's work. Deterministic. Alpha is untouched; characters never pass
 * through here (they are not part of a bake).
 */
import type { RgbaImage } from '../../../../src/render/shadow/hardShadowMask';
import type { Baked } from './board';

type Lab = readonly [number, number, number];

const lin = (c: number): number => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
/** sRGB bytes to OKLab. */
export function oklab(r: number, g: number, b: number): Lab {
  const R = lin(r),
    G = lin(g),
    B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B),
    m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B),
    s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const rgbOf = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/** A nearest-colour lookup for one palette, cached per source colour. */
export function nearestIn(palette: readonly string[]): (r: number, g: number, b: number) => number {
  const rgb = palette.map(rgbOf);
  const lab = rgb.map(([r, g, b]) => oklab(r, g, b));
  const cache = new Map<number, number>();
  return (r, g, b) => {
    const key = (r << 16) | (g << 8) | b;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const [L, A, B] = oklab(r, g, b);
    let best = 0,
      bestD = Infinity;
    lab.forEach(([l, a, bb], i) => {
      const d = (L - l) ** 2 + (A - a) ** 2 + (B - bb) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    const [pr, pg, pb] = rgb[best] ?? [0, 0, 0];
    const packed = (pr << 16) | (pg << 8) | pb;
    cache.set(key, packed);
    return packed;
  };
}

/** The image with every visible pixel moved to its nearest palette colour. */
export function lockImage(img: RgbaImage, near: ReturnType<typeof nearestIn>): RgbaImage {
  const data = new Uint8ClampedArray(img.data);
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const c = near(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0);
    data[i] = c >> 16;
    data[i + 1] = (c >> 8) & 255;
    data[i + 2] = c & 255;
  }
  return { width: img.width, height: img.height, data };
}

/** A bake with its plates and uprights locked to one palette (`TopDownBoard` opts in per map). */
export function lockBaked(baked: Baked, palette: readonly string[]): Baked {
  const near = nearestIn(palette);
  return {
    ...baked,
    ground: lockImage(baked.ground, near),
    clean: lockImage(baked.clean, near),
    bare: lockImage(baked.bare, near),
    uprights: baked.uprights.map((u) => ({ ...u, image: lockImage(u.image, near) })),
  };
}

/** How many distinct opaque colours an image holds. */
export function colourCount(...imgs: readonly RgbaImage[]): number {
  const seen = new Set<number>();
  for (const img of imgs)
    for (let i = 0; i < img.data.length; i += 4)
      if (img.data[i + 3])
        seen.add(
          ((img.data[i] ?? 0) << 16) | ((img.data[i + 1] ?? 0) << 8) | (img.data[i + 2] ?? 0),
        );
  return seen.size;
}
