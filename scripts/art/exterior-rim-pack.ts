/**
 * Register a reviewed exterior-rim source against the measured guide anchors.
 * This writes ignored candidate atlases and world previews only. Scene content
 * remains responsible for opting an accepted atlas into a runtime scene.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import decode, { init as initWebpDecode } from '@jsquash/webp/decode.js';
import { alphaBounds, crop } from './lib/trim';
import { newImage, pixelAt, readImage, setPixel, writePng, type Image } from './lib/image';
import { encodeWebp } from './lib/webp';

type Point = readonly [number, number];
type Bounds = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};
type Piece = {
  readonly id: string;
  readonly sourceBounds: Bounds;
  readonly sourceBase: readonly [Point, Point];
  readonly atlasBase: readonly [Point, Point];
  readonly worldBase: readonly [Point, Point];
};

const ATLAS_SIZE = 2048;
const PAGE_SIZE: Point = [1152, 1280];
const PREVIEW_WORLD = { x: -128, y: -320, width: 2304, height: 1408 } as const;
const ALPHA_CUTOFF = 16;
const GUTTER = 4;

const CUTTING: readonly Piece[] = [
  {
    id: 'cutting-rear-rim',
    sourceBounds: { x: 21, y: 26, width: 794, height: 594 },
    sourceBase: [
      [21, 206.92140107409347],
      [814, 619.2549213440426],
    ],
    atlasBase: [
      [32, 288],
      [1312, 928],
    ],
    worldBase: [
      [768, 0],
      [2048, 640],
    ],
  },
  {
    id: 'cutting-west-upper-buttress',
    sourceBounds: { x: 844, y: 28, width: 117, height: 239 },
    sourceBase: [
      [844, 265.14898320070733],
      [960, 205.0571214392803],
    ],
    atlasBase: [
      [1361, 384],
      [1553, 288],
    ],
    worldBase: [
      [576, 96],
      [768, 0],
    ],
  },
  {
    id: 'cutting-west-lower-buttress',
    sourceBounds: { x: 996, y: 38, width: 121, height: 229 },
    sourceBase: [
      [996, 265.5495867768594],
      [1116, 204.59243697478985],
    ],
    atlasBase: [
      [1602, 384],
      [1794, 288],
    ],
    worldBase: [
      [0, 384],
      [192, 288],
    ],
  },
];

const DRILLER: readonly Piece[] = [
  {
    id: 'driller-rear-west-rim',
    sourceBounds: { x: 20, y: 21, width: 196, height: 261 },
    sourceBase: [
      [20, 178.09414526541596],
      [215, 282.13321393155644],
    ],
    atlasBase: [
      [32, 288],
      [352, 448],
    ],
    worldBase: [
      [768, 0],
      [1088, 160],
    ],
  },
  {
    id: 'driller-rear-east-rim',
    sourceBounds: { x: 244, y: 20, width: 199, height: 263 },
    sourceBase: [
      [244, 177.098087473722],
      [442, 281.2747576265164],
    ],
    atlasBase: [
      [401, 288],
      [721, 448],
    ],
    worldBase: [
      [1728, 480],
      [2048, 640],
    ],
  },
  {
    id: 'driller-west-upper-buttress',
    sourceBounds: { x: 471, y: 21, width: 119, height: 219 },
    sourceBase: [
      [471, 239.9612114152592],
      [589, 177.47412929528252],
    ],
    atlasBase: [
      [770, 384],
      [962, 288],
    ],
    worldBase: [
      [576, 96],
      [768, 0],
    ],
  },
  {
    id: 'driller-west-lower-buttress',
    sourceBounds: { x: 618, y: 21, width: 118, height: 219 },
    sourceBase: [
      [618, 239.34468022399057],
      [735, 177.3221787628567],
    ],
    atlasBase: [
      [1011, 384],
      [1203, 288],
    ],
    worldBase: [
      [0, 384],
      [192, 288],
    ],
  },
];

function inDiamond(world: Point): boolean {
  const [x, y] = world;
  const diagonal = (x - 768) / 64;
  const sum = y / 32;
  const mapX = (diagonal + sum) / 2;
  const mapY = (sum - diagonal) / 2;
  return mapX >= 0 && mapX < 20 && mapY >= 0 && mapY < 12;
}

function bilinear(image: Image, x: number, y: number): readonly [number, number, number, number] {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const samples = [
    [pixelAt(image, x0, y0), (1 - tx) * (1 - ty)],
    [pixelAt(image, x0 + 1, y0), tx * (1 - ty)],
    [pixelAt(image, x0, y0 + 1), (1 - tx) * ty],
    [pixelAt(image, x0 + 1, y0 + 1), tx * ty],
  ] as const;
  let alpha = 0;
  let red = 0;
  let green = 0;
  let blue = 0;
  for (const [rgba, weight] of samples) {
    const opacity = rgba[3] / 255;
    alpha += opacity * weight;
    red += rgba[0] * opacity * weight;
    green += rgba[1] * opacity * weight;
    blue += rgba[2] * opacity * weight;
  }
  if (alpha === 0) return [0, 0, 0, 0];
  return [
    Math.round(red / alpha),
    Math.round(green / alpha),
    Math.round(blue / alpha),
    Math.round(alpha * 255),
  ];
}

function composite(destination: Image, x: number, y: number, rgba: readonly number[]): void {
  const sourceAlpha = (rgba[3] ?? 0) / 255;
  if (sourceAlpha === 0 || x < 0 || y < 0 || x >= destination.width || y >= destination.height)
    return;
  const existing = pixelAt(destination, x, y);
  const existingAlpha = existing[3] / 255;
  const outAlpha = sourceAlpha + existingAlpha * (1 - sourceAlpha);
  setPixel(destination, x, y, [
    Math.round(
      ((rgba[0] ?? 0) * sourceAlpha + existing[0] * existingAlpha * (1 - sourceAlpha)) / outAlpha,
    ),
    Math.round(
      ((rgba[1] ?? 0) * sourceAlpha + existing[1] * existingAlpha * (1 - sourceAlpha)) / outAlpha,
    ),
    Math.round(
      ((rgba[2] ?? 0) * sourceAlpha + existing[2] * existingAlpha * (1 - sourceAlpha)) / outAlpha,
    ),
    Math.round(outAlpha * 255),
  ]);
}

function grow(box: Bounds): Bounds {
  return {
    x: Math.max(0, box.x - GUTTER),
    y: Math.max(0, box.y - GUTTER),
    width: Math.min(ATLAS_SIZE, box.x + box.width + GUTTER) - Math.max(0, box.x - GUTTER),
    height: Math.min(ATLAS_SIZE, box.y + box.height + GUTTER) - Math.max(0, box.y - GUTTER),
  };
}

function overlaps(a: Bounds, b: Bounds): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** The Cutting source retained a thin amber guide line at its rear base. */
function isGuideContactFringe(
  piece: Piece,
  x: number,
  y: number,
  rgba: readonly number[],
): boolean {
  if (piece.id !== 'cutting-rear-rim') return false;
  const [start, end] = piece.atlasBase;
  const fraction = (x - start[0]) / (end[0] - start[0]);
  if (fraction < 0 || fraction > 1) return false;
  const baseline = start[1] + (end[1] - start[1]) * fraction;
  const distance = y - baseline;
  const [red = 0, green = 0, blue = 0, alpha = 0] = rgba;
  return (
    distance >= -1.25 &&
    distance <= 0.25 &&
    alpha < 240 &&
    red > 170 &&
    green > 110 &&
    blue < 115 &&
    red - green > 18 &&
    green - blue > 30
  );
}

