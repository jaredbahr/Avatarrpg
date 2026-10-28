import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import decode, { init } from '@jsquash/webp/decode.js';
import { beforeAll, expect, it, vi } from 'vitest';
import { buildGrid, tileAt } from '../../core/rules/grid';
import type { SceneScenery } from '../../core/types';
import { partyScale } from '../../app/anim/actorScale';
import { npcPresentationScale } from '../../app/scenes/exploreMarkerScale';
import { probeLifts } from '../../render/scene';
import { BA_DAN_VILLAGE } from '../maps/village';
import { BA_DAN_SCENE } from './baDan';
import { BA_DAN_UPRIGHT_PAGES } from './baDan.art';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 30_000 });

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

function alphaAt(piece: SceneScenery, x: number, y: number): number {
  const rect = piece.sourceRect;
  const page = pages[Number(/uprights-(\d+)\.webp$/.exec(piece.url)?.[1])];
  if (!rect || !page) throw new Error(`${piece.id} has no sprite`);
  const u = Math.floor(((x - piece.x) / piece.width) * rect.width);
  const v = Math.floor(((y - piece.y) / piece.height) * rect.height);
  if (u < 0 || v < 0 || u >= rect.width || v >= rect.height) return 0;
  return page.data[((rect.y + v) * page.width + rect.x + u) * 4 + 3] ?? 0;
}

/** A figure is about 44 world px wide and 86 tall, its feet on the tile's centre (as the house test). */
function covered(piece: SceneScenery, cx: number, cy: number): number {
  const fx = 1024 + (cx - cy) * 64;
  const fy = (cx + cy + 1) * 32;
  let hit = 0;
  let all = 0;
  for (let py = fy - 86; py < fy; py += 2)
    for (let px = fx - 22; px < fx + 22; px += 2) {
      all++;
      if (alphaAt(piece, px, py) > 128) hit++;
    }
  return hit / all;
}

/**
 * Whether the piece's footprint lies on the line of sight through the figure: ahead of it (nearer the
 * camera, so it can hide the figure) or behind it. The camera looks along (-1,-1); screen x is x - y, so
 * a body about a third of a tile either side of its diagonal reaches cells on the neighbouring diagonals.
 */
function onSight(piece: SceneScenery, cx: number, cy: number): 'ahead' | 'behind' | null {
  let seen: 'ahead' | 'behind' | null = null;
  for (const cell of piece.footprint) {
    if (Math.abs(cell.x - cell.y - (cx - cy)) > 1) continue;
    const ahead = cell.x + cell.y > cx + cy;
    if (ahead) return 'ahead';
    if (cell.x + cell.y < cx + cy) seen = 'behind';
  }
  return seen;
}

export interface Offence {
  readonly piece: string;
  readonly tile: string;
  readonly kind: 'in-front-of-nearer' | 'behind-farther';
  readonly covered: number;
}

/** Every walkable tile against every upright: a figure drawn over a nearer piece, or under a farther one. */
export function sweep(): Offence[] {
  const grid = buildGrid(BA_DAN_VILLAGE);
  const out: Offence[] = [];
  for (let cy = 0; cy < BA_DAN_VILLAGE.height; cy++)
    for (let cx = 0; cx < BA_DAN_VILLAGE.width; cx++) {
      const tile = tileAt(grid, { x: cx, y: cy });
      if (!tile || tile.blocked) continue;
      for (const piece of BA_DAN_SCENE.scenery) {
        if (piece.exterior) continue;
        const sight = onSight(piece, cx, cy);
        if (!sight) continue;
        const drawnInFront = cx + 0.5 + cy + 0.5 >= piece.depth.x + piece.depth.y;
        const kind =
          sight === 'ahead' && drawnInFront
            ? 'in-front-of-nearer'
            : sight === 'behind' && !drawnInFront
              ? 'behind-farther'
              : null;
        if (!kind) continue;
        const fraction = covered(piece, cx, cy);
        if (fraction > 0)
          out.push({ piece: piece.id, tile: `${cx},${cy}`, kind, covered: fraction });
      }
    }
  return out;
}

/**
 * The north-east rim clump is one cut sprite containing trees at incompatible depths, and two neighbouring
 * trees share frozen keys with overlapping uprights. Those ties cannot be corrected independently without
 * changing the painting's scenery stack. Listed so a new offender cannot hide among the six known cases.
 */
