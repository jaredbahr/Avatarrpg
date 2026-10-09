import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  BA_DAN_DRESSING,
  BA_DAN_DRESSING_FOOTPRINTS,
  BA_DAN_SCENE,
  BA_DAN_TRUE_PIECES,
} from '../../src/content/scenes/baDan';
import { BA_DAN_VILLAGE } from '../../src/content/maps/village';
import { FOREST_ROAD_SCENE } from '../../src/content/scenes/forestRoad';
import {
  FEET,
  TREES,
  VILLAGE_VOLUMES,
  contactMultiplier,
  footDistancePx,
  logicalToWorld,
} from './ba-dan-village-light';
import { LANDINGS, STAND_SPOTS, landingSeat } from './ba-dan-village-material';
import { farGround } from './ba-dan-exterior-apron';
import { contactWear, worldLogical } from './ba-dan-garden';
import { measurePiece, readProjectionPins } from './ba-dan-projection';
import { DRESSING_PINS } from './ba-dan-true-pins';
import {
  CLUMPS,
  FRAME_TREES,
  MAX_GAP,
  closeGaps,
  composeClumps,
  depthKey,
  depthWindow,
  figureKey,
  figureMask,
  treeSpecs,
} from './ba-dan-trees';
import type { Mask } from './ba-dan-trees';
import { TREES_OUTPUT, packTreeAtlas, treeAtlasItems, treeAtlasLayout } from './ba-dan-trees-pack';
import {
  DRESSING_ATLAS_WIDTH,
  DRESSING_PIECES,
  TRUE_BRIDGE_CUT,
  TRUE_PIECES,
  WALL_ATLAS_WIDTH,
  WALL_STRIPS,
  dressingItems,
  packTrueOutputs,
  trueBridgeFront,
  wallItems,
  wallStrip,
} from './ba-dan-true-pieces';
import { shelfPack } from './lib/atlas';
import { offTile } from './lib/ba-dan-projection';
import { readImage } from './lib/image';
import { decodeWebp } from './lib/webp';

/**
 * Guards for the guide-and-paint pipeline (`art/source/ba-dan-true/README.md`): the shipped
 * pieces are a pure function of tracked sources, they keep the edge the game filters, and the
 * scene they stand in is consistent with the light that is baked into the ground around them.
 */
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const SOURCE = 'art/source/ba-dan-true';
const OUTPUT = 'public/art/maps/ba-dan-scene';
/** `edge.py`'s outline colour: the median of the painted outline. */
const OUTLINE = [75, 43, 29] as const;

interface Guide {
  footprint_tiles: [number, number];
  canvas: [number, number];
  foot_polygon_px: [number, number][];
  door: { steps_x: [number, number]; steps_y: [number, number] } | null;
}
const guides = JSON.parse(readFileSync(`${SOURCE}/guides/pieces.json`, 'utf8')) as Record<
  string,
  Guide
>;
const scenery = BA_DAN_SCENE.scenery;
const trueScenery = scenery.filter((p) => /\/true-.*\.webp$/.test(p.url));
/** The guide a true piece was drawn on: its own file's name, or the dressing sprite it is a rectangle of. */
const spriteOf = (id: string, url: string): string => {
  const own = /true-(.*)\.webp$/.exec(url)![1]!;
  if (own !== 'dressing') return own;
  return id.startsWith('north-terrace-')
    ? 'terrace-planter-2x1'
    : (BA_DAN_DRESSING[Number(id.slice(1))]?.[0] ?? own);
};

describe('the shipped pieces are a pure function of the tracked sources', () => {
  let packed: Awaited<ReturnType<typeof packTrueOutputs>> = [];
  beforeAll(async () => {
    packed = await packTrueOutputs();
  });

  it('packs exactly the true files in the output folder, byte for byte', () => {
    const shipped = readdirSync(OUTPUT)
      .filter((f) => f.startsWith('true-'))
      .sort();
    expect(packed.map((p) => p.file).sort()).toEqual(shipped);
    for (const { file, bytes } of packed)
      expect(
        Buffer.from(readFileSync(`${OUTPUT}/${file}`)).equals(Buffer.from(bytes)),
        `${file} differs from a re-pack of ${SOURCE}`,
      ).toBe(true);
  });
});