function outputPath(mapId: string): string {
  return mapId === 'ambush_road' ? 'cutting' : 'driller';
}

let decoderReady: Promise<void> | null = null;

async function readWebp(path: string): Promise<Image> {
  if (!decoderReady) {
    const require = createRequire(import.meta.url);
    const wasm = readFileSync(require.resolve('@jsquash/webp/codec/dec/webp_dec.wasm'));
    decoderReady = WebAssembly.compile(wasm).then((module) => initWebpDecode(module));
  }
  await decoderReady;
  const bytes = readFileSync(path);
  const decoded = await decode(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  return { width: decoded.width, height: decoded.height, data: new Uint8Array(decoded.data) };
}

function assertNoDiamondAlpha(
  image: Image,
  components: readonly { readonly piece: Piece; readonly rect: Bounds }[],
): void {
  for (const component of components) {
    const [atlasStart] = component.piece.atlasBase;
    const [worldStart] = component.piece.worldBase;
    for (let y = component.rect.y; y < component.rect.y + component.rect.height; y++)
      for (let x = component.rect.x; x < component.rect.x + component.rect.width; x++) {
        if (pixelAt(image, x, y)[3] === 0) continue;
        const world: Point = [worldStart[0] + x - atlasStart[0], worldStart[1] + y - atlasStart[1]];
        if (inDiamond([world[0] + 0.5, world[1] + 0.5]))
          throw new Error(
            `${component.piece.id} has alpha inside the playable diamond at ${x},${y}.`,
          );
      }
  }
}

const [mapId, sourcePath] = process.argv.slice(2);
if (!mapId || !sourcePath)
  throw new Error('Usage: exterior-rim-pack.ts <ambush_road|quarry_floor> <reviewed-source.png>');
const pieces = mapId === 'ambush_road' ? CUTTING : mapId === 'quarry_floor' ? DRILLER : undefined;
if (!pieces) throw new Error(`Unknown map: ${mapId}`);
const writeFinal = process.argv.includes('--final');

const source = readImage(sourcePath);
const atlas = newImage(ATLAS_SIZE, ATLAS_SIZE);
const componentRects: {
  readonly piece: Piece;
  readonly rect: Bounds;
  readonly xScale: number;
  readonly yScale: number;
}[] = [];
let discardedLowAlpha = 0;
let discardedDiamond = 0;
let discardedGuideContact = 0;

for (const piece of pieces) {
  const [sourceStart, sourceEnd] = piece.sourceBase;
  const [atlasStart, atlasEnd] = piece.atlasBase;
  const xScale = (atlasEnd[0] - atlasStart[0]) / (sourceEnd[0] - sourceStart[0]);
  const yScale = (atlasEnd[1] - atlasStart[1]) / (sourceEnd[1] - sourceStart[1]);
  const xOffset = atlasStart[0] - sourceStart[0] * xScale;
  const yOffset = atlasStart[1] - sourceStart[1] * yScale;
  const startX = Math.floor(piece.sourceBounds.x * xScale + xOffset);
  const endX = Math.ceil((piece.sourceBounds.x + piece.sourceBounds.width) * xScale + xOffset);
  const startY = Math.floor(piece.sourceBounds.y * yScale + yOffset);
  const endY = Math.ceil((piece.sourceBounds.y + piece.sourceBounds.height) * yScale + yOffset);
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const rgba = bilinear(source, (x - xOffset) / xScale, (y - yOffset) / yScale);
      if (rgba[3] < ALPHA_CUTOFF) {
        if (rgba[3] > 0) discardedLowAlpha++;
        continue;
      }
      if (isGuideContactFringe(piece, x, y, rgba)) {
        discardedGuideContact++;
        continue;
      }
      const world: Point = [
        piece.worldBase[0][0] + x - piece.atlasBase[0][0],
        piece.worldBase[0][1] + y - piece.atlasBase[0][1],
      ];
      if (inDiamond([world[0] + 0.5, world[1] + 0.5])) {
        // The generator feathered a few pixels below the measured base line.
        // This is an explicit source-contract mask, never an unreported crop.
        discardedDiamond++;
        continue;
      }
      composite(atlas, x, y, rgba);
    }
  }
  const provisional = alphaBounds(
    crop(atlas, { x: startX, y: startY, width: endX - startX, height: endY - startY }),
    ALPHA_CUTOFF,
  );
  if (!provisional) throw new Error(`${piece.id} has no opaque pixels after registration.`);
  componentRects.push({
    piece,
    rect: grow({
      x: startX + provisional.x,
      y: startY + provisional.y,
      width: provisional.width,
      height: provisional.height,
    }),
    xScale,
    yScale,
  });
}

