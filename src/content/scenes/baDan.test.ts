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
  BA_DAN_COURTYARD_PROPS,
  BA_DAN_COURTYARD_FOOTPRINTS,
  BA_DAN_COURT_TREES,
  BA_DAN_DRESSING,
  BA_DAN_DRESSING_FOOTPRINTS,
  BA_DAN_IMAGE_COUNT,
  BA_DAN_SCENE,
  BA_DAN_SOUTHEAST_PLANTER,
  BA_DAN_STANDING,
} from './baDan';
import {
  BA_DAN_GROUND_PLATES,
  BA_DAN_PAINTING,
  BA_DAN_UPRIGHT_PAGES,
  BA_DAN_UPRIGHTS,
} from './baDan.art';
import { buildGrid, reachable, posKey, tileAt } from '../../core/rules/grid';
import { CONTENT_BUNDLE } from '../index';
import { npcStandTiles } from '../schemas';
import type { SceneScenery } from '../../core/types';

// Decoding WebP pages is cheap alone and slow on a busy machine; ci:local timed out the
// 5 s default once. Headroom here, not a raised global timeout.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

type Decoded = Awaited<ReturnType<typeof decode>>;
const pages: Decoded[] = [];

beforeAll(async () => {
  const require = createRequire(import.meta.url);
  const wasm = readFileSync(require.resolve('@jsquash/webp/codec/dec/webp_dec.wasm'));
  await init(await WebAssembly.compile(wasm));
  for (let i = 0; i < BA_DAN_UPRIGHT_PAGES; i++) {
    const bytes = readFileSync(`public/art/maps/ba-dan-scene/uprights-${i}.webp`);
    pages.push(
      await decode(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
    );
  }
});

/** The opaque-ness (0..255) of an upright at a scene pixel; 0 outside its rectangle. */
function alphaAtScenePixel(piece: SceneScenery, x: number, y: number): number {
  const rect = piece.sourceRect;
  const page = pages[Number(/uprights-(\d+)\.webp$/.exec(piece.url)?.[1])];
  if (!rect || !page) throw new Error(`${piece.id} has no sprite`);
  const u = Math.floor(((x - piece.x) / piece.width) * rect.width);
  const v = Math.floor(((y - piece.y) / piece.height) * rect.height);
  if (u < 0 || v < 0 || u >= rect.width || v >= rect.height) return 0;
  return page.data[((rect.y + v) * page.width + rect.x + u) * 4 + 3] ?? 0;
}

it('disables projected cast shadows and the runtime contact ring for all village scenery', () => {
  expect(BA_DAN_SCENE.scenery.length).toBeGreaterThan(0);
  for (const piece of BA_DAN_SCENE.scenery) {
    // The painting has the contact and the cast shade; the runtime would draw them a second time.
    expect(piece.castShadow, piece.id).toBe(false);
    expect(piece.contactShadow, piece.id).toBe(false);
  }
});

it('is a complete scene whose painting carries the water, the joins and the light', () => {
  // Not `groundMode: 'partial'`: no procedural terrain under the plates and no runtime join wash over them.
  expect(BA_DAN_SCENE.groundMode).toBeUndefined();
  expect(BA_DAN_SCENE.paintedWater).toBe(true);
  expect(BA_DAN_SCENE.paintedWaterCells).toBeUndefined();
  expect(BA_DAN_SCENE.paintedRubble).toBeUndefined();
  expect(BA_DAN_SCENE.marginTone).toBe('verdant');
});

it('holds the scenery to the schema limit, the ground to its piece limit and the images to the cap', () => {
  expect(BA_DAN_SCENE.scenery.length).toBeLessThanOrEqual(80);
  expect(BA_DAN_SCENE.ground.length).toBeLessThanOrEqual(32);
  // The scene's distinct images stay at the cap `src/render/scene.ts` sets (40).
  const images = new Set([...BA_DAN_SCENE.ground, ...BA_DAN_SCENE.scenery].map((p) => p.url));
  expect(images.size).toBe(BA_DAN_IMAGE_COUNT);
  expect(images.size).toBeLessThanOrEqual(40);
});

it('lays the ground plates over the whole pan box with no gap and a 2 px overlap at every join', () => {
  // The pan box is 3000 x 1600 world px from (-200, -100); the painting is 1.5 px to the world pixel.
  const { scale, origin, size } = BA_DAN_PAINTING;
  expect(size.width).toBe(3000 * scale);
  // The last of twelve 1024-row regions ends at row 2401: 1600.67 world px, over the 1600 of the pan box.
  expect(size.height).toBe(2401);
  expect(size.height).toBeGreaterThanOrEqual(1600 * scale);
  const covered = new Uint8Array(size.width * size.height);
  for (const [index, x, y, width, height] of BA_DAN_GROUND_PLATES) {
    const plate = BA_DAN_SCENE.ground[index];
    expect(plate?.url).toBe(`art/maps/ba-dan-scene/ground-${String(index).padStart(2, '0')}.webp`);
    expect(plate?.x).toBe(origin.x + x / scale);
    expect(plate?.y).toBe(origin.y + y / scale);
    expect(plate?.width).toBe(width / scale);
    expect(plate?.height).toBe(height / scale);
    // A plate starts on a whole world pixel and fits the 2048 texture every iPad takes.
    expect(Number.isInteger(plate?.x) && Number.isInteger(plate?.y), `plate ${index}`).toBe(true);
    expect(Math.max(width, height)).toBeLessThanOrEqual(2048);
    for (let row = y; row < y + height; row++)
      for (let col = x; col < x + width; col++)
        covered[row * size.width + col] = (covered[row * size.width + col] ?? 0) + 1;
  }
  expect(covered.filter((n) => n === 0).length, 'painting pixels no plate covers').toBe(0);
  const doubled = covered.filter((n) => n > 1).length;
  // Every join is two px wide: 3 vertical joins of full height and 2 horizontal ones of full width,
  // their crossings counted once (each crossing is 2 x 2 and four plates thick).
  expect(doubled).toBeGreaterThan(0);
  expect(covered.reduce((most, n) => Math.max(most, n), 0)).toBeLessThanOrEqual(4);
});

it('keeps the uprights to the pieces a figure can stand behind, and the rest in the ground', () => {
  // `Village.needed` in `scripts/art/ba-dan-regions/regions.py` decides this from the map's walkable cells
  // and the geometry; `ba-dan-regions.test.ts` recomputes it. It leaves 29 of the 78 pieces the painting
  // had in the ground: the four backdrops and six wall strips (not listed here at all, they only paint),
  // the six terrace planters outside the board, the frame's tree clumps, two far trees of the west rim
  // and one fence.
  const ground = BA_DAN_STANDING.filter((piece) => !BA_DAN_UPRIGHTS[piece.id]).map((p) => p.id);
  expect(ground.sort()).toEqual(
    [
      'north-terrace-0',
      'north-terrace-1',
      'north-terrace-2',
      'north-terrace-3',
      'north-terrace-4',
      'north-terrace-5',
      'tree-0-6',
      'tree-0-10',
      'd13',
      'tree-c0',
      'tree-c1',
      ...[8, 9, 10, 11, 12, 13, 14, 15].map((i) => `tree-c${i}`),
    ].sort(),
  );
  // The backdrops and wall strips were never in the list of things a figure stands behind: they are not
  // scenery any more, only painting.
  expect(BA_DAN_SCENE.scenery.some((piece) => /backdrop|^wall-/.test(piece.id))).toBe(false);
  expect(BA_DAN_SCENE.scenery).toHaveLength(Object.keys(BA_DAN_UPRIGHTS).length);
  expect(BA_DAN_SCENE.scenery).toHaveLength(49);
  expect(BA_DAN_STANDING).toHaveLength(49 + ground.length);
});

interface Frozen {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: { x: number; y: number };
  footprint: { x: number; y: number }[];
  fade: boolean;
  exterior: boolean;
}
const frozen = (
  JSON.parse(readFileSync('art/source/ba-dan-regions/geometry/scene.json', 'utf8')) as {
    pieces: Frozen[];
  }
).pieces;

it('keeps every upright where the frozen geometry put it: same footprint, depth key and flags', () => {
  const byId = new Map(frozen.map((piece) => [piece.id, piece]));
  expect(frozen).toHaveLength(78);
  // The 68 that stand: the frozen 78 less the four backdrops and six wall strips, which only paint.
  expect(BA_DAN_STANDING).toHaveLength(68);
  for (const piece of BA_DAN_STANDING) {
    const was = byId.get(piece.id);
    expect(was, piece.id).toBeDefined();
    if (!was) continue;
    expect(piece.footprint, `${piece.id} footprint`).toEqual(was.footprint);
    expect(piece.depth, `${piece.id} depth`).toEqual(was.depth);
    expect(piece.fadeWhenOccluding === true, `${piece.id} fade`).toBe(was.fade);
    expect(piece.exterior === true, `${piece.id} exterior`).toBe(was.exterior);
  }
  // Draw order is the old one with the pieces now in the ground taken out.
  expect(BA_DAN_STANDING.map((p) => p.id)).toEqual(
    frozen.map((p) => p.id).filter((id) => !/backdrop|^wall-\d$/.test(id)),
  );
});

it("draws each upright inside its frozen rectangle, to within the painting's pixel grid", () => {
  const byId = new Map(frozen.map((piece) => [piece.id, piece]));
  const slack = 1 / BA_DAN_PAINTING.scale;
  for (const piece of BA_DAN_SCENE.scenery) {
    const was = byId.get(piece.id)!;
    expect(piece.x, `${piece.id} left`).toBeGreaterThanOrEqual(was.x - slack);
    expect(piece.y, `${piece.id} top`).toBeGreaterThanOrEqual(was.y - slack);
    expect(piece.x + piece.width, `${piece.id} right`).toBeLessThanOrEqual(
      was.x + was.width + slack,
    );
    expect(piece.y + piece.height, `${piece.id} bottom`).toBeLessThanOrEqual(
      was.y + was.height + slack,
    );
    expect(piece.url).toMatch(/^art\/maps\/ba-dan-scene\/uprights-\d\.webp$/);
    // One painting pixel per 2/3 world pixel: the sprite is drawn 1:1 on screen at the game's zoom.
    expect(piece.sourceRect?.width).toBeCloseTo(piece.width * BA_DAN_PAINTING.scale, 9);
    expect(piece.sourceRect?.height).toBeCloseTo(piece.height * BA_DAN_PAINTING.scale, 9);
  }
});

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

it('covers every blocked tree cell with a footprint of something the painting holds', () => {
  for (const [y, row] of BA_DAN_VILLAGE.rows.entries())
    for (const [x, tile] of [...row].entries()) {
      if (tile !== 'T') continue;
      expect(
        BA_DAN_STANDING.some((piece) =>
          piece.footprint.some((cell) => cell.x === x && cell.y === y),
        ),
        `Blocked tree cell ${x},${y} has no footprint`,
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
  // A tile east of the south-west house's step column: at x 10 its west end tucked under the plinth's
  // corner (the house sorts in front), so the planter read as cut by the terrace.
  expect(BA_DAN_COURTYARD_PROPS.find(({ id }) => id === 'west-planter')).toMatchObject({
    x: 11,
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
  if (!houseDepth || !piece) throw new Error('Missing south-east house or planter');
  for (const cell of BA_DAN_SOUTHEAST_PLANTER) {
    // `rows` already blocks the strip; the house art stops at x 16.
    expect(tileAt(grid, cell)?.blocked).toBe(true);
    expect(scenery[house]?.footprint).not.toContainEqual(cell);
  }
  // The true 1x2 piece is one slice, no mirror.
  expect(piece.footprint).toEqual([...BA_DAN_SOUTHEAST_PLANTER]);
  expect(piece.flip).toBeUndefined();
  expect(scenery.some((p) => p.id === 'southeast-planter-far')).toBe(false);
  // It paints after the house and sorts at its far cell, so a figure at (18,10) or
  // (17,12) stands in front of it.
  expect(planter).toBeGreaterThan(house);
  expect(piece.depth).toEqual({ x: 17.5, y: 11.5 });
  // Its plinth's front corner is the strip's (18,12), exactly: the lowest opaque pixel of the sprite is
  // the corner, to within the two painting pixels the regional gate allows.
  const corner = { x: 1024 + (18 - 12) * 64, y: (18 + 12) * 32 };
  let low = { x: 0, y: -Infinity };
  for (let y = piece.y; y < piece.y + piece.height; y += 1 / BA_DAN_PAINTING.scale)
    for (let x = piece.x; x < piece.x + piece.width; x += 1 / BA_DAN_PAINTING.scale)
      if (alphaAtScenePixel(piece, x, y) > 128 && y > low.y) low = { x, y };
  expect(Math.abs(low.y - corner.y), 'front corner height').toBeLessThanOrEqual(2);
  expect(Math.abs(low.x - corner.x), 'front corner column').toBeLessThanOrEqual(2);
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
  // One tile wide over the canal's column, split at the near rail so a figure can stand on the deck.
  expect(bridge).toMatchObject({ footprint: [BA_DAN_CANAL_BRIDGE], depth: { x: 9.5, y: 6.25 } });
  expect(bridgeFront).toMatchObject({
    footprint: [BA_DAN_CANAL_BRIDGE],
    depth: { x: 9.5, y: 6.75 },
  });
  expect(bridge?.fadeWhenOccluding).toBeUndefined();
  expect(bridgeFront?.fadeWhenOccluding).toBeUndefined();
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
      fadeWhenOccluding: true,
    });
  }
  for (const pos of [
    // A resident-bound NpcDef has no `pos`: its tiles are its resident's anchors.
    ...map.npcs.flatMap((npc) => npcStandTiles(CONTENT_BUNDLE, map.id, npc)),
    { x: 10, y: 3 },
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

it('draws nothing over the exit, the ford bank or the south road mouth', () => {
  // A walkable tile's ground diamond, shrunk to its inner half: a figure's feet. A tall piece (a house, a
  // tree: they fade when a figure is behind them) may reach over tiles behind it, as any oblique building
  // does, but the exit and the mouths must be clear of every piece. Every upright's alpha is its geometry's
  // silhouette (`ba-dan-regions.test.ts`), so anything the road shows today it showed before the painting.
  const feet = (x: number, y: number) =>
    [
      { x: 0, y: 0 },
      { x: -16, y: 0 },
      { x: 16, y: 0 },
      { x: 0, y: -8 },
      { x: 0, y: 8 },
    ].map((d) => ({ x: 1024 + (x - y) * 64 + d.x, y: (x + y + 1) * 32 + d.y }));
  const mouths = [
    { x: 23, y: 7 }, // the exit
    { x: 23, y: 8 },
    { x: 1, y: 7 }, // the ford's bank
    { x: 1, y: 8 },
    ...[18, 19, 20].map((x) => ({ x, y: 15 })), // the south road's mouth
  ];
  for (const piece of BA_DAN_SCENE.scenery)
    for (const cell of mouths)
      for (const at of feet(cell.x, cell.y))
        expect(
          alphaAtScenePixel(piece, at.x, at.y),
          `${piece.id} is drawn over the mouth at ${cell.x},${cell.y}`,
        ).toBeLessThan(128);
});

it('keeps the east court canopy clear of the market frontage and gate watch', () => {
  expect(BA_DAN_COURT_TREES).toContainEqual({ x: 21, y: 2 });
  expect(BA_DAN_COURT_TREES).not.toContainEqual({ x: 17, y: 5 });
  const east = BA_DAN_SCENE.scenery.find((piece) => piece.id === 'tree-21-2');
  expect(east).toMatchObject({
    footprint: [{ x: 21, y: 2 }],
    depth: { x: 21, y: 2 },
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
  const terrace = BA_DAN_STANDING.filter((piece) => piece.id.startsWith('north-terrace-'));
  expect(terrace.at(-1)?.footprint[0]).toMatchObject({ x: 14, y: -1 });
  // No tree's cells include the river path's mouth.
  for (const x of [18, 19, 20])
    expect(
      BA_DAN_STANDING.some((piece) => piece.footprint.some((c) => c.x === x && c.y === 15)),
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
    footprint: [{ x: 21, y: 15 }],
  });
});

it('raises chimney smoke from the mouth of a dwelling chimney', () => {
  const chimneys = BA_DAN_SCENE.chimneys ?? [];
  expect(chimneys).toHaveLength(2);
  for (const at of chimneys) {
    // The oblique camera's scene pixel for the ground point.
    const px = 1024 + (at.x - at.y) * 64;
    const py = (at.x + at.y) * 32;
    const house = BA_DAN_SCENE.scenery.find(
      (piece) =>
        (piece.id === 'north-house' || piece.id === 'southwest-house') &&
        px >= piece.x &&
        px < piece.x + piece.width &&
        py >= piece.y &&
        py < piece.y + piece.height,
    );
    expect(house, `chimney at ${px},${py} is on a dwelling`).toBeDefined();
    if (!house?.sourceRect) continue;
    const page = pages[Number(/uprights-(\d+)\.webp$/.exec(house.url)?.[1])];
    if (!page) throw new Error('no page');
    const rect = house.sourceRect;
    const u = Math.floor(((px - house.x) / house.width) * rect.width);
    const v = Math.floor(((py - house.y) / house.height) * rect.height);
    const at4 = (x: number, y: number) => ((rect.y + y) * page.width + rect.x + x) * 4;
    const alpha = (x: number, y: number) => page.data[at4(x, y) + 3] ?? 0;
    // On the chimney: painted, in the sprite's top band, with the mouth at the stack's top.
    expect(alpha(u, v), `${house.id} chimney pixel`).toBeGreaterThan(200);
    expect(v / rect.height).toBeLessThan(0.1);
    let top = v;
    while (top > 0 && alpha(u, top - 1) > 128) top--;
    expect(v - top, `${house.id} the mouth is at the chimney's top`).toBeLessThanOrEqual(18);
  }
});

it('sorts each house against the figures beside it: in front east and south, behind north and west', () => {
  // A house sprite is one piece with one depth key (its yard lies on the footprint's west tiles), and a figure
  // is in front of a piece when its ground depth, x + y + 1 for the tile it stands on, is level with or past it.
  // Every walkable tile whose figure the sprite would paint over must be one the house stands in front of.
  const houses = BA_DAN_SCENE.scenery.filter((piece) => piece.id.endsWith('-house'));
  expect(houses).toHaveLength(4);
  const blocked = (x: number, y: number) => {
    const ch = BA_DAN_VILLAGE.rows[y]?.[x];
    return ch === undefined || BA_DAN_VILLAGE.legend[ch]?.blocked === true;
  };
  for (const house of houses) {
    const xs = house.footprint.map((c) => c.x);
    const ys = house.footprint.map((c) => c.y);
    const [x0, x1] = [Math.min(...xs), Math.max(...xs) + 1];
    const [y0, y1] = [Math.min(...ys), Math.max(...ys) + 1];
    const key = house.depth.x + house.depth.y;
    // The lane cell below the footprint's south-west corner, the yard's gate end.
    expect(key, house.id).toBe(x0 + y1 + 1);
    let judged = 0;
    for (let cy = y0 - 2; cy <= y1 + 1; cy++)
      for (let cx = x0 - 2; cx <= x1 + 1; cx++) {
        const inside = cx >= x0 && cx < x1 && cy >= y0 && cy < y1;
        // Cells inside the footprint are the door's step and the gates' lanes: no routine or stand point uses them.
        if (inside || blocked(cx, cy)) continue;
        // A figure is about 44 world px wide and 86 tall, its feet on the tile's centre.
        const fx = 1024 + (cx - cy) * 64;
        const fy = (cx + cy + 1) * 32;
        let covered = 0;
        for (let py = fy - 86; py < fy; py += 2)
          for (let px = fx - 22; px < fx + 22; px += 2)
            if (alphaAtScenePixel(house, px, py) > 128) covered++;
        if (covered === 0) continue;
        judged++;
        const front = cx >= x1 || cy >= y1;
        const level = cx + cy + 1 >= key;
        expect(
          level,
          `${house.id}: a figure at ${cx},${cy} is ${front ? 'behind' : 'in front of'} it`,
        ).toBe(front);
      }
    expect(judged, `${house.id} judged cells`).toBeGreaterThan(8);
  }
});

it('keeps the village an explore-only map, so its painted pools are not changed by a fight today', () => {
  // A complete scene never covers a pool that goes dry (that is `paintedWaterIsDry`, partial scenes
  // only); this records why nothing reaches that path: no encounter is staged here.
  expect(ENCOUNTERS.filter((encounter) => encounter.mapId === BA_DAN_VILLAGE.id)).toEqual([]);
});

it('draws every tree from the painting and none with the runtime contact ring', () => {
  const trees = BA_DAN_SCENE.scenery.filter((piece) => piece.id.startsWith('tree-'));
  // 33 tree entries (16 clumps, 17 alone); the 12 that no figure stands behind are in the ground.
  expect(BA_DAN_STANDING.filter((piece) => piece.id.startsWith('tree-'))).toHaveLength(33);
  expect(trees).toHaveLength(33 - 12);
  for (const piece of trees) {
    // No tree carries the runtime's whole-tile footprint ring (a slab on the lawn beside a trunk, an
    // orphan where a crown is drawn off its cells): the painting seats each trunk itself.
    expect(piece.contactShadow, `${piece.id} contact shadow`).toBe(false);
    expect(piece.fadeWhenOccluding, piece.id).toBe(true);
  }
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
  // Every piece of dressing stands on its cells, none on the courtyard's.
  for (const [i, [, x, y]] of BA_DAN_DRESSING.entries()) {
    const id = `d${i}`;
    const piece = BA_DAN_STANDING.find((p) => p.id === id);
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
  // (9,3) is Gao's plinth and steps; the lane reaches his door at (10,3) from (10,4).
  for (const y of [4, 5]) for (const x of [9, 10]) expect(open(x, y), `lane ${x},${y}`).toBe(true);
  expect(open(10, 3), 'lane 10,3').toBe(true);
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

it("leaves no walkable tile under a house's painted plinth, steps, wall or yard", () => {
  // The painted pieces' own regions (`art/source/ba-dan-true/guides/pieces.json`), local to the footprint's
  // north-west corner: the yard fills x 0..yard, the plinth runs on to the footprint's east edge over its
  // whole depth, the wall stands on the plinth and the steps rise in the footprint's last column. A tile
  // whose centre is inside any of them is one a figure would stand in the building. The tile in front of
  // the steps (the door's `faces_tile`) is the one place to stand, and must stay open.
  type Rect = readonly [number, number, number, number];
  interface Piece {
    scene_entry: string;
    footprint_origin_map: [number, number];
    footprint_tiles: [number, number];
    door: { faces_tile: [number, number]; steps_x: Rect; steps_y: Rect };
    geo: { wx0: number; wx1: number; wy0: number; wy1: number };
    yard: { x: [number, number] };
  }
  const guides = JSON.parse(
    readFileSync('art/source/ba-dan-true/guides/pieces.json', 'utf8'),
  ) as Record<string, Piece>;
  const houses = Object.values(guides).filter((piece) =>
    BA_DAN_STANDING.some((s) => s.id === piece.scene_entry && s.id.endsWith('-house')),
  );
  expect(houses).toHaveLength(4);
  const map = BA_DAN_VILLAGE;
  const grid = buildGrid(map);
  const start = map.partySpawns[0];
  if (!start) throw new Error('Village has no spawn');
  const paths = reachable({ grid, blocked: new Set(), surfaces: new Map(), size: 1 }, start, 1000);
  const inside = (r: Rect, x: number, y: number) => x > r[0] && x < r[1] && y > r[2] && y < r[3];
  for (const piece of houses) {
    const [ox, oy] = piece.footprint_origin_map;
    const [w, d] = piece.footprint_tiles;
    const { wx0, wx1, wy0, wy1 } = piece.geo;
    const regions: Record<string, Rect> = {
      yard: [0, piece.yard.x[1], 0, d],
      plinth: [piece.yard.x[1], w, 0, d],
      wall: [wx0, wx1, wy0, wy1],
      steps: [
        piece.door.steps_x[0] ?? 0,
        piece.door.steps_x[1] ?? 0,
        piece.door.steps_y[0] ?? 0,
        piece.door.steps_y[1] ?? 0,
      ],
    };
    const footprint = BA_DAN_STANDING.find((s) => s.id === piece.scene_entry)?.footprint ?? [];
    expect(footprint, piece.scene_entry).toHaveLength(w * d);
    expect(footprint[0], piece.scene_entry).toEqual({ x: ox, y: oy });
    for (let y = oy - 1; y <= oy + d; y++)
      for (let x = ox - 1; x <= ox + w; x++) {
        if (tileAt(grid, { x, y })?.blocked !== false) continue;
        for (const [name, rect] of Object.entries(regions))
          expect(
            inside(rect, x + 0.5 - ox, y + 0.5 - oy),
            `${piece.scene_entry}: walkable (${x},${y}) is under its ${name}`,
          ).toBe(false);
      }
    const [fx, fy] = piece.door.faces_tile;
    const foot = { x: ox + fx, y: oy + fy };
    expect(tileAt(grid, foot)?.blocked, `${piece.scene_entry} door foot`).toBe(false);
    expect(paths.has(posKey(foot)), `${piece.scene_entry} door foot reachable`).toBe(true);
  }
});