describe.each([...TRUE_PIECES, ...DRESSING_PIECES])('%s edge contract', (name) => {
  const source = readImage(`${SOURCE}/${name}.png`);
  const mask = readImage(`${SOURCE}/guides/${name}-mask.png`);
  const alpha = (i: number) => source.data[i * 4 + 3] ?? 0;
  const edgeOf = (inside: (i: number) => boolean) => {
    const out: number[] = [];
    for (let y = 1; y < source.height - 1; y++)
      for (let x = 1; x < source.width - 1; x++) {
        const i = y * source.width + x;
        if (inside(i) && [i - 1, i + 1, i - source.width, i + source.width].some((n) => !inside(n)))
          out.push(i);
      }
    return out;
  };

  it('is the guide canvas, and its silhouette is the guide mask', () => {
    const canvas = guides[name]!.canvas;
    expect([source.width, source.height]).toEqual(canvas);
    let off = 0;
    for (let i = 0; i < source.width * source.height; i++)
      if (alpha(i) >= 128 !== mask.data[i * 4 + 3]! >= 128) off++;
    // `edge.py` re-derives the coverage from the geometry; the mask is the same geometry
    // before supersampling, so only a fringe of boundary pixels may differ.
    expect(off / (source.width * source.height)).toBeLessThan(0.002);
  });

  // The dressing has straight posts and rails whose edges fall on a pixel column (a vertical edge has
  // no sub-pixel position to antialias) and one- or two-pixel threads (a rope, a bean pole) whose
  // every pixel is a partial one; the rest of the pieces have neither.
  const dressing = (DRESSING_PIECES as readonly string[]).includes(name);
  const vertical = (i: number): boolean => {
    for (const side of [-1, 1]) {
      let run = true;
      for (let dy = -4; dy <= 4 && run; dy++) {
        const j = i + dy * source.width;
        run = alpha(j) >= 128 && alpha(j + side) < 128 && alpha(j - side) >= 128;
      }
      if (run) return true;
    }
    return false;
  };

  it('has an antialiased alpha edge: partial coverage all along the boundary', () => {
    const boundary = edgeOf((i) => alpha(i) >= 128).filter((i) => !(dressing && vertical(i)));
    const partial = boundary.filter((i) => alpha(i) > 0 && alpha(i) < 255).length;
    expect(boundary.length).toBeGreaterThan(dressing ? 150 : 200);
    // A two-pixel rail has no pixel that is not on its boundary, and half of those are full.
    expect(partial / boundary.length).toBeGreaterThan(dressing ? 0.45 : 0.5);
    const reach = dressing ? 4 : 2;
    for (let i = 0; i < source.width * source.height; i++)
      if (alpha(i) > 0 && alpha(i) < 255) {
        // Partial pixels sit on the boundary: a fully opaque and a clear pixel are within reach.
        const span = Array.from({ length: 2 * reach + 1 }, (_, k) => k - reach);
        const near = span.flatMap((dy) => span.map((dx) => i + dy * source.width + dx));
        expect(near.some((n) => alpha(n) === 255) && near.some((n) => alpha(n) === 0)).toBe(true);
        break;
      }
  });

  it('is outline brown on the rim and under the fringe, so no filter pulls in another colour', () => {
    const rim = edgeOf((i) => alpha(i) >= 128);
    for (const i of rim)
      for (let c = 0; c < 3; c++)
        expect(
          Math.abs((source.data[i * 4 + c] ?? 0) - OUTLINE[c]!),
          `rim ${i}`,
        ).toBeLessThanOrEqual(3);
    // Every clear pixel next to a visible one carries the outline colour in its RGB.
    const visible = (i: number) => alpha(i) > 0;
    let checked = 0;
    for (let y = 1; y < source.height - 1; y++)
      for (let x = 1; x < source.width - 1; x++) {
        const i = y * source.width + x;
        if (alpha(i) !== 0) continue;
        if (![i - 1, i + 1, i - source.width, i + source.width].some(visible)) continue;
        checked++;
        for (let c = 0; c < 3; c++) expect(source.data[i * 4 + c]).toBe(OUTLINE[c]);
      }
    expect(checked).toBeGreaterThan(200);
  });
});

describe.each(TRUE_PIECES)('%s as shipped', (name) => {
  it('keeps the source alpha exactly, and the fringe colour within the encode error', async () => {
    const source = readImage(`${SOURCE}/${name}.png`);
    const files = [{ file: `true-${name}.webp`, image: source }];
    if (name === 'canal-bridge')
      files.push({ file: `true-${name}-front.webp`, image: trueBridgeFront(source) });
    for (const { file, image } of files) {
      const decoded = await decodeWebp(new Uint8Array(readFileSync(`${OUTPUT}/${file}`)));
      expect([decoded.width, decoded.height]).toEqual([image.width, image.height]);
      let alphaOff = 0;
      let fringeWorst = 0;
      for (let i = 0; i < image.data.length; i += 4) {
        if (image.data[i + 3] !== decoded.data[i + 3]) alphaOff++;
        if (image.data[i + 3] === 0 && image.data[i] !== 0)
          for (let c = 0; c < 3; c++)
            fringeWorst = Math.max(
              fringeWorst,
              Math.abs((image.data[i + c] ?? 0) - (decoded.data[i + c] ?? 0)),
            );
      }
      expect(alphaOff, `${file} alpha`).toBe(0);
      expect(fringeWorst, `${file} fringe colour`).toBeLessThanOrEqual(40);
    }
  });
});

