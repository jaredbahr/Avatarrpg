/** Rebuild the face-only expression proof from its preserved OpenAI edits. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';

const neutral = PNG.sync.read(readFileSync('public/art/portraits/kaya.png'));
const face = [
  [226, 193],
  [260, 174],
  [296, 169],
  [327, 188],
  [351, 218],
  [353, 255],
  [335, 285],
  [308, 309],
  [284, 319],
  [258, 307],
  [233, 286],
  [214, 261],
  [211, 232],
];
function faceAlpha(x, y) {
  let inside = false;
  let distance = Infinity;
  for (let i = 0, j = face.length - 1; i < face.length; j = i++) {
    const [ax, ay] = face[j];
    const [bx, by] = face[i];
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
    const dx = bx - ax,
      dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    distance = Math.min(distance, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  const edge = inside ? Math.min(1, distance / 4) : 0;
  return edge * edge * (3 - 2 * edge);
}
for (const mood of ['angry', 'worried', 'warm']) {
  const folder = `art/raw/portraits-variants/imported/${mood}`;
  execFileSync(
    process.execPath,
    [
      '--import',
      'tsx',
      'scripts/art/portrait.ts',
      '--key',
      'kaya',
      '--in',
      `art/source/portraits-variants/openai/kaya-${mood}.png`,
      '--out',
      folder,
    ],
    { stdio: 'inherit' },
  );
  const edit = PNG.sync.read(readFileSync(`${folder}/kaya.png`));
  const output = new PNG({ width: 512, height: 512 });
  output.data = Buffer.from(neutral.data);
  // Interior face only. Hair silhouette, jaw silhouette, hand, flame and costume
  // remain the original neutral. Four-pixel feather avoids a hard seam; the
  // full eyebrows sit inside the region so a moved brow cannot leave a ghost.
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 512; x++) {
      const alpha = faceAlpha(x, y);
      if (!alpha) continue;
      const offset = (y * 512 + x) * 4;
      for (let c = 0; c < 3; c++)
        output.data[offset + c] = Math.round(
          neutral.data[offset + c] * (1 - alpha) + edit.data[offset + c] * alpha,
        );
    }
  mkdirSync('art/raw/portraits-variants/face-only', { recursive: true });
  writeFileSync(`art/raw/portraits-variants/face-only/kaya-${mood}.png`, PNG.sync.write(output));
}
execFileSync(
  process.env.PORTRAIT_PYTHON ?? 'python',
  ['art/source/portraits-variants/encode-kaya.py'],
  { stdio: 'inherit' },
);
