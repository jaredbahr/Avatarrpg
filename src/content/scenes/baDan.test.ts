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
  BA_DAN_NORTH_TERRACE,
  BA_DAN_RIM_CANOPIES,
  BA_DAN_APRON_MAP,
  BA_DAN_APRON_PIECES,
  BA_DAN_EDGE_WATER,
  BA_DAN_EXTERIOR_APRON,
  BA_DAN_PLANTER_CUT,
  BA_DAN_SCENE,
  BA_DAN_SOUTHEAST_PLANTER,
  BA_DAN_TEXTURES,
} from './baDan';
import { buildGrid, reachable, posKey, tileAt } from '../../core/rules/grid';
import { CONTENT_BUNDLE } from '../index';
import { npcStandTiles } from '../schemas';

// Decoding WebP plates is cheap alone and slow on a busy machine; ci:local timed out the
// 5 s default once. Headroom here, not a raised global timeout.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

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
  // The apron follows every local piece; only the edge water, which runs on
  // past the rim into the apron's fade, is painted over it.
  const edges = BA_DAN_EDGE_WATER.length;
  expect(BA_DAN_SCENE.ground.slice(-BA_DAN_APRON_PIECES.length - edges, -edges)).toEqual([
    ...BA_DAN_APRON_PIECES,
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
    /(?:courtyard|western-approach|northwest-lawn|north-house-court|east-gate-approach|south-house-court|northeast-lawn|southwest-lawn)-ground\.webp$/.test(
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
  const x = Math.round(1024 + (pos.x - pos.y) * 64 - piece.x);
  const y = Math.round((pos.x + pos.y) * 32 - piece.y);
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
  const x = Math.round(1024 + (pos.x - pos.y) * 64 - piece.x);
  const y = Math.round((pos.x + pos.y) * 32 - piece.y);
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

it("keeps Gao's display by his shopfront and the moved west planter in open court", () => {
  expect(BA_DAN_COURTYARD_PROPS.find(({ id }) => id === 'gao-display')).toMatchObject({
    x: 7,
    y: 4,
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
  const houseBox = scenery[house];
  const piece = scenery[planter];
  const far = scenery.find((p) => p.id === 'southeast-planter-far');
  const planterTexture = BA_DAN_TEXTURES['low-planter'];
  if (!houseDepth || !houseBox || !piece || !far)
    throw new Error('Missing south-east house or planter');
  for (const cell of BA_DAN_SOUTHEAST_PLANTER) {
    // `rows` already blocks the strip; the house art stops at x 16.
    expect(tileAt(grid, cell)?.blocked).toBe(true);
    expect(scenery[house]?.footprint).not.toContainEqual(cell);
  }
  for (const slice of [piece, far])
    expect(slice).toMatchObject({
      url: 'art/maps/ba-dan-scene/low-planter.webp',
      footprint: [...BA_DAN_SOUTHEAST_PLANTER],
      flip: true,
      height: (192 * planterTexture.height) / planterTexture.width,
    });
  // Ties the house's depth and paints after it, like the other frontage.
  expect(piece.depth.x + piece.depth.y).toBe(houseDepth.x + houseDepth.y);
  expect(planter).toBeGreaterThan(house);
  // Mirrored, its front corner is (18,12): 0.325 of the whole 192 from its left.
  expect(piece.x + 192 * 0.325).toBeCloseTo(1024 + (18 - 12) * 64);
  expect(piece.y + piece.height).toBe((18 + 12) * 32);
  // The far end's slice sorts level with (18,10), so a figure there is in front.
  expect(far.depth.x + far.depth.y).toBe(18.5 + 10.5);
  // The two slices are the whole planter, the near one a texel over the join,
  // and together they crop the whole texture.
  expect(far.x + far.width).toBeCloseTo(piece.x + 192);
  expect(piece.x + piece.width - far.x).toBeCloseTo(192 / planterTexture.width);
  expect(far.sourceRect).toEqual({
    x: 0,
    y: 0,
    width: BA_DAN_PLANTER_CUT,
    height: planterTexture.height,
  });
  expect(piece.sourceRect).toEqual({
    x: BA_DAN_PLANTER_CUT - 1,
    y: 0,
    width: planterTexture.width - BA_DAN_PLANTER_CUT + 1,
    height: planterTexture.height,
  });
  // Shallower than the house, the far slice must lie clear of the house's
  // image, or the house (its awning post) would paint over it.
  expect(far.x).toBeGreaterThanOrEqual(houseBox.x + houseBox.width);
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
  const bridgeTexture = BA_DAN_TEXTURES['canal-bridge'];
  const bridgeHeight = (192 * bridgeTexture.height) / bridgeTexture.width;
  expect(bridge).toMatchObject({
    footprint: [BA_DAN_CANAL_BRIDGE],
    width: 192,
    height: bridgeHeight,
  });
  // The deck's centre sits on the crossing diamond's centre.
  expect(bridge?.x).toBe(1120);
  expect(bridge?.y).toBe((9 + 6 + 1) * 32 - bridgeHeight / 2);
  expect(bridge?.depth).toEqual({ x: 9.5, y: 6.25 });
  expect(bridgeFront).toMatchObject({
    url: 'art/maps/ba-dan-scene/canal-bridge-front.webp',
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
    for (let channel = 0; channel < 3; channel++)
      expect(
        Math.abs((westernRgb[channel] ?? 0) - (courtyardRgb[channel] ?? 0)),
        `RGB join ${pos.x},${pos.y}, channel ${channel}`,
      ).toBeLessThanOrEqual(4);
  }
  for (const y of [7.5, 8.5])
    for (const x of [5.05, 5.25, 5.5])
      expect(alphaAtWorld(western, { x, y }), `opaque fractional join ${x},${y}`).toBeGreaterThan(
        240,
      );
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
  expect(BA_DAN_RIM_CANOPIES).not.toContainEqual(expect.objectContaining({ x: 21, y: 15 }));
  expect(BA_DAN_RIM_CANOPIES).not.toContainEqual(expect.objectContaining({ x: 23, y: 12 }));
  expect(BA_DAN_RIM_CANOPIES).not.toContainEqual(expect.objectContaining({ x: 23, y: 9 }));
  expect(BA_DAN_RIM_CANOPIES).not.toContainEqual(expect.objectContaining({ x: 23, y: 5 }));

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
  const bytes = readFileSync('public/art/maps/ba-dan-scene/dwelling.webp');
  const roof = await decode(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  for (const at of chimneys) {
    // The oblique camera's scene pixel for the ground point.
    const px = 1024 + (at.x - at.y) * 64;
    const py = (at.x + at.y) * 32;
    const house = BA_DAN_SCENE.scenery.find(
      (piece) =>
        piece.url.endsWith('dwelling.webp') &&
        px >= piece.x &&
        px < piece.x + piece.width &&
        py >= piece.y &&
        py < piece.y + piece.height,
    );
    expect(house, `chimney at ${px},${py} is on a dwelling`).toBeDefined();
    if (!house) continue;
    const u = Math.floor(((px - house.x) / house.width) * roof.width);
    const v = Math.floor(((py - house.y) / house.height) * roof.height);
    // On the roof itself, in its upper band, not in the clear air round it.
    const at4 = (v * roof.width + u) * 4;
    expect(roof.data[at4 + 3], `${house.id} roof pixel`).toBeGreaterThan(200);
    expect(v / roof.height).toBeLessThan(0.2);
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