it('cuts the bridge on the tile line: the near layer is everything below y - x / 2 = the cut', () => {
  const bridge = readImage(`${SOURCE}/canal-bridge.png`);
  const front = trueBridgeFront(bridge);
  for (let y = 0; y < bridge.height; y++)
    for (let x = 0; x < bridge.width; x++) {
      const i = (y * bridge.width + x) * 4;
      const below = y + 0.5 - 0.5 * (x + 0.5) >= TRUE_BRIDGE_CUT;
      expect(front.data[i + 3]).toBe(below ? bridge.data[i + 3] : 0);
    }
});

describe('the scene the pieces stand in', () => {
  it('stays within the schema limits on scenery and ground draws', () => {
    // `schemas.ts`: scenery `.max(80)`, ground `.max(32)`.
    expect(scenery.length).toBeLessThanOrEqual(80);
    expect(BA_DAN_SCENE.ground.length).toBeLessThanOrEqual(32);
  });

  it('references every file in its output folder, and the Forest Road borrows only what is kept', () => {
    const urls = new Set(
      [
        ...BA_DAN_SCENE.ground,
        ...scenery,
        ...FOREST_ROAD_SCENE.ground,
        ...(FOREST_ROAD_SCENE.scenery ?? []),
      ].map((p) => p.url),
    );
    const files = readdirSync(OUTPUT).sort();
    expect(files.filter((f) => !urls.has(`art/maps/ba-dan-scene/${f}`))).toEqual([]);
    for (const url of urls)
      if (url.startsWith('art/maps/ba-dan-scene/'))
        expect(files, url).toContain(url.slice('art/maps/ba-dan-scene/'.length));
  });

  it('gives every piece a light volume or a caster at its drawn position', () => {
    // The backdrop runs are far foliage behind the wall runs and nothing on the ground meets them.
    for (const piece of scenery.filter((p) => !p.id.includes('-backdrop-'))) {
      if (/^wall-\d$/.test(piece.id)) {
        // A wall strip is a piece of the wall: the volumes of the wall stand inside its drawn box.
        const inside = VILLAGE_VOLUMES.filter((v) => {
          const r = v.kind === 'wall' ? v.section(1) : null;
          if (!r) return false;
          const w = logicalToWorld((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2);
          return (
            w.x >= piece.x &&
            w.x <= piece.x + piece.width &&
            w.y >= piece.y &&
            w.y <= piece.y + piece.height
          );
        });
        expect(inside.length, `${piece.id} has no wall volume in its box`).toBeGreaterThan(0);
        continue;
      }
      if (piece.id.startsWith('tree-')) {
        // A clump is its trees: every cell it stands on has the caster of the tree drawn there.
        for (const cell of piece.footprint)
          expect(
            TREES.some(
              (t) => t.piece.footprint[0]?.x === cell.x && t.piece.footprint[0]?.y === cell.y,
            ),
            `${piece.id} cell ${cell.x},${cell.y} has no tree caster`,
          ).toBe(true);
        continue;
      }
      const own = VILLAGE_VOLUMES.filter(
        (v) =>
          v.id === piece.id ||
          v.id.startsWith(`${piece.id}-`) ||
          (piece.id.startsWith('canal-bridge') && v.id.startsWith('bridge-')),
      );
      expect(own.length > 0, `${piece.id} has no volume`).toBe(true);
      if (!/\/true-/.test(piece.url)) continue;
      // The volumes' ground rectangles stand on the piece's footprint (the bridge's abutments
      // reach one tile either side of its deck tile).
      const xs = piece.footprint.map((c) => c.x);
      const ys = piece.footprint.map((c) => c.y);
      const reach = piece.id.startsWith('canal-bridge') ? 1 : 0;
      for (const v of own) {
        const r = (v.section(v.hMin) ?? v.section((v.hMin + v.hMax) / 2))!;
        const cx = (r.x0 + r.x1) / 2;
        const cy = (r.y0 + r.y1) / 2;
        expect(cx, `${v.id} x`).toBeGreaterThanOrEqual(Math.min(...xs) - reach);
        expect(cx, `${v.id} x`).toBeLessThanOrEqual(Math.max(...xs) + 1 + reach);
        expect(cy, `${v.id} y`).toBeGreaterThanOrEqual(Math.min(...ys) - reach);
        expect(cy, `${v.id} y`).toBeLessThanOrEqual(Math.max(...ys) + 1 + reach);
      }
    }
  });

  it('keeps every pair of scenery foot polygons apart', () => {
    type P = readonly (readonly [number, number])[];
    const feet = trueScenery
      .filter((p) => !p.id.endsWith('-front') && !/^wall-\d$/.test(p.id))
      .map((piece) => {
        const name = spriteOf(piece.id, piece.url);
        const guide = guides[name]!;
        const k = piece.width / guide.canvas[0];
        const poly: P = guide.foot_polygon_px.map(([x, y]) => [piece.x + x * k, piece.y + y * k]);
        return { id: piece.id, poly };
      });
    // 11 old pieces, 17 dressing and the six terrace planters, which share one sprite.
    expect(feet.length).toBeGreaterThanOrEqual(34);
    const overlap = (a: P, b: P): boolean => {
      for (const poly of [a, b])
        for (let i = 0; i < poly.length; i++) {
          const [sx, sy] = poly[i]!;
          const [ex, ey] = poly[(i + 1) % poly.length]!;
          const axis = [sy - ey, ex - sx] as const;
          const proj = (q: readonly [number, number]) => q[0] * axis[0] + q[1] * axis[1];
          const pa = a.map(proj);
          const pb = b.map(proj);
          if (
            Math.max(...pa) <= Math.min(...pb) + 1e-6 ||
            Math.max(...pb) <= Math.min(...pa) + 1e-6
          )
            return false;
        }
      return true;
    };
    for (let i = 0; i < feet.length; i++)
      for (let j = i + 1; j < feet.length; j++)
        expect(overlap(feet[i]!.poly, feet[j]!.poly), `${feet[i]!.id} / ${feet[j]!.id}`).toBe(
          false,
        );
  });

  it('bakes a contact line all round each foot', () => {
    expect(FEET.length).toBeGreaterThan(20);
    const out = 1.5 / 90.5; // ground pixels outside the edge, in tiles
    for (const foot of FEET) {
      const { x0, x1, y0, y1 } = foot.rect;
      const at = (x: number, y: number) => logicalToWorld(x, y);
      const samples = [0.15, 0.5, 0.85].flatMap((t) => [
        at(x0 + t * (x1 - x0), y0 - out),
        at(x0 + t * (x1 - x0), y1 + out),
        at(x0 - out, y0 + t * (y1 - y0)),
        at(x1 + out, y0 + t * (y1 - y0)),
      ]);
      for (const s of samples) {
        // A point inside a neighbouring foot (terrace against plinth, abutment pairs) is not open ground.
        if (footDistancePx(s.x, s.y) <= 0) continue;
        expect(contactMultiplier(s.x, s.y), `${foot.id} at ${s.x},${s.y}`).toBeLessThanOrEqual(
          0.75,
        );
      }
    }
  });

  it('lays a door landing in front of each house door, at the foot of its steps', () => {
    const houses = scenery.filter((p) => p.id.endsWith('-house'));
    expect(houses).toHaveLength(4);
    expect(LANDINGS).toHaveLength(houses.length);
    for (const house of houses) {
      const name = /true-(.*)\.webp$/.exec(house.url)![1]!;
      const door = guides[name]!.door!;
      const x0 = Math.min(...house.footprint.map((c) => c.x));
      const y0 = Math.min(...house.footprint.map((c) => c.y));
      // One step beyond the stair's foot, on the stair's centre line.
      const lx = x0 + door.steps_x[1] + 0.3;
      const ly = y0 + (door.steps_y[0] + door.steps_y[1]) / 2;
      const w = logicalToWorld(lx, ly);
      expect(landingSeat(w.x, w.y), `${house.id} landing`).toBeGreaterThan(0.9);
      // And not under the door's neighbours: the lawn two tiles out is not a landing.
      const far = logicalToWorld(lx + 1.5, ly);
      expect(landingSeat(far.x, far.y), `${house.id} lawn`).toBe(0);
    }
  });
});

describe('other maps are untouched', () => {
  const PARENT = '85fabb74';
  const parent = (() => {
    try {
      execFileSync('git', ['cat-file', '-e', `${PARENT}^{commit}`], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  })();

  // Needs the parent commit in the local history; a shallow clone skips it.
  it.skipIf(!parent)(
    'leaves the forest, quarry, driller and cutting plates byte-identical to the parent',
    () => {
      const changed = execFileSync(
        'git',
        [
          'diff',
          '--name-only',
          PARENT,
          '--',
          'public/art/maps/forest-scene',
          'public/art/maps/quarry-gate-scene',
          'public/art/maps/driller-floor-scene',
          'public/art/maps/cutting-scene',
        ],
        { encoding: 'utf8' },
      );
      expect(changed.trim()).toBe('');
    },
  );

  it('keeps every file the Forest Road borrows from the village folder', () => {
    const borrowed = FOREST_ROAD_SCENE.scenery
      .map((p) => p.url)
      .filter((url) => url.startsWith('art/maps/ba-dan-scene/'));
    expect(borrowed.length).toBeGreaterThan(0);
    for (const url of borrowed) expect(readdirSync(OUTPUT)).toContain(url.split('/').pop());
  });
});

describe('the dressing atlas and the tree atlas', () => {
  it('lays the atlas out as the scene says: every rectangle of `baDan.ts` is where the packer put it', () => {
    const { placed } = shelfPack(dressingItems(), DRESSING_ATLAS_WIDTH);
    for (const name of DRESSING_PIECES) {
      const at = placed.find((p) => p.name === name)!;
      const spec = BA_DAN_TRUE_PIECES[name];
      expect(spec.source, name).toEqual({ x: at.x, y: at.y, width: at.width, height: at.height });
    }
    // The wall strips are sprites of their own atlas, laid in the packer's order; painted at 1.5 source px per
    // world px and drawn at 2/3, so the scene's box is two thirds of the cut.
    const walls = shelfPack(wallItems(), WALL_ATLAS_WIDTH, 2, false).placed;
    WALL_STRIPS.forEach((strip, i) => {
      const at = walls.find((p) => p.name === `wall-${i}`)!;
      const cut = wallStrip(strip);
      const piece = scenery.find((q) => q.id === `wall-${i}`)!;
      expect(piece.sourceRect, piece.id).toEqual({
        x: at.x,
        y: at.y,
        width: at.width,
        height: at.height,
      });
      expect([piece.x, piece.y], piece.id).toEqual([cut.x, cut.y]);
      expect(piece.width, piece.id).toBeCloseTo((cut.image.width * 2) / 3, 9);
      expect(piece.height, piece.id).toBeCloseTo((cut.image.height * 2) / 3, 9);
    });
  });

  it.each([
    ['true-dressing.webp', dressingItems, DRESSING_ATLAS_WIDTH, true],
    ['true-walls.webp', wallItems, WALL_ATLAS_WIDTH, false],
  ] as const)(
    'ships every sprite of %s exactly (alpha) and within the encode error (colour)',
    async (file, items, width, sorted) => {
      const atlas = await decodeWebp(new Uint8Array(readFileSync(`${OUTPUT}/${file}`)));
      const sprites = items();
      const { placed } = shelfPack(sprites, width, 2, sorted);
      expect(atlas.width).toBe(width);
      for (const item of sprites) {
        const at = placed.find((p) => p.name === item.name)!;
        let alphaOff = 0;
        let worst = 0;
        for (let y = 0; y < at.height; y++)
          for (let x = 0; x < at.width; x++) {
            const i = (y * at.width + x) * 4;
            const j = ((at.y + y) * atlas.width + at.x + x) * 4;
            if (item.image.data[i + 3] !== atlas.data[j + 3]) alphaOff++;
            if (item.image.data[i + 3] !== 0)
              for (let c = 0; c < 3; c++)
                worst = Math.max(
                  worst,
                  Math.abs((item.image.data[i + c] ?? 0) - (atlas.data[j + c] ?? 0)),
                );
          }
        expect(alphaOff, `${item.name} alpha`).toBe(0);
        expect(worst, `${item.name} colour`).toBeLessThanOrEqual(80);
      }
    },
  );

  it('puts the tree masters and clumps where the scene says, and re-packs to the shipped bytes', async () => {
    const items = treeAtlasItems();
    const { placed, width, height } = treeAtlasLayout(items);
    const packed = await packTreeAtlas();
    expect(Buffer.from(packed.bytes).equals(readFileSync(TREES_OUTPUT))).toBe(true);
    const atlas = await decodeWebp(new Uint8Array(readFileSync(TREES_OUTPUT)));
    expect([atlas.width, atlas.height]).toEqual([width, height]);
    // One page every iPad takes, and no sprite of it clear of a neighbour's gutter.
    expect(Math.max(width, height)).toBeLessThanOrEqual(2048);
    const clumps = composeClumps();
    clumps.forEach((c, i) => {
      const at = placed.find((p) => p.name === `clump-${i}`)!;
      const piece = scenery.find((q) => q.id === `tree-c${i}`)!;
      expect(piece.sourceRect, piece.id).toEqual({
        x: at.x,
        y: at.y,
        width: c.width,
        height: c.height,
      });
      expect([piece.x, piece.y, piece.width, piece.height], piece.id).toEqual([
        c.x,
        c.y,
        c.width,
        c.height,
      ]);
      expect(piece.depth).toEqual({ x: c.key, y: 0 });
      expect(piece.footprint).toEqual(c.members.map((m) => m.cell));
    });
    // Every other tree is drawn alone from its master's rectangle, mirrored by the scene.
    const inClump = new Set(clumps.flatMap((c) => c.members.map((m) => m.id)));
    for (const spec of treeSpecs().filter((t) => !inClump.has(t.id))) {
      const piece = scenery.find((q) => q.id === spec.id)!;
      const at = placed.find((p) => p.name === spec.master)!;
      expect(piece, spec.id).toBeDefined();
      expect(piece.sourceRect, spec.id).toEqual({
        x: at.x,
        y: at.y,
        width: spec.width,
        height: spec.height,
      });
      expect([piece.x, piece.y], spec.id).toEqual([spec.x, spec.y]);
      expect(piece.depth, spec.id).toEqual(spec.depth);
      expect(piece.flip === true, spec.id).toBe(spec.flip);
    }
    expect(scenery.filter((q) => q.id.startsWith('tree-'))).toHaveLength(
      treeSpecs().length - inClump.size + clumps.length,
    );
  });

  it('draws each clump as the pixels its trees drew: same place, nothing scaled', () => {
    const specs = treeSpecs();
    for (const clump of composeClumps())
      for (const m of clump.members) {
        const single = specs.find((t) => t.id === m.id)!;
        expect([m.x, m.y, m.width, m.height, m.flip]).toEqual([
          single.x,
          single.y,
          single.width,
          single.height,
          single.flip,
        ]);
        // The tree's own opaque pixels are in the composite wherever nothing nearer covers them.
        let missing = 0;
        let seen = 0;
        const own = readImage(`art/source/ba-dan-restyle/fine/${m.master}-village-tree.png`);
        for (let y = 0; y < m.height; y += 5)
          for (let x = 0; x < m.width; x += 5) {
            const sx = m.flip ? m.width - 1 - x : x;
            if ((own.data[(y * own.width + sx) * 4 + 3] ?? 0) === 0) continue;
            seen++;
            const cx = m.x - clump.x + x;
            const cy = m.y - clump.y + y;
            if ((clump.image.data[(cy * clump.width + cx) * 4 + 3] ?? 0) === 0) missing++;
          }
        expect(seen).toBeGreaterThan(0);
        expect(missing, `${m.id} pixels missing from its clump`).toBe(0);
      }
  });
});

describe('the dressing and the wall stand on the tile lines', () => {
  const pins = readProjectionPins(DRESSING_PINS);

  it.each(Object.keys(pins))(
    '%s: its ground lines run at 26.57 degrees, within a degree',
    (name) => {
      const file = name.startsWith('wall-')
        ? `${SOURCE}/walls/${name.slice(5)}.png`
        : `${SOURCE}/${name}.png`;
      const m = measurePiece(pins, name, readImage(file), false);
      expect(Math.abs(offTile(m.left)), `left ${m.left.degrees}`).toBeLessThanOrEqual(1);
      expect(Math.abs(offTile(m.right)), `right ${m.right.degrees}`).toBeLessThanOrEqual(1);
    },
  );

  it('draws the well curb as the 2:1 ellipse of a circle on the ground', () => {
    // A circle of radius r tiles is 96 * r * sqrt(2) px wide on each side of its centre and half
    // that tall on the 1.5x guide; the lower silhouette's drop from the front point at half the
    // radius out must be what an ellipse of those semi-axes gives.
    const img = readImage(`${SOURCE}/village-well.png`);
    const a = 96 * 0.38 * Math.SQRT2;
    const b = a / 2;
    const env = new Int32Array(img.width).fill(-1);
    for (let x = 0; x < img.width; x++)
      for (let y = img.height - 1; y >= 0; y--)
        if ((img.data[(y * img.width + x) * 4 + 3] ?? 0) > 128) {
          env[x] = y;
          break;
        }
    const bottom = Math.max(...env);
    const xc = (env.indexOf(bottom) + env.lastIndexOf(bottom)) / 2;
    for (const f of [0.5, 0.75]) {
      const drop = b * (1 - Math.sqrt(1 - f * f));
      const at = env[Math.round(xc + f * a)] ?? -1;
      expect(Math.abs(bottom - at - drop), `drop at ${f}`).toBeLessThanOrEqual(2);
    }
  });
});

describe('the clumps keep every figure and piece of scenery in the order the single trees had', () => {
  it('has a depth under which no figure standing on a walkable tile, and no other piece, changes side', async () => {
    const treeIds = new Set(treeSpecs().map((t) => t.id));
    const others = [] as { id: string; key: number; mask: Mask }[];
    const cache = new Map<string, Awaited<ReturnType<typeof decodeWebp>>>();
    for (const piece of scenery) {
      if (treeIds.has(piece.id) || piece.id.startsWith('tree-') || /^wall-\d$/.test(piece.id))
        continue;
      if (piece.id.includes('backdrop')) continue;
      let img = cache.get(piece.url);
      if (!img) {
        img = await decodeWebp(new Uint8Array(readFileSync(`public/${piece.url}`)));
        cache.set(piece.url, img);
      }
      const rect = piece.sourceRect ?? { x: 0, y: 0, width: img.width, height: img.height };
      const w = Math.round(piece.width);
      const h = Math.round(piece.height);
      const alpha = new Uint8Array(w * h);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const sx = rect.x + Math.min(rect.width - 1, Math.floor((x * rect.width) / w));
          const sy = rect.y + Math.min(rect.height - 1, Math.floor((y * rect.height) / h));
          alpha[y * w + x] = img.data[(sy * img.width + sx) * 4 + 3] ?? 0;
        }
      others.push({
        id: piece.id,
        key: depthKey(piece.depth),
        mask: { x: Math.round(piece.x), y: Math.round(piece.y), width: w, height: h, alpha },
      });
    }
    const figures: { tx: number; ty: number; key: number; mask: Mask }[] = [];
    BA_DAN_VILLAGE.rows.forEach((row, y) =>
      [...row].forEach((c, x) => {
        if (!'TlB'.includes(c))
          figures.push({ tx: x, ty: y, key: figureKey(x, y), mask: figureMask(x, y) });
      }),
    );
    const specs = treeSpecs();
    const masters = new Map<string, ReturnType<typeof readImage>>();
    const members = (ids: readonly string[]) =>
      ids.map((id) => {
        const t = specs.find((q) => q.id === id)!;
        let m = masters.get(t.master);
        if (!m) {
          m = readImage(`art/source/ba-dan-restyle/fine/${t.master}-village-tree.png`);
          masters.set(t.master, m);
        }
        const alpha = new Uint8Array(t.width * t.height);
        for (let y = 0; y < t.height; y++)
          for (let x = 0; x < t.width; x++)
            alpha[y * t.width + x] =
              m.data[(y * m.width + (t.flip ? t.width - 1 - x : x)) * 4 + 3] ?? 0;
        return {
          id,
          key: depthKey(t.depth),
          mask: { x: t.x, y: t.y, width: t.width, height: t.height, alpha },
        };
      });
    for (const clump of CLUMPS) {
      const window = depthWindow(members(clump.members), figures, others);
      expect(window, `${clump.members.join(',')} has no legal depth`).not.toBeNull();
      expect(clump.key, `${clump.members[0]} clump depth`).toBeGreaterThan(window!.lo);
      expect(clump.key, `${clump.members[0]} clump depth`).toBeLessThanOrEqual(window!.hi);
    }
  });
});

describe('the south and east frame trees', () => {
  const frameIds = new Set(
    treeSpecs()
      .filter((t) => t.id.startsWith('tree-f'))
      .map((t) => t.id),
  );
  const allClumps = composeClumps();
  const frameClumps = allClumps.filter((c) => c.members.every((m) => frameIds.has(m.id)));
  const rows = BA_DAN_VILLAGE.rows;
  const walkable = rows.flatMap((row, y) =>
    [...row].flatMap((c, x) => (!'TlB'.includes(c) ? [{ x, y }] : [])),
  );
  // Each road exit's mouth runs on out of the map as a corridor of tiles.
  const corridor = [
    ...Array.from({ length: 8 }, (_, d) =>
      [...rows[rows.length - 1]!].flatMap((c, x) => (c === '.' ? [{ x, y: rows.length + d }] : [])),
    ).flat(),
    ...Array.from({ length: 8 }, (_, d) =>
      rows.flatMap((row, y) => (row[row.length - 1] === '.' ? [{ x: row.length + d, y }] : [])),
    ).flat(),
  ];

  /** Painted pixels a mask has inside a tile's ground diamond, or a standing figure's box. */
  const covered = (
    clump: { x: number; y: number; width: number; height: number; image: { data: Uint8Array } },
    tile: { x: number; y: number },
    kind: 'diamond' | 'figure',
  ): number => {
    const cx = 1024 + (tile.x - tile.y) * 64;
    const cy = (tile.x + tile.y + 1) * 32;
    const [x0, x1, y0, y1] =
      kind === 'diamond' ? [cx - 64, cx + 64, cy - 32, cy + 32] : [cx - 20, cx + 20, cy - 84, cy];
    let n = 0;
    for (let y = Math.max(clump.y, Math.floor(y0)); y < Math.min(clump.y + clump.height, y1); y++)
      for (
        let x = Math.max(clump.x, Math.floor(x0));
        x < Math.min(clump.x + clump.width, x1);
        x++
      ) {
        if (kind === 'diamond' && Math.abs(x + 0.5 - cx) / 64 + Math.abs(y + 0.5 - cy) / 32 > 1)
          continue;
        if ((clump.image.data[((y - clump.y) * clump.width + (x - clump.x)) * 4 + 3] ?? 0) > 64)
          n++;
      }
    return n;
  };

  it('are eight clumps of exterior trees, one entry each, standing on the frame ground', () => {
    expect(FRAME_TREES).toHaveLength(frameIds.size);
    expect(frameClumps).toHaveLength(8);
    for (const clump of frameClumps) {
      const piece = scenery.find((q) => q.id === `tree-c${allClumps.indexOf(clump)}`)!;
      expect(piece.exterior, piece.id).toBe(true);
      expect(clump.members.length, piece.id).toBeLessThanOrEqual(5);
    }
    for (const t of treeSpecs().filter((q) => frameIds.has(q.id))) {
      const ground = farGround(t.depth.x, t.depth.y);
      expect(ground, `${t.id} stands on the frame`).not.toBeNull();
      // Its root is a tile or more outside the rim, and inside the tree line so no trunk hangs over
      // the edge: the corner trees stand on the apron's own lawn, the rest on the frame's.
      expect(ground!.depth, t.id).toBeGreaterThan(1);
      expect(ground!.bank - ground!.depth, `${t.id} clear of the bank`).toBeGreaterThanOrEqual(0.4);
    }
  });

  it('never cover a ground diamond or a standing figure of any tile a person can walk on, nor an exit', () => {
    expect(walkable.length).toBeGreaterThan(200);
    expect(corridor).toHaveLength(8 * 3 + 8 * 2);
    for (const clump of frameClumps)
      for (const [name, tiles, kind] of [
        ['a walkable ground diamond', walkable, 'diamond'],
        ['a figure standing on a walkable tile', walkable, 'figure'],
        ["an exit corridor's ground", corridor, 'diamond'],
      ] as const)
        for (const tile of tiles)
          expect(
            covered(clump, tile, kind),
            `${clump.members[0]!.id}'s clump covers ${name} at ${tile.x},${tile.y}`,
          ).toBe(0);
  });

  it('keeps the scene inside its caps: 80 scenery entries, 40 distinct images, 32 ground pieces', () => {
    const images = new Set([...BA_DAN_SCENE.ground, ...BA_DAN_SCENE.scenery].map((p) => p.url));
    expect(BA_DAN_SCENE.scenery.length).toBeLessThanOrEqual(80);
    expect(BA_DAN_SCENE.ground.length).toBeLessThanOrEqual(32);
    expect(images.size).toBeLessThanOrEqual(40);
  });
});

describe('the marks the lawn and the canopy must not carry', () => {
  it('has no gap left in a canopy for the wall behind it to show through', () => {
    // The north-west trees stand in front of the cream wall, and a few pixels of gap inside a
    // clump read as a short white streak in the leaves.
    for (const item of treeAtlasItems()) {
      const closed = closeGaps(item.image, MAX_GAP);
      let changed = 0;
      for (let i = 0; i < item.image.data.length; i += 4)
        if (item.image.data[i + 3] !== closed.data[i + 3]) changed++;
      expect(changed, `${item.name} has an enclosed gap`).toBe(0);
    }
  });

  it('wears the ground only where something stands: a person at the well, not a bare disc on lawn', () => {
    // Every spot where people stand is beside a piece of dressing a person would use.
    for (const [x, y] of STAND_SPOTS)
      expect(
        Math.min(
          ...BA_DAN_DRESSING_FOOTPRINTS.map((c) => Math.hypot(x - c.x - 0.5, y - c.y - 0.5)),
        ),
        `stand spot ${x},${y} has nothing beside it`,
      ).toBeLessThanOrEqual(1.6);
    // The well's south side had no one standing on it; the household adult stands on its west.
    expect(STAND_SPOTS.some(([x, y]) => Math.hypot(x - 12.5, y - 14.5) < 0.6)).toBe(false);
    expect(STAND_SPOTS.some(([x, y]) => Math.hypot(x - 11.5, y - 13.5) < 0.1)).toBe(true);
    // And a canopy's hanging leaves are no foot: the lawn east of the rim saplings, where the
    // clump's composite once put one, has no contact wear.
    let worn = 0;
    for (let wy = 1090; wy <= 1135; wy++)
      for (let wx = 1880; wx <= 1940; wx++) {
        const { x, y } = worldLogical(wx + 0.5, wy + 0.5);
        if (Math.hypot(x - 24.3, y - 10.4) < 0.9 && contactWear(wx, wy)) worn++;
      }
    expect(worn).toBe(0);
  });
});