for (let i = 0; i < componentRects.length; i++)
  for (let j = i + 1; j < componentRects.length; j++) {
    const left = componentRects[i];
    const right = componentRects[j];
    if (left && right && overlaps(left.rect, right.rect))
      throw new Error(`${left.piece.id} overlaps ${right.piece.id} after registration.`);
  }

const runtimeDirectory = mapId === 'ambush_road' ? 'cutting-scene' : 'driller-floor-scene';
const groundPages = await Promise.all(
  ['west', 'east'].map((side) =>
    readWebp(`public/art/maps/${runtimeDirectory}/ground-${side}.webp`),
  ),
);
const assembly = newImage(PREVIEW_WORLD.width, PREVIEW_WORLD.height);
for (const [index, page] of groundPages.entries()) {
  if (page.width !== PAGE_SIZE[0] || page.height !== PAGE_SIZE[1])
    throw new Error(`Unexpected ${runtimeDirectory} ground-page dimensions.`);
  for (let y = 0; y < page.height; y++)
    for (let x = 0; x < page.width; x++)
      composite(
        assembly,
        -128 + index * PAGE_SIZE[0] + x - PREVIEW_WORLD.x,
        -192 + y - PREVIEW_WORLD.y,
        pixelAt(page, x, y),
      );
}

