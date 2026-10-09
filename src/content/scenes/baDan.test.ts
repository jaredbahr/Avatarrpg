import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import decode, { init } from '@jsquash/webp/decode.js';
import { beforeAll, expect, it, vi } from 'vitest';
import { ENCOUNTERS } from '../encounters';
import { BA_DAN_VILLAGE } from '../maps/village';
import {
  BA_DAN_CANAL,
  BA_DAN_WATER_CELLS,
  BA_DAN_CANAL_BRIDGE,
  BA_DAN_CANAL_BANKS,
  BA_DAN_COURTYARD_GROUND,
  BA_DAN_COURTYARD_PROPS,
  BA_DAN_WESTERN_APPROACH_GROUND,
  BA_DAN_NEIGHBORHOOD_GROUNDS,
  BA_DAN_COURTYARD_FOOTPRINTS,
  BA_DAN_COURT_TREES,
  BA_DAN_DRESSING,
  BA_DAN_DRESSING_FOOTPRINTS,
  BA_DAN_NORTH_TERRACE,
  BA_DAN_SURROUND,
  BA_DAN_SURROUND_MODULES,
  BA_DAN_APRON_MAP,
  BA_DAN_APRON_PIECES,
  BA_DAN_FRAME_PIECES,
  BA_DAN_EDGE_WATER,
  BA_DAN_EXTERIOR_APRON,
  BA_DAN_SCENE,
  BA_DAN_SOUTHEAST_PLANTER,
  BA_DAN_TRUE_PIECES,
} from './baDan';
import { buildGrid, reachable, posKey, tileAt } from '../../core/rules/grid';
import { CONTENT_BUNDLE } from '../index';
import { npcStandTiles } from '../schemas';

// Decoding WebP plates is cheap alone and slow on a busy machine; ci:local timed out the
// 5 s default once. Headroom here, not a raised global timeout.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

it('disables projected cast shadows for all village scenery', () => {
  expect(BA_DAN_SCENE.scenery.length).toBeGreaterThan(0);
  expect(BA_DAN_SCENE.scenery.every((piece) => piece.castShadow === false)).toBe(true);
});

it('keeps the packed surround atlas within its delivery budget', () => {
  expect(
    readFileSync('public/art/maps/ba-dan-scene/village-surround.webp').byteLength,
  ).toBeLessThanOrEqual(750 * 1024);
});

it('keeps the painted surround outside the map and leaves all three route mouths open', () => {
  const surround = BA_DAN_SCENE.scenery.filter((piece) =>
    BA_DAN_SURROUND.some(([id]) => id === piece.id),
  );
  expect(surround).toHaveLength(BA_DAN_SURROUND.length);
  expect(new Set(surround.map((piece) => piece.url))).toEqual(
    new Set(['art/maps/ba-dan-scene/village-surround.webp']),
  );
  expect(Object.keys(BA_DAN_SURROUND_MODULES)).toHaveLength(2);
  for (const piece of surround) {
    expect(piece).toMatchObject({ exterior: true, castShadow: false, contactShadow: false });
    expect(piece.depth.x + piece.depth.y).toBeLessThan(0);
    expect(piece.footprint.every(({ x, y }) => Number.isInteger(x) && Number.isInteger(y))).toBe(
      true,
    );
    expect(piece.footprint.every(({ x, y }) => x < 0 || y < 0 || x >= 24 || y >= 16)).toBe(true);
  }
  const occupied = new Set(surround.flatMap((piece) => piece.footprint.map(posKey)));
  for (const exit of [
    { x: 24, y: 7 },
    { x: 24, y: 8 },
    { x: 18, y: 16 },
    { x: 19, y: 16 },
    { x: 20, y: 16 },
    { x: -1, y: 7 },
    { x: -1, y: 8 },
  ])
    expect(occupied, `surround closes route mouth ${posKey(exit)}`).not.toContain(posKey(exit));
});

it('keeps the backdrops on the far boundaries, behind the wall strips, and leaves both near edges empty', () => {
  expect(BA_DAN_SURROUND.some(([id]) => /foreground|south-|east-wall/.test(id))).toBe(false);
  expect(BA_DAN_SURROUND.filter(([id]) => id.startsWith('north-backdrop-'))).toHaveLength(2);
  expect(BA_DAN_SURROUND.filter(([id]) => id.startsWith('west-backdrop-'))).toHaveLength(2);
  // The wall itself is no longer a surround module: it is six strips of two composed runs in the
  // wall atlas (`ba-dan-guides/walls.py`), and `BA_DAN_SURROUND` is the four backdrops.
  expect(BA_DAN_SURROUND).toHaveLength(4);

  const backdrops = BA_DAN_SCENE.scenery.filter(({ id }) => id.includes('backdrop'));
  const walls = BA_DAN_SCENE.scenery.filter(({ id }) => /^wall-\d$/.test(id));
  expect(backdrops).toHaveLength(4);
  expect(walls).toHaveLength(6);
  expect(walls.every(({ depth }) => depth.x === -100 && depth.y === -100)).toBe(true);
  expect(backdrops.every(({ depth }) => depth.x === -101 && depth.y === -101)).toBe(true);
  expect(
    Math.max(...backdrops.map(({ depth }) => depth.x + depth.y)),
    'every backdrop sorts strictly behind every wall',
  ).toBeLessThan(Math.min(...walls.map(({ depth }) => depth.x + depth.y)));
  for (const wall of walls) {
    expect(wall).toMatchObject({
      url: 'art/maps/ba-dan-scene/true-walls.webp',
      exterior: true,
      contactShadow: false,
    });
    // Painted at 1.5 source px per world px and drawn at 2/3.
    expect(wall.sourceRect!.width * (2 / 3)).toBeCloseTo(wall.width, 9);
    expect(wall.sourceRect!.height * (2 / 3)).toBeCloseTo(wall.height, 9);
  }
  // The strips are one wall: no gap between neighbours along the north run.
  const north = walls
    .filter((wall) => wall.x >= 1060 || wall.id === 'wall-1')
    .sort((a, b) => a.x - b.x);
  for (let i = 0; i + 1 < north.length; i++)
    expect(north[i + 1]!.x, `${north[i]!.id} to ${north[i + 1]!.id}`).toBeLessThanOrEqual(
      north[i]!.x + north[i]!.width,
    );
  // 4 backdrops, 6 wall strips, 4 houses, 2 bridge slices, 5 courtyard props, the turned planter,
  // 6 terrace planters, 17 pieces of dressing, 33 tree entries (16 clumps, 17 alone; the last 8
  // clumps are the south and east frame's).
  expect(BA_DAN_SCENE.scenery).toHaveLength(78);
});

