/**
 * The top-down runtime props (ADR 0104 T4, #459): the prototype's object drawings for the game's
 * breakable props, shipped as trimmed hard-alpha PNGs under `public/art/topdown/props/`.
 *
 *   node --import tsx scripts/art/topdown/pack-props.ts [--check]
 *
 * The sources are the ones the prototype's board engine packs (`prototypes/topdown/tools/build_b3.py`
 * `OB`): the forest set in `fc/`, the rain barrel from `objects8/` and the quarry set from
 * `objects13/`. Nothing is redrawn: each image is alpha-thresholded at 128 exactly as `build_b3.py`
 * does and cropped to its ink. `--check` packs in memory and fails when a shipped file differs, is
 * missing, or `props/` holds a file this packer does not write. The game's prop ids map to these
 * names in `src/render/topdown/props.ts` (`TOPDOWN_PROPS`).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { readPng, type Image } from '../lib/image';

export const OUT = 'public/art/topdown/props';

/** Each shipped prop sprite and its prototype source, relative to `prototypes/topdown/`. */
export const PROP_SOURCES: Readonly<Record<string, string>> = {
  rain_barrel: 'assets/objects8/rain_barrel.png',
  oil_flask: 'fc/obj_oil_flask.png',
  hay_bale: 'fc/obj_hay_bale.png',
  brazier: 'assets/objects13/brazier.png',
  cabbage_cart: 'assets/objects13/cabbage_cart.png',
  lime_boulder: 'assets/objects13/lime_boulder.png',
};

/** `build_b3.py`: alpha under 128 clears, anything else is opaque; then crop to the ink. */
export function hardTrim(src: Image): Image {
  const { width: W, height: H } = src;
  const d = new Uint8Array(src.data);
  let x0 = W,
    y0 = H,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const a = d[i + 3] ?? 0;
      if (a < 128) {
        d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
        continue;
      }
      d[i + 3] = 255;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  if (x1 < 0) return { width: 0, height: 0, data: new Uint8Array(0) };
  const w = x1 - x0 + 1,
    h = y1 - y0 + 1,
    out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    out.set(d.subarray(((y0 + y) * W + x0) * 4, ((y0 + y) * W + x0 + w) * 4), y * w * 4);
  return { width: w, height: h, data: out };
}

function encode(image: Image): Uint8Array {
  const png = new PNG({ width: image.width, height: image.height });
  png.data = Buffer.from(image.data);
  return new Uint8Array(PNG.sync.write(png, { colorType: 6 }));
}

/** Every output path and its bytes. */
export function packProps(): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  for (const [name, src] of Object.entries(PROP_SOURCES))
    files.set(`${OUT}/${name}.png`, encode(hardTrim(readPng(`prototypes/topdown/${src}`))));
  return files;
}

function main(): void {
  const check = process.argv.includes('--check');
  const files = packProps();
  const problems: string[] = [];
  const shipped = existsSync(OUT) ? readdirSync(OUT).map((f) => `${OUT}/${f}`) : [];
  for (const path of shipped) if (!files.has(path)) problems.push(`${path}: not the packer's`);
  for (const [path, bytes] of files) {
    if (check) {
      if (!existsSync(path)) problems.push(`${path}: missing`);
      else if (!Buffer.from(bytes).equals(readFileSync(path))) problems.push(`${path}: stale`);
    } else {
      mkdirSync(OUT, { recursive: true });
      writeFileSync(path, bytes);
    }
  }
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log(`${check ? 'checked' : 'packed'} ${files.size} prop sprites`);
}

if (process.argv[1]?.endsWith('pack-props.ts')) main();