const KNOWN = new Set([
  // Raising this tied tree alone would put its hidden-fill pixels over tree-c3's foreground crown.
  'tree-21-2@21,1:in-front-of-nearer',
  'tree-c3@20,1:behind-farther',
  'tree-c3@21,1:in-front-of-nearer',
  'tree-c3@22,2:in-front-of-nearer',
  // Its three equal-depth neighbours overlap it, so an actor-only override cannot preserve the painting.
  'tree-22-14@22,13:in-front-of-nearer',
  'tree-22-14@21,14:in-front-of-nearer',
]);
const SMALL = 0.04;

/** Every scale an actor is drawn at in Ba Dan exploration: the party, then each NPC and resident sprite. */
export const ACTOR_SCALES: readonly number[] = [
  ...new Set([
    partyScale(BA_DAN_VILLAGE.projection),
    ...BA_DAN_VILLAGE.npcs.map((npc) =>
      npcPresentationScale(npc.sprite, BA_DAN_VILLAGE.projection),
    ),
  ]),
].sort();

/** Unscaled lifts the renderer probes (`render/scene.ts`): all three, or the head's alone. */
const probesOf = probeLifts;

/**
 * Where a piece that fades veils a figure of this scale standing behind it although the figure's head
 * (probe 56 x scale, as `sceneryOpacity` multiplies) clears its silhouette: the ground art holds the same
 * building, so the veil only draws the figure on its roof.
 */
export function fadeSweep(
  scale = 1,
  probes: (piece: SceneScenery) => readonly number[] = probesOf,
): string[] {
  const grid = buildGrid(BA_DAN_VILLAGE);
  const out: string[] = [];
  for (let cy = 0; cy < BA_DAN_VILLAGE.height; cy++)
    for (let cx = 0; cx < BA_DAN_VILLAGE.width; cx++) {
      const tile = tileAt(grid, { x: cx, y: cy });
      if (!tile || tile.blocked) continue;
      const fx = 1024 + (cx - cy) * 64;
      const fy = (cx + cy + 1) * 32;
      for (const piece of BA_DAN_SCENE.scenery) {
        if (!piece.fadeWhenOccluding || piece.exterior) continue;
        if (cx + cy + 1 >= piece.depth.x + piece.depth.y) continue;
        const hit = (lift: number) => alphaAt(piece, fx, fy - lift * scale) > 64;
        if (probes(piece).some(hit) && !hit(56)) out.push(`${piece.id}@${cx},${cy}`);
      }
    }
  return out;
}

it('draws no figure over a nearer upright or under a farther one, bar the frozen tree keys', () => {
  const all = sweep();
  if (process.env.DEPTH_SWEEP_OUT)
    writeFileSync(
      process.env.DEPTH_SWEEP_OUT,
      JSON.stringify(
        {
          all,
          fadeBefore: ACTOR_SCALES.map((k) => fadeSweep(k, () => [8, 32, 56])),
          fadeAfter: ACTOR_SCALES.map((k) => fadeSweep(k)),
        },
        null,
        1,
      ),
    );
  const key = (o: Offence) => `${o.piece}@${o.tile}:${o.kind}`;
  const bad = all.filter((o) => o.covered > SMALL && !KNOWN.has(key(o)));
  expect(bad.map((o) => `${key(o)} ${(o.covered * 100).toFixed(0)}%`)).toEqual([]);
  // The known cases are still there: a fix to one has to leave this list.
  const seen = new Set(all.filter((o) => o.covered > SMALL).map(key));
  expect([...KNOWN].filter((k) => !seen.has(k))).toEqual([]);
});

it('uses the actor scales the explore scene draws', () => {
  // The figures at 1 (ADR 0094), Hanru's painted placeholder level with them, the tea station's 1.5.
  expect(ACTOR_SCALES.map((k) => Math.round(k * 100) / 100)).toEqual([1, 1.12, 1.5]);
});

it.each(ACTOR_SCALES)(
  'veils no figure whose head is clear of the piece that fades over it, at scale %s',
  (scale) => {
    expect(fadeSweep(scale)).toEqual([]);
  },
);

it('is not vacuous: the old three-probe rule veils the woodcutter roof corner at party scale', () => {
  expect(fadeSweep(1.25, () => [8, 32, 56])).toContain('southwest-house@7,8');
});