it('holds the scenery to the schema limit and the image cap', () => {
  expect(BA_DAN_SCENE.scenery.length).toBeLessThanOrEqual(80);
  // The scene's distinct images stay at the cap `src/render/scene.ts` sets (40).
  const images = new Set([...BA_DAN_SCENE.ground, ...BA_DAN_SCENE.scenery].map((p) => p.url));
  expect(images.size).toBeLessThanOrEqual(40);
});

it('carries the village ground outside the rim, painted after every local piece', () => {
  expect(BA_DAN_APRON_MAP).toEqual({ width: BA_DAN_VILLAGE.width, height: BA_DAN_VILLAGE.height });
  // The apron is the ring cut into bands, each one a piece of its own; the ring
  // itself is still the single box `BA_DAN_EXTERIOR_APRON` describes.
  expect(BA_DAN_EXTERIOR_APRON.width, 'one plate cannot hold the ring').toBeGreaterThan(2048);
  expect(BA_DAN_APRON_PIECES.length).toBeGreaterThan(1);
  for (const piece of BA_DAN_APRON_PIECES) {
    expect(piece.width, `${piece.url} fits an iPad texture`).toBeLessThanOrEqual(2048);
    expect(piece.height).toBeLessThanOrEqual(2048);
    expect(piece.x, `${piece.url} stays on the ring`).toBeGreaterThanOrEqual(
      BA_DAN_EXTERIOR_APRON.x,
    );
    expect(piece.y).toBeGreaterThanOrEqual(BA_DAN_EXTERIOR_APRON.y);
    expect(piece.x + piece.width).toBeLessThanOrEqual(
      BA_DAN_EXTERIOR_APRON.x + BA_DAN_EXTERIOR_APRON.width,
    );
    expect(piece.y + piece.height).toBeLessThanOrEqual(
      BA_DAN_EXTERIOR_APRON.y + BA_DAN_EXTERIOR_APRON.height,
    );
  }
  // The apron follows every local piece, and the south and east frame follows the apron; only the
  // edge water, which runs on past the rim into the apron's fade, is painted over them.
  const edges = BA_DAN_EDGE_WATER.length;
  const outer = BA_DAN_APRON_PIECES.length + BA_DAN_FRAME_PIECES.length;
  expect(BA_DAN_SCENE.ground.slice(-outer - edges, -edges)).toEqual([
    ...BA_DAN_APRON_PIECES,
    ...BA_DAN_FRAME_PIECES,
  ]);
  expect(BA_DAN_SCENE.ground.slice(-edges).map((piece) => piece.url)).toEqual(
    BA_DAN_EDGE_WATER.map(() => 'art/maps/ba-dan-scene/edge-water.webp'),
  );
});

let decodedGround: Map<string, ImageData>;