for (const component of componentRects) {
  const [atlasStart] = component.piece.atlasBase;
  const [worldStart] = component.piece.worldBase;
  for (let y = component.rect.y; y < component.rect.y + component.rect.height; y++)
    for (let x = component.rect.x; x < component.rect.x + component.rect.width; x++) {
      const rgba = pixelAt(atlas, x, y);
      if (rgba[3] < ALPHA_CUTOFF) continue;
      const world: Point = [worldStart[0] + x - atlasStart[0], worldStart[1] + y - atlasStart[1]];
      if (inDiamond([world[0] + 0.5, world[1] + 0.5]))
        throw new Error(`${component.piece.id} retained alpha inside the playable diamond.`);
      composite(assembly, world[0] - PREVIEW_WORLD.x, world[1] - PREVIEW_WORLD.y, rgba);
    }
}

const directory = `art/raw/${outputPath(mapId)}`;
mkdirSync(directory, { recursive: true });
writePng(`${directory}/exterior-rim-candidate-atlas.png`, atlas);
writePng(`${directory}/exterior-rim-candidate-full-assembly.png`, assembly);
const finalBudget = mapId === 'ambush_road' ? 120 * 1024 : 80 * 1024;
let finalOutput:
  { readonly bytes: number; readonly quality: number; readonly url: string } | undefined;
if (writeFinal) {
  for (const quality of [82, 80, 78, 76, 74, 72, 70, 68, 66]) {
    const bytes = await encodeWebp(atlas, quality, true);
    if (bytes.length > finalBudget) continue;
    const outDir = `public/art/maps/${runtimeDirectory}`;
    mkdirSync(outDir, { recursive: true });
    const finalPath = `${outDir}/exterior-rim.webp`;
    writeFileSync(finalPath, bytes);
    assertNoDiamondAlpha(await readWebp(finalPath), componentRects);
    finalOutput = {
      bytes: bytes.length,
      quality,
      url: `art/maps/${runtimeDirectory}/exterior-rim.webp`,
    };
    break;
  }
  if (!finalOutput) throw new Error(`${mapId} exterior rim exceeds its budget at WebP quality 66.`);
}
const registration = {
  map: mapId,
  source: sourcePath,
  sourceSha256: createHash('sha256').update(readFileSync(sourcePath)).digest('hex'),
  sourcePixels: [source.width, source.height],
  atlasPixels: [ATLAS_SIZE, ATLAS_SIZE],
  assembly: {
    file: 'exterior-rim-candidate-full-assembly.png',
    pixels: [assembly.width, assembly.height],
    worldBounds: PREVIEW_WORLD,
    groundPages: `public/art/maps/${runtimeDirectory}/ground-{west,east}.webp`,
  },
  alphaCutoff: ALPHA_CUTOFF,
  discardedLowAlpha,
  discardedGuideContact,
  discardedDiamond,
  final: finalOutput,
  candidates: componentRects.map(({ piece, rect, xScale, yScale }) => {
    const [atlasStart] = piece.atlasBase;
    const [worldStart] = piece.worldBase;
    return {
      id: piece.id,
      sourceBounds: piece.sourceBounds,
      sourceBase: piece.sourceBase,
      atlasBase: piece.atlasBase,
      worldBase: piece.worldBase,
      scale: { x: xScale, y: yScale },
      sourceRect: rect,
      x: worldStart[0] - (atlasStart[0] - rect.x),
      y: worldStart[1] - (atlasStart[1] - rect.y),
      width: rect.width,
      height: rect.height,
    };
  }),
  note: 'Candidate-only measured registration. The preview places art outside the exact playable diamond; nonzero discardedDiamond must be reviewed before any final atlas is accepted.',
};
writeFileSync(
  `${directory}/exterior-rim-candidate-registration.json`,
  JSON.stringify(registration, null, 2),
);
console.log(registration);
