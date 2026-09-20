/** Original matching bust, downsampled without repainting; existing portrait contract. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readPng, writePng } from './lib/image';
import { scaleTo } from './lib/scale';
import { encodeWebp } from './lib/webp';

const source = 'assets/reference/fire-deserter/portrait-source.png';
const image = readPng(source);
if (image.width !== image.height) throw new Error('Portrait source must be square');
const portrait = scaleTo(image, 512, 512);
const bytes = await encodeWebp(portrait, 90);
if (bytes.length > 38_228) throw new Error('Portrait exceeds measured existing family headroom');
writeFileSync('public/art/portraits/enemy.deserter.webp', bytes);
mkdirSync('.shots/deserter-portrait', { recursive: true });
writePng('.shots/deserter-portrait/portrait-512.png', portrait);
writePng('.shots/deserter-portrait/portrait-48.png', scaleTo(portrait, 48, 48));
console.log(
  JSON.stringify({
    source,
    sourceSha256: createHash('sha256').update(readFileSync(source)).digest('hex'),
    quality: 90,
    width: 512,
    height: 512,
    bytes: bytes.length,
  }),
);