beforeAll(async () => {
  const require = createRequire(import.meta.url);
  const wasm = readFileSync(require.resolve('@jsquash/webp/codec/dec/webp_dec.wasm'));
  await init(await WebAssembly.compile(wasm));
  decodedGround = new Map();
  for (const piece of BA_DAN_SCENE.ground.filter((entry) =>
    /(?:courtyard|western-approach|northwest-lawn|north-house-court|east-gate-approach|south-house-court|northeast-lawn|southwest-lawn)-ground\.webp$|north-grass-fringe\.webp$/.test(
      entry.url,
    ),
  )) {
    const bytes = readFileSync(`public/${piece.url}`);
    decodedGround.set(
      piece.url,
      await decode(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
    );
  }
});

function alphaAt(
  piece: (typeof BA_DAN_SCENE.ground)[number],
  pos: { x: number; y: number },
): number {
  const image = decodedGround.get(piece.url);
  if (!image) return 0;
  const x = Math.round(1024 + (pos.x - pos.y) * 64 - piece.x);
  const y = Math.round((pos.x + pos.y + 1) * 32 - piece.y);
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return 0;
  return image.data[(y * image.width + x) * 4 + 3] ?? 0;
}

function alphaAtWorld(
  piece: (typeof BA_DAN_SCENE.ground)[number],
  pos: { x: number; y: number },
): number {
  const image = decodedGround.get(piece.url);
  if (!image) return 0;
  // A plate packed finer than a world pixel (the north fringe) is stretched to
  // its box, so a scene offset maps to a source pixel through that scale.
  const x = Math.round(((1024 + (pos.x - pos.y) * 64 - piece.x) * image.width) / piece.width);
  const y = Math.round((((pos.x + pos.y) * 32 - piece.y) * image.height) / piece.height);
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return 0;
  return image.data[(y * image.width + x) * 4 + 3] ?? 0;
}

function rgbAt(
  piece: (typeof BA_DAN_SCENE.ground)[number],
  pos: { x: number; y: number },
): readonly number[] {
  const image = decodedGround.get(piece.url);
  if (!image) return [0, 0, 0];
  const x = Math.round(1024 + (pos.x - pos.y) * 64 - piece.x);
  const y = Math.round((pos.x + pos.y + 1) * 32 - piece.y);
  const at = (y * image.width + x) * 4;
  return [image.data[at] ?? 0, image.data[at + 1] ?? 0, image.data[at + 2] ?? 0];
}

function rgbAtWorld(
  piece: (typeof BA_DAN_SCENE.ground)[number],
  pos: { x: number; y: number },
): readonly number[] {
  const image = decodedGround.get(piece.url);
  if (!image) return [0, 0, 0];
  const x = Math.round(((1024 + (pos.x - pos.y) * 64 - piece.x) * image.width) / piece.width);
  const y = Math.round((((pos.x + pos.y) * 32 - piece.y) * image.height) / piece.height);
  const at = (y * image.width + x) * 4;
  return [image.data[at] ?? 0, image.data[at + 1] ?? 0, image.data[at + 2] ?? 0];
}

it('keeps painted low boundaries solid while preserving every village destination', () => {
  const map = BA_DAN_VILLAGE;
  const grid = buildGrid(map);
  for (const p of BA_DAN_COURTYARD_FOOTPRINTS) {
    expect(tileAt(grid, p)).toMatchObject({ blocked: true, blocksSight: false });
    expect(
      map.scene?.scenery.some((s) => s.footprint.some((f) => f.x === p.x && f.y === p.y)),
    ).toBe(true);
  }
  const start = map.partySpawns[0];
  if (!start) throw new Error('Village has no spawn');
  const paths = reachable({ grid, blocked: new Set(), surfaces: new Map(), size: 1 }, start, 1000);
  // A resident-bound NpcDef has no `pos`: its tiles are its resident's anchors.
  for (const p of [
    ...map.npcs.flatMap((npc) => npcStandTiles(CONTENT_BUNDLE, map.id, npc)),
    { x: 9, y: 4 },
    { x: 23, y: 7 },
  ])
    expect(paths.has(posKey(p)), `Unreachable village destination ${posKey(p)}`).toBe(true);
});

it('covers every blocked tree cell with a scenery footprint', () => {
  for (const [y, row] of BA_DAN_VILLAGE.rows.entries())
    for (const [x, tile] of [...row].entries()) {
      if (tile !== 'T') continue;
      expect(
        BA_DAN_VILLAGE.scene?.scenery.some((piece) =>
          piece.footprint.some((cell) => cell.x === x && cell.y === y),
        ),
        `Blocked tree cell ${x},${y} has no scenery footprint`,
      ).toBe(true);
    }
});

it("keeps Gao's display off his plinth, off the bridge and the moved west planter in open court", () => {
  // The display stood at (7,4) with its legs 0.13 tile from the plinth face, its top hiding the
  // bench on the ledge; (7,5) crowds the bridge's abutments, (6,4) sorts behind the house's
  // terrace, so it stands a tile south and one west.
  expect(BA_DAN_COURTYARD_PROPS.find(({ id }) => id === 'gao-display')).toMatchObject({
    x: 6,
    y: 5,
  });
  expect(BA_DAN_COURTYARD_PROPS.find(({ id }) => id === 'west-planter')).toMatchObject({
    x: 10,
    y: 10,
  });
  const reserved = [
    ...BA_DAN_COURT_TREES,
    ...BA_DAN_VILLAGE.npcs.flatMap((npc) => npcStandTiles(CONTENT_BUNDLE, BA_DAN_VILLAGE.id, npc)),
  ];
  for (const prop of BA_DAN_COURTYARD_PROPS.filter(({ id }) =>
    ['gao-display', 'west-planter'].includes(id),
  ))
    for (const cell of [
      { x: prop.x, y: prop.y },
      { x: prop.x + 1, y: prop.y },
    ])
      expect(reserved, `${prop.id} overlaps reserved cell ${cell.x},${cell.y}`).not.toContainEqual(
        cell,
      );
});

it("stands the courtyard planter, turned, on the south-east house's blocked strip", () => {
  const grid = buildGrid(BA_DAN_VILLAGE);
  const scenery = BA_DAN_SCENE.scenery;
  const house = scenery.findIndex((piece) => piece.id === 'southeast-house');
  const planter = scenery.findIndex((piece) => piece.id === 'southeast-planter');
  const houseDepth = scenery[house]?.depth;
  const piece = scenery[planter];
  const { width, height, anchor } = BA_DAN_TRUE_PIECES['low-planter-1x2'];
  if (!houseDepth || !piece) throw new Error('Missing south-east house or planter');
  for (const cell of BA_DAN_SOUTHEAST_PLANTER) {
    // `rows` already blocks the strip; the house art stops at x 16.
    expect(tileAt(grid, cell)?.blocked).toBe(true);
    expect(scenery[house]?.footprint).not.toContainEqual(cell);
  }
  // The true 1x2 piece is one unscaled slice, no mirror.
  expect(piece).toMatchObject({
    url: 'art/maps/ba-dan-scene/true-low-planter-1x2.webp',
    footprint: [...BA_DAN_SOUTHEAST_PLANTER],
    width,
    height,
  });
  expect(piece.flip).toBeUndefined();
  expect(scenery.some((p) => p.id === 'southeast-planter-far')).toBe(false);
  // It paints after the house and sorts at its far cell, so a figure at (18,10) or
  // (17,12) stands in front of it.
  expect(planter).toBeGreaterThan(house);
  expect(piece.depth).toEqual({ x: 17.5, y: 11.5 });
  // Its plinth's front corner is the strip's (18,12), exactly.
  expect(piece.x + anchor[0]).toBe(1024 + (18 - 12) * 64);
  expect(piece.y + anchor[1]).toBe((18 + 12) * 32);
});

it('registers the painted canal to every actual permanent-water cell', () => {
  const painted = BA_DAN_WATER_CELLS.map(({ x, y }) => `${x},${y}`);
  const actual = BA_DAN_VILLAGE.rows.flatMap((row, y) =>
    [...row].flatMap((key, x) =>
      BA_DAN_VILLAGE.legend[key]?.surface === 'water' ? [`${x},${y}`] : [],
    ),
  );
  expect(painted).toEqual(actual);
  expect(BA_DAN_CANAL).toMatchObject({ x: 0, y: 6, width: 13, height: 1 });
  expect(BA_DAN_VILLAGE.rows[BA_DAN_CANAL_BRIDGE.y]?.[BA_DAN_CANAL_BRIDGE.x]).toBe('=');
});

it('keeps the canal walkable and registers one low bridge at the dry crossing', () => {
  const grid = buildGrid(BA_DAN_VILLAGE);
  for (const pos of BA_DAN_WATER_CELLS) expect(tileAt(grid, pos)?.blocked).not.toBe(true);
  const bridge = BA_DAN_VILLAGE.scene?.scenery.find((piece) => piece.id === 'canal-bridge');
  const bridgeFront = BA_DAN_VILLAGE.scene?.scenery.find(
    (piece) => piece.id === 'canal-bridge-front',
  );
  const { width, height, anchor } = BA_DAN_TRUE_PIECES['canal-bridge'];
  // One tile wide over the canal's column, three long on rows 5..7, drawn unscaled.
  expect(bridge).toMatchObject({
    url: 'art/maps/ba-dan-scene/true-canal-bridge.webp',
    footprint: [BA_DAN_CANAL_BRIDGE],
    width,
    height,
  });
  // The plinth's front corner stands exactly on the crossing's south-east corner (10,8).
  expect(bridge?.x).toBe(1024 + (10 - 8) * 64 - anchor[0]);
  expect(bridge?.y).toBe((10 + 8) * 32 - anchor[1]);
  expect(bridge?.depth).toEqual({ x: 9.5, y: 6.25 });
  expect(bridgeFront).toMatchObject({
    url: 'art/maps/ba-dan-scene/true-canal-bridge-front.webp',
    footprint: [BA_DAN_CANAL_BRIDGE],
    depth: { x: 9.5, y: 6.75 },
    x: bridge?.x,
    y: bridge?.y,
    width: bridge?.width,
    height: bridge?.height,
  });
  expect(bridge?.fadeWhenOccluding).toBeUndefined();
});

it('uses transparent localized canal banks while the grid owns permanent water', () => {
  expect(BA_DAN_SCENE.groundMode).toBe('partial');
  expect(BA_DAN_SCENE.ground).toContainEqual({
    url: 'art/maps/ba-dan-scene/courtyard-ground.webp',
    ...BA_DAN_COURTYARD_GROUND,
  });
  expect(BA_DAN_SCENE.ground.some((piece) => piece.url.endsWith('/ground-west.webp'))).toBe(false);
  expect(BA_DAN_SCENE.ground.some((piece) => piece.url.endsWith('/ground-east.webp'))).toBe(false);
  const canal = BA_DAN_SCENE.ground.find(
    (piece) => piece.url.endsWith('/edge-water.webp') && piece.x === BA_DAN_CANAL_BANKS.x,
  );
  expect(canal).toMatchObject(BA_DAN_CANAL_BANKS);
  expect(canal?.url).toBe('art/maps/ba-dan-scene/edge-water.webp');
  expect(BA_DAN_SCENE.paintedWater).toBeUndefined();
  // The plates carry the pools: the scene declares exactly the map's permanent water.
  const liveWater = BA_DAN_VILLAGE.rows.flatMap((row, y) =>
    [...row].flatMap((ch, x) => (ch === '~' ? [{ x, y }] : [])),
  );
  expect(liveWater.length).toBeGreaterThan(0);
  expect(BA_DAN_SCENE.paintedWaterCells).toEqual(liveWater);
  expect(BA_DAN_SCENE.paintedWaterCells).toEqual(BA_DAN_WATER_CELLS);
  expect(BA_DAN_SCENE.ground.some((piece) => piece.url.endsWith('/canal.webp'))).toBe(false);
  expect(BA_DAN_SCENE.ground.some((piece) => piece.url.endsWith('/pond.webp'))).toBe(false);
});

it('ships the western spawn approach as decoded material coverage with a courtyard overlap', () => {
  const western = BA_DAN_SCENE.ground.find((piece) =>
    piece.url.endsWith('/western-approach-ground.webp'),
  );
  const courtyard = BA_DAN_SCENE.ground.find((piece) =>
    piece.url.endsWith('/courtyard-ground.webp'),
  );
  expect(western).toMatchObject(BA_DAN_WESTERN_APPROACH_GROUND);
  expect(courtyard).toBeDefined();
  if (!western || !courtyard) throw new Error('Missing registered Ba Dan material ground');
  let westernJoinDiff = 0;
  let westernJoinChannels = 0;
  for (const pos of [
    { x: 10, y: 4 },
    { x: 11, y: 4 },
  ]) {
    expect(BA_DAN_VILLAGE.rows[pos.y]?.[pos.x], `grass source ${pos.x},${pos.y}`).toBe(',');
    expect(alphaAt(courtyard, pos), `opaque grass source ${pos.x},${pos.y}`).toBeGreaterThan(240);
  }
  for (let y = 6; y <= 9; y++) {
    for (let x = 0; x <= 6; x++) {
      const cell = BA_DAN_VILLAGE.rows[y]?.[x];
      const alpha = alphaAt(western, { x, y });
      if (cell === '~') expect(alpha).toBeLessThan(8);
      else expect(alpha, `uncovered western cell ${x},${y}`).toBeGreaterThan(240);
    }
  }
  for (const pos of [
    { x: 5, y: 7 },
    { x: 6, y: 7 },
    { x: 5, y: 8 },
    { x: 6, y: 8 },
  ]) {
    expect(alphaAt(western, pos), `western join ${pos.x},${pos.y}`).toBeGreaterThan(240);
    expect(alphaAt(courtyard, pos), `courtyard join ${pos.x},${pos.y}`).toBeGreaterThan(240);
    const westernRgb = rgbAt(western, pos);
    const courtyardRgb = rgbAt(courtyard, pos);
    for (let channel = 0; channel < 3; channel++) {
      const diff = Math.abs((westernRgb[channel] ?? 0) - (courtyardRgb[channel] ?? 0));
      // Per pixel this is two independent lossy encodes of one baked colour. Measured
      // over the whole join (19,338 channel samples across the four cells' neighbourhood)
      // the two plates differ by 1.06 on average, with a tail to 12 only at crack lines
      // and shadow edges, where a lossy block cannot hold a hard step: a read above 4 at
      // one pixel is the encoder at such an edge, not a colour disagreement (the mean
      // below is the real bound). These twelve samples read 5 or less (the true-geometry shadows moved an edge near 5,8).
      expect(diff, `RGB join ${pos.x},${pos.y}, channel ${channel}`).toBeLessThanOrEqual(5);
      westernJoinDiff += diff;
      westernJoinChannels++;
    }
  }
  expect(
    westernJoinDiff / westernJoinChannels,
    'mean western/courtyard mismatch is encoder noise',
  ).toBeLessThan(4);
  for (const y of [7.5, 8.5])
    for (const x of [5.05, 5.25, 5.5])
      expect(alphaAtWorld(western, { x, y }), `opaque fractional join ${x},${y}`).toBeGreaterThan(
        240,
      );
});

it('keeps both north-pocket tile boundaries on one world-space material', () => {
  const courtyard = BA_DAN_SCENE.ground.find((piece) =>
    piece.url.endsWith('/courtyard-ground.webp'),
  );
  const northCourt = BA_DAN_SCENE.ground.find((piece) =>
    piece.url.endsWith('/north-house-court-ground.webp'),
  );
  const northFringe = BA_DAN_SCENE.ground.find((piece) =>
    piece.url.endsWith('/north-grass-fringe.webp'),
  );
  if (!courtyard || !northCourt || !northFringe)
    throw new Error('Missing north-pocket join plates');
  // Cross all four boundaries of (10,4) and (11,4). The pocket's wear may
  // change inside the cells; the two full ground plates must never disagree.
  // The north court plate ends at y=5 and feathers over its last 0.4 tile, so
  // it is opaque only where its body reaches. What is compared is what the
  // player sees: the north plate composited over the courtyard plate beneath
  // it. Where the north plate is transparent (the y=4.99 samples round onto
  // its first transparent row) its RGB is whatever the encoder left under zero
  // alpha, which is not drawn and not a material; the composite ignores it.
  let northCourtDiff = 0;
  let northCourtChannels = 0;
  let opaqueSamples = 0;
  for (const pos of [
    { x: 10.01, y: 4.25 },
    { x: 10.99, y: 4.25 },
    { x: 11.01, y: 4.25 },
    { x: 11.99, y: 4.25 },
    { x: 10.5, y: 4.01 },
    { x: 10.5, y: 4.99 },
    { x: 11.5, y: 4.01 },
    { x: 11.5, y: 4.99 },
  ]) {
    expect(alphaAtWorld(courtyard, pos), `courtyard under ${pos.x},${pos.y}`).toBeGreaterThan(240);
    const northAlpha = alphaAtWorld(northCourt, pos);
    if (5 - pos.y >= 0.4) expect(northAlpha).toBeGreaterThan(240);
    if (northAlpha > 240) opaqueSamples++;
    const expected = rgbAtWorld(courtyard, pos);
    const actual = rgbAtWorld(northCourt, pos);
    for (let channel = 0; channel < 3; channel++) {
      const seen =
        ((actual[channel] ?? 0) * northAlpha + (expected[channel] ?? 0) * (255 - northAlpha)) / 255;
      const diff = Math.abs(seen - (expected[channel] ?? 0));
      expect(diff, `north pocket RGB ${pos.x},${pos.y}, channel ${channel}`).toBeLessThanOrEqual(
        40,
      );
      northCourtDiff += diff;
      northCourtChannels++;
    }
  }
  // Six of the eight samples are opaque, and they decode within about 2.3
  // levels of the courtyard on average; a consistent 11-level step on either
  // plate takes the mean past 7.
  expect(opaqueSamples, 'opaque north-pocket samples').toBeGreaterThanOrEqual(6);
  expect(
    northCourtDiff / northCourtChannels,
    'mean north-pocket mismatch is encoder noise',
  ).toBeLessThan(4);
  // The thin decorative fringe fades at its own silhouette, but its RGB is
  // the same world sample, so partial alpha cannot draw a pale rule. It is
  // packed at 3.8 source pixels per world pixel and lossy, so a single pixel
  // can be a texel off; the run along the pocket must agree on average.
  let diff = 0;
  let count = 0;
  for (let i = 0; i < 40; i++) {
    const pos = { x: 10.1 + i * 0.045, y: 4 };
    expect(alphaAtWorld(northFringe, pos)).toBeGreaterThan(0);
    const expected = rgbAtWorld(courtyard, pos);
    const actual = rgbAtWorld(northFringe, pos);
    for (let channel = 0; channel < 3; channel++) {
      diff += Math.abs((actual[channel] ?? 0) - (expected[channel] ?? 0));
      count++;
    }
  }
  expect(diff / count, 'fringe agrees with the courtyard along the pocket').toBeLessThan(7);
});

it('covers the remaining connected village courts with opaque decoded material joins', () => {
  const courtyard = BA_DAN_SCENE.ground.find((piece) =>
    piece.url.endsWith('/courtyard-ground.webp'),
  );
  const named = (id: string) =>
    BA_DAN_SCENE.ground.find((piece) => piece.url.endsWith(`/${id}-ground.webp`));
  const regions = BA_DAN_NEIGHBORHOOD_GROUNDS.map((frame) => ({ frame, piece: named(frame.id) }));
  expect(courtyard).toBeDefined();
  for (const {
    frame: { id: _id, ...frame },
    piece,
  } of regions)
    expect(piece).toMatchObject(frame);
  if (!courtyard || regions.some(({ piece }) => !piece))
    throw new Error('Missing neighborhood material ground');
  // The only repeated swatches are verified opaque source interiors, never props or water.
  for (const pos of [
    { x: 10, y: 4 },
    { x: 11, y: 4 },
  ]) {
    expect(BA_DAN_VILLAGE.rows[pos.y]?.[pos.x]).toBe(',');
    expect(alphaAt(courtyard, pos)).toBeGreaterThan(240);
  }
  for (const pos of [
    { x: 5, y: 7 },
    { x: 9, y: 7 },
    { x: 5, y: 8 },
    { x: 9, y: 8 },
  ]) {
    expect(BA_DAN_VILLAGE.rows[pos.y]?.[pos.x]).toBe('=');
    expect(alphaAt(courtyard, pos)).toBeGreaterThan(240);
  }
  const centers: Readonly<Record<string, readonly { x: number; y: number }[]>> = {
    'northwest-lawn': [
      { x: 1, y: 4 },
      { x: 3, y: 5 },
      { x: 5, y: 5 },
    ],
    'north-house-court': [
      { x: 5, y: 2 },
      { x: 10, y: 2 },
      { x: 16, y: 3 },
    ],
    'east-gate-approach': [
      { x: 15, y: 7 },
      { x: 20, y: 8 },
      { x: 17, y: 9 },
    ],
    'south-house-court': [
      { x: 6, y: 11 },
      { x: 10, y: 12 },
      { x: 17, y: 13 },
    ],
    'northeast-lawn': [
      { x: 19, y: 2 },
      { x: 21, y: 3 },
      { x: 22, y: 4 },
      { x: 18, y: 5 },
    ],
    'southwest-lawn': [
      { x: 1, y: 11 },
      { x: 3, y: 12 },
      { x: 4, y: 14 },
      { x: 1, y: 14 },
    ],
  };
  for (const { frame, piece } of regions) {
    if (!piece) continue;
    for (const pos of centers[frame.id] ?? [])
      expect(alphaAt(piece, pos), `${frame.id} ${pos.x},${pos.y}`).toBeGreaterThan(240);
  }
  const joins = [
    ['northwest-lawn', { x: 5.5, y: 4.5 }, 'courtyard'],
    ['north-house-court', { x: 10.5, y: 3.5 }, 'courtyard'],
    ['east-gate-approach', { x: 14.5, y: 7.5 }, 'courtyard'],
    ['south-house-court', { x: 10.5, y: 10.5 }, 'courtyard'],
    ['southwest-lawn', { x: 1.25, y: 9.5 }, 'western-approach'],
    ['southwest-lawn', { x: 5.5, y: 11.5 }, 'south-house-court'],
    ['northeast-lawn', { x: 17.5, y: 2.5 }, 'north-house-court'],
  ] as const;
  for (const [leftId, pos, rightId] of joins) {
    const left = named(leftId);
    const right = rightId === 'courtyard' ? courtyard : named(rightId);
    if (!left || !right) throw new Error(`Missing join ${leftId}/${rightId}`);
    expect(alphaAtWorld(left, pos), `${leftId} alpha`).toBeGreaterThan(240);
    expect(alphaAtWorld(right, pos), `${rightId} alpha`).toBeGreaterThan(240);
    const a = rgbAtWorld(left, pos),
      b = rgbAtWorld(right, pos);
    for (let channel = 0; channel < 3; channel++)
      expect(Math.abs((a[channel] ?? 0) - (b[channel] ?? 0))).toBeLessThanOrEqual(8);
  }
  for (const water of BA_DAN_WATER_CELLS) {
    for (const { piece } of regions) if (piece) expect(alphaAt(piece, water)).toBeLessThan(8);
  }
});

it('covers the projected courtyard and southeast canal bank without clipping', () => {
  const projected = [
    { x: 5, y: 3 },
    { x: 15, y: 3 },
    { x: 5, y: 11 },
    { x: 15, y: 11 },
  ].map(({ x, y }) => ({
    x: 1024 + (x - y) * 64,
    y: (x + y) * 32,
  }));
  for (const point of projected) {
    expect(point.x).toBeGreaterThanOrEqual(BA_DAN_COURTYARD_GROUND.x);
    expect(point.y).toBeGreaterThanOrEqual(BA_DAN_COURTYARD_GROUND.y);
    expect(point.x).toBeLessThanOrEqual(BA_DAN_COURTYARD_GROUND.x + BA_DAN_COURTYARD_GROUND.width);
    expect(point.y).toBeLessThanOrEqual(BA_DAN_COURTYARD_GROUND.y + BA_DAN_COURTYARD_GROUND.height);
  }
  expect(BA_DAN_CANAL_BANKS.x + BA_DAN_CANAL_BANKS.width).toBeLessThanOrEqual(
    BA_DAN_COURTYARD_GROUND.x + BA_DAN_COURTYARD_GROUND.width,
  );
  expect(BA_DAN_CANAL_BANKS.y + BA_DAN_CANAL_BANKS.height).toBeLessThanOrEqual(
    BA_DAN_COURTYARD_GROUND.y + BA_DAN_COURTYARD_GROUND.height,
  );
});

it('keeps court trunks solid and both shop doors and village routes reachable', () => {
  const map = BA_DAN_VILLAGE;
  const grid = buildGrid(map);
  const start = map.partySpawns[0];
  if (!start) throw new Error('Village has no spawn');
  const paths = reachable({ grid, blocked: new Set(), surfaces: new Map(), size: 1 }, start, 1000);
  for (const pos of BA_DAN_COURT_TREES) {
    expect(tileAt(grid, pos)?.blocked).toBe(true);
    expect(paths.has(posKey(pos))).toBe(false);
    expect(map.scene?.scenery.find((s) => s.id === `tree-${pos.x}-${pos.y}`)).toMatchObject({
      footprint: [pos],
      depth: pos,
      width: 320,
      fadeWhenOccluding: true,
    });
  }
  for (const pos of [
    // A resident-bound NpcDef has no `pos`: its tiles are its resident's anchors.
    ...map.npcs.flatMap((npc) => npcStandTiles(CONTENT_BUNDLE, map.id, npc)),
    { x: 9, y: 3 },
    { x: 11, y: 3 },
    { x: 23, y: 7 },
    { x: 19, y: 15 },
    { x: 5, y: 6 },
    { x: 17, y: 6 },
  ])
    expect(paths.has(posKey(pos)), `Unreachable court destination ${posKey(pos)}`).toBe(true);
  // The road is open from the ford's bank to the east gate; the ford is not.
  for (const y of [7, 8]) {
    expect(tileAt(grid, { x: 0, y })).toMatchObject({ terrain: 'water_deep', blocked: true });
    for (let x = 1; x < map.width; x++) expect(tileAt(grid, { x, y })?.blocked).not.toBe(true);
  }
});

it('keeps the east court canopy clear of the market frontage and gate watch', () => {
  expect(BA_DAN_COURT_TREES).toContainEqual({ x: 21, y: 2 });
  expect(BA_DAN_COURT_TREES).not.toContainEqual({ x: 17, y: 5 });
  const east = BA_DAN_SCENE.scenery.find((piece) => piece.id === 'tree-21-2');
  expect(east).toMatchObject({
    footprint: [{ x: 21, y: 2 }],
    depth: { x: 21, y: 2 },
    width: 320,
    fadeWhenOccluding: true,
  });
  const house = BA_DAN_SCENE.scenery.find((piece) => piece.id === 'north-house');
  const stall = BA_DAN_SCENE.scenery.find((piece) => piece.id === 'north-market-display');
  if (!east || !house || !stall) throw new Error('Missing east court frontage');
  expect(east.x).toBeGreaterThanOrEqual(house.x + house.width);
  expect(east.x).toBeGreaterThanOrEqual(stall.x + stall.width);
  for (const anchor of [
    { x: 16, y: 6 },
    { x: 17, y: 6 },
  ]) {
    const anchorRight = 1024 + (anchor.x - anchor.y) * 64 + 64;
    expect(east.x).toBeGreaterThanOrEqual(anchorRight);
  }
  const reserved = [
    ...BA_DAN_COURTYARD_PROPS.flatMap(({ x, y }) => [
      { x, y },
      { x: x + 1, y },
    ]),
    ...BA_DAN_VILLAGE.npcs.flatMap((npc) => npcStandTiles(CONTENT_BUNDLE, BA_DAN_VILLAGE.id, npc)),
  ];
  expect(reserved).not.toContainEqual({ x: 21, y: 2 });
});

it('keeps the south-east grove beyond the frontage and river-path mouth', () => {
  expect(BA_DAN_NORTH_TERRACE.at(-1)).toMatchObject({ x: 14, y: -1 });
  // No tree's cells include the river path's mouth.
  for (const x of [18, 19, 20])
    expect(
      BA_DAN_SCENE.scenery.some((piece) => piece.footprint.some((c) => c.x === x && c.y === 15)),
    ).toBe(false);

  const grove = [
    BA_DAN_SCENE.scenery.find((piece) => piece.id === 'tree-26-16'),
    BA_DAN_SCENE.scenery.find((piece) => piece.id === 'tree-27-5'),
  ];
  for (const piece of grove) expect(piece).toMatchObject({ exterior: true });

  const southeastHouse = BA_DAN_SCENE.scenery.find((piece) => piece.id === 'southeast-house');
  const southeastPlanter = BA_DAN_SCENE.scenery.find((piece) => piece.id === 'southeast-planter');
  if (!southeastHouse || !southeastPlanter || grove.some((piece) => !piece))
    throw new Error('Missing south-east scenery');

  // Upright sprites use this calibrated scene-pixel coordinate space. Buildings
  // remain rectangles, but a ground tile is its actual diamond: a crown's
  // transparent rectangular corner may cross the tile's box without crossing
  // any diamond edge.
  const overlapsRectangle = (
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  const rectangle = ({
    x,
    y,
    width,
    height,
  }: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
  const tileDiamond = (x: number, y: number) => {
    const centerX = 1024 + (x - y) * 64;
    const topY = (x + y) * 32;
    return [
      { x: centerX, y: topY },
      { x: centerX + 64, y: topY + 32 },
      { x: centerX, y: topY + 64 },
      { x: centerX - 64, y: topY + 32 },
    ];
  };
  const polygonsOverlap = (
    a: readonly { x: number; y: number }[],
    b: readonly { x: number; y: number }[],
  ) => {
    for (const polygon of [a, b])
      for (let index = 0; index < polygon.length; index += 1) {
        const start = polygon[index];
        const end = polygon[(index + 1) % polygon.length];
        if (!start || !end) continue;
        const axis = { x: start.y - end.y, y: end.x - start.x };
        const project = (point: { x: number; y: number }) => point.x * axis.x + point.y * axis.y;
        const projectedA = a.map(project);
        const projectedB = b.map(project);
        if (
          Math.max(...projectedA) <= Math.min(...projectedB) ||
          Math.max(...projectedB) <= Math.min(...projectedA)
        )
          return false;
      }
    return true;
  };
  const reservedDiamonds = [
    tileDiamond(18, 12), // riverside sign and pickup marker
    tileDiamond(17, 6), // gate-watch anchor
    ...[18, 19, 20].map((x) => tileDiamond(x, 15)), // south road mouth
    // Both east-road rows, tile by tile from the court through the exit.
    ...[7, 8].flatMap((y) => Array.from({ length: 7 }, (_, i) => tileDiamond(17 + i, y))),
  ];
  for (const piece of grove) {
    if (!piece) throw new Error('Missing moved south-east tree');
    for (const box of [southeastHouse, southeastPlanter])
      expect(overlapsRectangle(piece, box)).toBe(false);
    for (const diamond of reservedDiamonds)
      expect(polygonsOverlap(rectangle(piece), diamond)).toBe(false);
  }

  // The remaining small trees are the two shoulders, not the road itself.
  const exitMarkerRight = 1024 + (19 - 15 + 1) * 64;
  const eastShoulder = BA_DAN_SCENE.scenery.find((piece) => piece.id === 'tree-22-15');
  expect(eastShoulder?.x).toBeGreaterThanOrEqual(exitMarkerRight);
  expect(BA_DAN_SCENE.scenery.find((piece) => piece.id === 'tree-21-15')).toMatchObject({
    width: 150,
    footprint: [{ x: 21, y: 15 }],
  });
});

it('raises chimney smoke from the painted roof of a dwelling', async () => {
  const chimneys = BA_DAN_SCENE.chimneys ?? [];
  expect(chimneys).toHaveLength(2);
  const roofs = new Map<string, Awaited<ReturnType<typeof decode>>>();
  for (const name of ['true-dwelling-4x3', 'true-dwelling-4x4']) {
    const bytes = readFileSync(`public/art/maps/ba-dan-scene/${name}.webp`);
    roofs.set(
      `art/maps/ba-dan-scene/${name}.webp`,
      await decode(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
    );
  }
  for (const at of chimneys) {
    // The oblique camera's scene pixel for the ground point.
    const px = 1024 + (at.x - at.y) * 64;
    const py = (at.x + at.y) * 32;
    const house = BA_DAN_SCENE.scenery.find(
      (piece) =>
        /true-dwelling-\dx\d\.webp$/.test(piece.url) &&
        px >= piece.x &&
        px < piece.x + piece.width &&
        py >= piece.y &&
        py < piece.y + piece.height,
    );
    expect(house, `chimney at ${px},${py} is on a dwelling`).toBeDefined();
    const roof = house && roofs.get(house.url);
    if (!house || !roof) continue;
    const u = Math.floor(((px - house.x) / house.width) * roof.width);
    const v = Math.floor(((py - house.y) / house.height) * roof.height);
    // On the roof itself, in its upper band, not in the clear air round it.
    const at4 = (v * roof.width + u) * 4;
    expect(roof.data[at4 + 3], `${house.id} roof pixel`).toBeGreaterThan(200);
    expect(v / roof.height).toBeLessThan(0.3);
    // Red roof tile, not a ridge-end block or the wall: the wisp starts on the tiles.
    const [r = 0, g = 0] = [roof.data[at4], roof.data[at4 + 1]];
    expect(r - g, `${house.id} roof tile`).toBeGreaterThan(40);
  }
});

it('keeps the village an explore-only map, so its painted pools are not changed by a fight today', () => {
  // The renderer still covers a declared pool that goes dry (`paintedWaterIsDry`);
  // this records why nothing reaches that path now: no encounter is staged here.
  expect(ENCOUNTERS.filter((encounter) => encounter.mapId === BA_DAN_VILLAGE.id)).toEqual([]);
});

it('draws every tree from the tree atlas and none with the runtime contact ring', () => {
  const trees = BA_DAN_SCENE.scenery.filter((piece) => piece.id.startsWith('tree-'));
  expect(trees).toHaveLength(33);
  for (const piece of trees) {
    expect(piece.url, piece.id).toBe('art/maps/ba-dan-scene/village-trees.webp');
    // No tree carries the runtime's whole-tile footprint ring (a slab on the lawn beside a trunk, an
    // orphan where a crown is drawn off its cells): the ground bake seats each trunk itself.
    expect(piece.contactShadow, `${piece.id} contact shadow`).toBe(false);
    expect(piece.fadeWhenOccluding, piece.id).toBe(true);
  }
  // Neighbouring trees drawn alone never repeat an image and flip (the clumps were composed from
  // trees that do not: `ba-dan-true-pipeline.test.ts`).
  const alone = trees.filter((piece) => !/^tree-c\d$/.test(piece.id));
  for (const a of alone)
    for (const b of alone) {
      if (a.id >= b.id) continue;
      const near = Math.abs(a.depth.x - b.depth.x) < 2 && Math.abs(a.depth.y - b.depth.y) < 2;
      if (near)
        expect(
          `${JSON.stringify(a.sourceRect)}|${a.flip === true}`,
          `${a.id} beside ${b.id}`,
        ).not.toBe(`${JSON.stringify(b.sourceRect)}|${b.flip === true}`);
    }
  // The rim keeps more than one native size, so it does not read as clones.
  expect(new Set(alone.map((piece) => piece.sourceRect?.width)).size).toBeGreaterThanOrEqual(3);
});

it('blocks the dressing, keeps the main ways open, and reaches every stand point', () => {
  const map = BA_DAN_VILLAGE;
  const grid = buildGrid(map);
  // 17 placements on 28 lawn cells (the dressing plan's list), each a blocked, see-through cell.
  expect(BA_DAN_DRESSING).toHaveLength(17);
  expect(BA_DAN_DRESSING_FOOTPRINTS).toHaveLength(28);
  expect(new Set(BA_DAN_DRESSING_FOOTPRINTS.map(posKey)).size).toBe(28);
  for (const cell of BA_DAN_DRESSING_FOOTPRINTS) {
    expect(map.rows[cell.y]?.[cell.x], `${posKey(cell)} is blocked lawn`).toBe('l');
    expect(tileAt(grid, cell)).toMatchObject({ blocked: true, blocksSight: false });
  }
  // Every piece of dressing is a scenery piece standing on its cells, none on the courtyard's.
  for (const [i, [, x, y]] of BA_DAN_DRESSING.entries()) {
    const id = `d${i}`;
    const piece = BA_DAN_SCENE.scenery.find((p) => p.id === id);
    expect(piece, id).toBeDefined();
    expect(
      piece?.footprint.some((c) => c.x === x && c.y === y),
      id,
    ).toBe(true);
    for (const c of piece?.footprint ?? [])
      expect(
        BA_DAN_COURTYARD_FOOTPRINTS.some((q) => q.x === c.x && q.y === c.y),
        id,
      ).toBe(false);
  }
  // Both road rows run unbroken from the ford's bank to the east exit, the paved square (rows 5
  // and 9, x9..13) is clear, and so are the bridge's approach and the lane along row 4.
  const open = (x: number, y: number) => tileAt(grid, { x, y })?.blocked !== true;
  for (const y of [7, 8])
    for (let x = 1; x < map.width; x++) expect(open(x, y), `road ${x},${y}`).toBe(true);
  for (let x = 9; x <= 13; x++)
    for (const y of [5, 9]) expect(open(x, y), `square ${x},${y}`).toBe(true);
  for (const y of [3, 4, 5])
    for (const x of [9, 10]) expect(open(x, y), `lane ${x},${y}`).toBe(true);
  for (const x of [9, 13]) expect(open(x, 6), `bridge ${x},6`).toBe(true);
  for (let x = 1; x < 17; x++) expect(open(x, 4), `north lane ${x},4`).toBe(true);
  // One connected walkable region: every walkable tile is reachable from the spawn, and every
  // resident's stand point, the doors' trail tiles, the exits and the recovery tiles are in it.
  const start = map.partySpawns[0];
  if (!start) throw new Error('Village has no spawn');
  const paths = reachable({ grid, blocked: new Set(), surfaces: new Map(), size: 1 }, start, 1000);
  const walkable: string[] = [];
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) if (open(x, y)) walkable.push(posKey({ x, y }));
  expect(
    walkable.filter((k) => !paths.has(k)),
    'cut-off walkable tiles',
  ).toEqual([]);
  for (const pos of [
    ...map.npcs.flatMap((npc) => npcStandTiles(CONTENT_BUNDLE, map.id, npc)),
    { x: 9, y: 3 },
    { x: 10, y: 3 },
    { x: 11, y: 3 },
    { x: 11, y: 5 },
    { x: 10, y: 5 },
    { x: 16, y: 3 },
    { x: 16, y: 6 },
    { x: 17, y: 6 },
    { x: 13, y: 9 },
    { x: 10, y: 9 },
    { x: 17, y: 9 },
    { x: 18, y: 12 },
    { x: 21, y: 12 },
    { x: 22, y: 10 },
    { x: 23, y: 7 },
    { x: 23, y: 8 },
    { x: 1, y: 7 },
    { x: 19, y: 15 },
    ...[11, 12, 13, 14, 15].map((x) => ({ x, y: 15 })),
  ])
    expect(paths.has(posKey(pos)), `Unreachable stand point ${posKey(pos)}`).toBe(true);
});
