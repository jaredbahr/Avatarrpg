/** Lossless PNG encoding search: dimensions and every decoded RGBA byte stay unchanged. */
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

for (const path of process.argv.slice(2)) {
  const original = readFileSync(path);
  const decoded = PNG.sync.read(original);
  let best: Buffer = original;
  const opaque = decoded.data.every((value, index) => index % 4 !== 3 || value === 255);
  for (const colorType of opaque ? ([2, 6] as const) : ([6] as const)) {
    for (const filterType of [-1, 0, 1, 2, 3, 4]) {
      for (const deflateStrategy of [0, 1, 2, 3]) {
        const candidate = PNG.sync.write(decoded, {
          colorType,
          filterType,
          deflateStrategy,
          deflateLevel: 9,
        });
        if (candidate.length < best.length) best = candidate;
      }
    }
  }
  const check = PNG.sync.read(best);
  if (
    check.width !== decoded.width ||
    check.height !== decoded.height ||
    !check.data.equals(decoded.data)
  )
    throw new Error(`Encoding changed pixels: ${path}`);
  writeFileSync(path, best);
  console.log(`${path}: ${original.length} -> ${best.length} bytes, identical RGBA`);
}
