/**
 * The board's decor: everything drawn on a tile above the ground and under the
 * units, in the art bible's ink-and-two-tone hand.
 *
 * Cliff faces where a ledge steps down, a lit rim round a plateau, a canopy
 * for every tree, a roofed mass for a wall run, a floor that falls away into
 * a pit, pebbles for cover, and a sparse scatter of tufts, stones and cracks
 * so no two tiles are the same flat colour. Every placement comes from
 * `tileNoise`, so a tile always draws the same and the board never shimmers.
 *
 * One painter serves both backends: Canvas 2D draws it straight onto the
 * board, WebGL bakes it into chunk textures (`decorSheets.ts`). That is what
 * keeps elevation, walls and cover reading the same on each (ADR 0002).
 */

import type { Tile, Vec2 } from '../../core/types';
import type { Edges, SeamMaterial, TileRelief } from '../geometry/board';
import { isCanopy, seamMaterial } from '../geometry/board';
import { SURFACE_STYLES, TERRAIN_STYLES } from '../palettes';
import { paintTerrain } from './tiles';
import type { Box, Ctx } from './shapes';
import { circle, ellipse, tileNoise } from './shapes';

const INK = '#1b1410';

/** `#rrggbb` mixed toward white (t > 0) or black (t < 0) by |t|. */
export function shade(hex: string, t: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const channel = (shift: number): number => {
    const v = (n >> shift) & 255;
    const target = t >= 0 ? 255 : 0;
    return Math.round(v + (target - v) * Math.abs(t));
  };
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

/** Everything on one tile. `relief` is that tile's entry from `boardRelief`, if any. */
export function paintTileDecor(
  ctx: Ctx,
  box: Box,
  tile: Tile,
  pos: Vec2,
  relief: TileRelief | undefined,
): void {
  if (tile.terrain === 'pit') paintPit(ctx, box, relief?.solid ?? null);
  else if (!tile.blocked) paintDecals(ctx, box, tile, pos);

  paintTileSeams(ctx, box, pos, seamMaterial(tile), relief?.seams ?? null);
  paintTileRelief(ctx, box, pos, relief);

  if (tile.cover && !tile.blocked) paintCoverStones(ctx, box, pos);

  if (tile.blocked) {
    if (isCanopy(tile)) paintCanopy(ctx, box, pos);
    else if (tile.terrain !== 'pit') paintSolidMass(ctx, box, tile, pos, relief?.solid ?? null);
  }
}

/**
 * Where two ground materials meet, the softer neighbour bleeds into the
 * harder one in a ragged wedge, with a contact shade under it and its own
 * litter: grass tufts, stone chips, sand grit, or the stones and reeds of a
 * bank. That is what keeps a road, a paving edge or a pond from ending on a
 * bare polygon line.
 *
 * Everything stays inside the tile's own box, because the WebGL decor bake
 * draws one chunk at a time and a spill over a chunk edge would only appear
 * on one side of it.
 */
export function paintTileSeams(
  ctx: Ctx,
  box: Box,
  pos: Vec2,
  host: SeamMaterial,
  seams: readonly (SeamMaterial | null)[] | null,
  quiet = false,
): void {
  if (!seams) return;
  const s = box.size;

  ctx.save();
  for (let side = 0; side < 4; side++) {
    const material = seams[side];
    if (!material) continue;
    // A bank stands in the water it edges, so it goes down firmly and deep
    // enough to break the tile's outline; the water's own rim on dry ground
    // and every dry join stay a tint that keeps the hazard cells readable.
    const bank = host === 'water';
    const wet = bank || material === 'water';
    const depth = s * (bank ? 0.2 : 0.13) * (quiet ? 0.7 : 1);
    const style = material === 'water' ? SURFACE_STYLES.water : TERRAIN_STYLES[material];
    const at = (salt: number, spread: number): number => tileNoise(pos.x, pos.y, salt) * spread;

    ctx.save();
    // Work in a local box whose top edge is this side of the tile, so one
    // layout serves all four joins.
    ctx.translate(box.x + s / 2, box.y + s / 2);
    ctx.rotate((side * Math.PI) / 2);
    ctx.translate(-s / 2, -s / 2);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(s, 0);
    for (let i = 6; i >= 0; i--) {
      ctx.lineTo(s * (i / 6), depth * (0.3 + 0.7 * tileNoise(pos.x, pos.y, 120 + side * 8 + i)));
    }
    ctx.closePath();
    ctx.globalAlpha = (bank ? 0.5 : wet ? 0.3 : 0.42) * (quiet ? 0.55 : 1);
    ctx.fillStyle = style.fill;
    ctx.fill();

    // The contact shade is what grounds a join, but a gradient per edge is the
    // most expensive thing here; over a scene only the bank pays for one.
    if (!quiet || bank) {
      const contact = ctx.createLinearGradient(0, 0, 0, depth * 1.7);
      contact.addColorStop(0, `rgba(0,0,0,${bank ? 0.14 : 0.2})`);
      contact.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = contact;
      ctx.fillRect(0, 0, s, depth * 1.7);
    }

    const stone = TERRAIN_STYLES.stone.fill;
    const base = shade(wet ? stone : style.fill, -0.08);
    const lit = shade(wet ? stone : style.fill, 0.3);
    const litter = (salt: number, reach: number): void =>
      pebble(
        ctx,
        { x: at(salt, s), y: at(salt + 1, depth * reach) + depth * 0.45 },
        s * 0.045,
        base,
        lit,
      );

    // Litter is a garnish, not a rule: only some edges carry any, so a long
    // material boundary does not read as a row of evenly spaced stones.
    if (!quiet && tileNoise(pos.x, pos.y, 300 + side) > 0.45) {
      if (wet || material === 'stone' || material === 'sand') litter(170 + side, 1.1);
      else if (material === 'grass') {
        tuft(
          ctx,
          { x: at(140 + side * 3, s), y: at(141 + side * 3, depth * 0.9) + depth * 0.3 },
          s,
          pos,
          150 + side,
        );
        litter(160 + side, 1.1);
      } else litter(200 + side, 1);
      // A bank keeps reeds as well as stones, where the water meets dry ground.
      if (wet && tileNoise(pos.x, pos.y, 310 + side) > 0.55)
        tuft(
          ctx,
          { x: at(184 + side, s), y: at(185 + side, depth * 1.1) + depth * 0.4 },
          s,
          pos,
          190 + side,
        );
    }
    ctx.restore();
  }
  ctx.restore();
}

/** Raised terrain remains rule-owned in a partial scene, including its rocky top and step faces. */
export function paintElevationBase(
  ctx: Ctx,
  box: Box,
  tile: Tile,
  pos: Vec2,
  relief: TileRelief | undefined,
): void {
  if (tile.elevation > 0) {
    paintTerrain(ctx, box, tile, pos);
    if (tile.terrain === 'stone') paintStonePlateau(ctx, box, pos);
    paintDecals(ctx, box, tile, pos);
  }
  paintTileRelief(ctx, box, pos, relief);
}

/** Broad, quiet stone variation keeps a raised stone plateau from reading as an empty shader tile. */
function paintStonePlateau(ctx: Ctx, box: Box, pos: Vec2): void {
  const s = box.size;
  ctx.save();
  ctx.globalAlpha = 0.34;
  for (let i = 0; i < 2; i++) {
    const cx = box.x + s * (0.28 + tileNoise(pos.x, pos.y, 81 + i) * 0.42);
    const cy = box.y + s * (0.26 + tileNoise(pos.x, pos.y, 84 + i) * 0.44);
    const rx = s * (0.16 + tileNoise(pos.x, pos.y, 87 + i) * 0.09);
    const ry = s * (0.07 + tileNoise(pos.x, pos.y, 90 + i) * 0.05);
    const stone = TERRAIN_STYLES.stone.fill;
    ctx.fillStyle = i === 0 ? shade(stone, 0.22) : shade(stone, -0.16);
    ellipse(ctx, cx, cy, rx, ry);
    ctx.fill();
  }
  ctx.globalAlpha = 0.38;
  ctx.strokeStyle = 'rgba(27,20,16,0.52)';
  ctx.lineWidth = Math.max(1, s * 0.018);
  const y = box.y + s * (0.34 + tileNoise(pos.x, pos.y, 94) * 0.32);
  ctx.beginPath();
  ctx.moveTo(box.x + s * 0.12, y);
  ctx.lineTo(box.x + s * 0.86, y + (tileNoise(pos.x, pos.y, 95) - 0.5) * s * 0.1);
  ctx.stroke();
  ctx.restore();
}

/** Cliff faces and rims can cross into an adjacent lower tile. */
export function paintTileRelief(
  ctx: Ctx,
  box: Box,
  pos: Vec2,
  relief: TileRelief | undefined,
): void {
  if (!relief) return;
  if (relief.westDrop > 0) paintLedgeSide(ctx, box, 'w');
  if (relief.eastDrop > 0) paintLedgeSide(ctx, box, 'e');
  if (relief.faceDrop > 0) paintCliffFace(ctx, box, relief.faceDrop, pos);
  if (relief.rim) paintPlateauRim(ctx, box, relief.rim);
}

/* ------------------------------------------------------------------ */
/* Relief                                                              */
/* ------------------------------------------------------------------ */

/**
 * The step down from the tile to the north: a band of rock face along the top
 * of this tile, strata and cracks in it, a lit lip where the ledge ends and
 * an ink foot where the face meets the ground, then the ledge's shadow
 * falling down the screen. Height grows with the drop.
 */
export function paintCliffFace(ctx: Ctx, box: Box, drop: number, pos: Vec2): void {
  const s = box.size;
  const h = s * Math.min(0.5, 0.24 + 0.1 * drop);
  const { x, y } = box;

  ctx.save();
  ctx.fillStyle = '#4a4542';
  ctx.fillRect(x, y, s + 1, h);
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(x, y + h * 0.52, s + 1, h * 0.1);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(x, y + h * 0.28, s + 1, h * 0.08);

  ctx.strokeStyle = 'rgba(27,20,16,0.55)';
  ctx.lineWidth = Math.max(1, s * 0.022);
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const cx = x + s * (0.12 + 0.76 * tileNoise(pos.x, pos.y, 20 + i));
    const lean = (tileNoise(pos.x, pos.y, 30 + i) - 0.5) * s * 0.08;
    ctx.beginPath();
    ctx.moveTo(cx, y + h * 0.1);
    ctx.lineTo(cx + lean, y + h * 0.55);
    ctx.lineTo(cx - lean * 0.5, y + h * 0.95);
    ctx.stroke();
  }

  // The lip of the ledge above, lit; the foot of the face, inked.
  ctx.fillStyle = 'rgba(255,255,255,0.24)';
  ctx.fillRect(x, y, s + 1, Math.max(1, s * 0.035));
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = INK;
  ctx.fillRect(x, y + h - Math.max(1, s * 0.03), s + 1, Math.max(1, s * 0.03));
  ctx.globalAlpha = 1;

  const shadow = ctx.createLinearGradient(0, y + h, 0, y + h + s * 0.3);
  shadow.addColorStop(0, 'rgba(0,0,0,0.36)');
  shadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadow;
  ctx.fillRect(x, y + h, s + 1, s * 0.3);
  ctx.restore();
}

/** A ledge beside this tile: its shadow on the west side, a hairline of its edge on the east. */
export function paintLedgeSide(ctx: Ctx, box: Box, side: 'w' | 'e'): void {
  const s = box.size;
  ctx.save();
  if (side === 'w') {
    const g = ctx.createLinearGradient(box.x, 0, box.x + s * 0.26, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.32)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(box.x, box.y, s * 0.26, s + 1);
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = INK;
    ctx.fillRect(box.x, box.y, Math.max(1, s * 0.03), s + 1);
  } else {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = INK;
    ctx.fillRect(box.x + s - Math.max(1, s * 0.03), box.y, Math.max(1, s * 0.03), s + 1);
  }
  ctx.restore();
}

/** The edges of a raised tile that look down on lower ground: lit on top, inked below. */
export function paintPlateauRim(ctx: Ctx, box: Box, rim: Edges): void {
  const s = box.size;
  const w = Math.max(1, s * 0.03);
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  if (rim.n) ctx.fillRect(box.x, box.y, s + 1, w);
  if (rim.w) ctx.fillRect(box.x, box.y, w, s + 1);
  if (rim.e) ctx.fillRect(box.x + s - w, box.y, w, s + 1);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = INK;
  if (rim.s) ctx.fillRect(box.x, box.y + s - w, s + 1, w);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Masses                                                              */
/* ------------------------------------------------------------------ */

/**
 * A tree: a cluster of lobes in three greens, dark below and lit toward the
 * top-left, with one ink outline round the whole crown and a contact shadow
 * on the ground. Lobe placement is the tile's own, so a wood is not a row of
 * identical stamps.
 */
export function paintCanopy(ctx: Ctx, box: Box, pos: Vec2): void {
  const s = box.size;
  const cx = box.x + s * 0.5;
  const cy = box.y + s * 0.46;
  const r = s * 0.4;
  const jitter = (salt: number): number => (tileNoise(pos.x, pos.y, salt) - 0.5) * 0.14;
  const lobes: [number, number, number][] = [
    [0, 0.02, 0.98],
    [-0.46 + jitter(1), -0.1 + jitter(2), 0.66],
    [0.44 + jitter(3), -0.06 + jitter(4), 0.68],
    [-0.12 + jitter(5), -0.5 + jitter(6), 0.62],
    [0.26 + jitter(7), 0.4 + jitter(8), 0.58],
    [-0.34 + jitter(9), 0.36 + jitter(10), 0.56],
  ];

  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#000000';
  ellipse(ctx, cx, box.y + s * 0.9, s * 0.34, s * 0.08);
  ctx.fill();
  ctx.globalAlpha = 1;

  const crown = (scale: number, dx: number, dy: number): void => {
    ctx.beginPath();
    for (const [lx, ly, lr] of lobes) {
      const px = cx + (lx * r + dx) * scale;
      const py = cy + (ly * r + dy) * scale;
      const pr = lr * r * scale;
      ctx.moveTo(px + pr, py);
      ctx.arc(px, py, pr, 0, Math.PI * 2);
    }
  };

  crown(1, 0, 0);
  ctx.fillStyle = '#27411f';
  ctx.fill();
  ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.stroke();

  crown(0.8, -s * 0.05, -s * 0.06);
  ctx.fillStyle = '#3e6a31';
  ctx.fill();

  crown(0.52, -s * 0.11, -s * 0.13);
  ctx.fillStyle = '#5f9247';
  ctx.fill();
  ctx.restore();
}

/**
 * A wall, a hut, a boulder: a lit roof with a shaded front face on the side
 * that looks out on open ground to the south, block seams across the front,
 * and an ink outline only round the outside of the run so a long wall reads
 * as one mass rather than a row of boxes.
 */
export function paintSolidMass(
  ctx: Ctx,
  box: Box,
  tile: Tile,
  pos: Vec2,
  solid: Edges | null,
): void {
  const s = box.size;
  const style = TERRAIN_STYLES[tile.terrain];
  const { x, y } = box;
  const front = solid?.s ? s * 0.4 : 0;

  ctx.save();
  ctx.fillStyle = shade(style.fill, 0.16);
  ctx.fillRect(x, y, s + 1, s + 1);
  // Roof grain: a couple of faint lines across it.
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = Math.max(1, s * 0.02);
  for (let i = 0; i < 2; i++) {
    const ly = y + s * (0.3 + 0.4 * tileNoise(pos.x, pos.y, 50 + i));
    ctx.beginPath();
    ctx.moveTo(x + s * 0.1, ly);
    ctx.lineTo(x + s * 0.9, ly + (tileNoise(pos.x, pos.y, 55 + i) - 0.5) * s * 0.1);
    ctx.stroke();
  }

  if (front > 0) {
    const top = y + s - front;
    ctx.fillStyle = shade(style.fill, -0.28);
    ctx.fillRect(x, top, s + 1, front + 1);
    ctx.strokeStyle = 'rgba(27,20,16,0.5)';
    ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.beginPath();
    ctx.moveTo(x, top + front * 0.5);
    ctx.lineTo(x + s, top + front * 0.5);
    const stagger = tileNoise(pos.x, pos.y, 60) < 0.5 ? 0.25 : 0.55;
    ctx.moveTo(x + s * stagger, top);
    ctx.lineTo(x + s * stagger, top + front * 0.5);
    ctx.moveTo(x + s * (stagger + 0.3), top + front * 0.5);
    ctx.lineTo(x + s * (stagger + 0.3), top + front);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x, top, s + 1, Math.max(1, s * 0.035));
  }

  if (solid) {
    const w = Math.max(1, s * 0.04);
    ctx.fillStyle = INK;
    if (solid.n) ctx.fillRect(x, y, s + 1, w);
    if (solid.s) ctx.fillRect(x, y + s - w, s + 1, w);
    if (solid.w) ctx.fillRect(x, y, w, s + 1);
    if (solid.e) ctx.fillRect(x + s - w, y, w, s + 1);
  }
  ctx.restore();
}

/**
 * The floor falls away. Where the pit's north edge meets open ground its far
 * wall shows over the lip, lit stone dropping into the dark; the rest is the
 * dark itself, so a pit two tiles across is one hole with one wall.
 */
export function paintPit(ctx: Ctx, box: Box, solid: Edges | null): void {
  const s = box.size;
  const { x, y } = box;
  const wall = solid?.n ? s * 0.26 : 0;
  ctx.save();
  if (wall > 0) {
    ctx.fillStyle = '#4a4542';
    ctx.fillRect(x, y, s + 1, wall);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x, y + wall * 0.55, s + 1, wall * 0.2);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x, y, s + 1, Math.max(1, s * 0.035));
  }
  const g = ctx.createLinearGradient(0, y + wall, 0, y + s);
  g.addColorStop(0, wall > 0 ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.6)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.74)');
  g.addColorStop(1, 'rgba(0,0,0,0.8)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y + wall, s + 1, s - wall + 1);
  if (solid) {
    const w = Math.max(1, s * 0.03);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = INK;
    if (solid.n) ctx.fillRect(x, y, s + 1, w);
    if (solid.w) ctx.fillRect(x, y, w, s + 1);
    if (solid.e) ctx.fillRect(x + s - w, y, w, s + 1);
    if (solid.s) ctx.fillRect(x, y + s - w, s + 1, w);
  }
  ctx.restore();
}

/** Cover: three pebbles along the bottom edge, lit on top, inked round. */
export function paintCoverStones(ctx: Ctx, box: Box, pos: Vec2): void {
  const s = box.size;
  ctx.save();
  ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.strokeStyle = INK;
  for (let k = 0; k < 3; k++) {
    const cx = box.x + s * (0.26 + k * 0.24 + (tileNoise(pos.x, pos.y, 70 + k) - 0.5) * 0.06);
    const cy = box.y + s * (0.76 + (tileNoise(pos.x, pos.y, 73 + k) - 0.5) * 0.08);
    const r = s * (0.065 + tileNoise(pos.x, pos.y, 76 + k) * 0.03);
    ctx.fillStyle = '#8d887f';
    circle(ctx, cx, cy, r);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c2bdb3';
    circle(ctx, cx - r * 0.3, cy - r * 0.3, r * 0.42);
    ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Decals                                                              */
/* ------------------------------------------------------------------ */

/**
 * A sparse scatter per terrain, on roughly half the tiles: tufts on grass,
 * pebbles on dirt and road, cracks and moss on stone, ripples on sand, seams
 * on planks. Small, low-contrast and inked, so they texture the ground
 * without competing with anything a player has to read.
 */
export function paintDecals(ctx: Ctx, box: Box, tile: Tile, pos: Vec2): void {
  const s = box.size;
  const roll = tileNoise(pos.x, pos.y, 40);
  const at = (salt: number): Vec2 => ({
    x: box.x + s * (0.15 + 0.7 * tileNoise(pos.x, pos.y, salt)),
    y: box.y + s * (0.15 + 0.7 * tileNoise(pos.x, pos.y, salt + 1)),
  });

  ctx.save();
  ctx.lineCap = 'round';
  switch (tile.terrain) {
    case 'grass': {
      if (roll > 0.6) break;
      const tufts = roll < 0.25 ? 2 : 1;
      for (let i = 0; i < tufts; i++) tuft(ctx, at(42 + i * 2), s, pos, 46 + i);
      break;
    }
    case 'dirt':
    case 'road': {
      if (roll > 0.5) break;
      pebble(ctx, at(42), s * (0.035 + 0.03 * tileNoise(pos.x, pos.y, 47)), '#6b5e4c', '#8a7d6e');
      if (roll < 0.2) pebble(ctx, at(44), s * 0.03, '#6b5e4c', '#8a7d6e');
      break;
    }
    case 'stone': {
      if (roll < 0.45) crack(ctx, at(42), s, pos);
      if (roll > 0.8) {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = '#55693c';
        const p = at(44);
        circle(ctx, p.x, p.y, s * 0.04);
        ctx.fill();
      }
      break;
    }
    case 'sand': {
      if (roll > 0.55) break;
      ctx.strokeStyle = 'rgba(0,0,0,0.14)';
      ctx.lineWidth = Math.max(1, s * 0.025);
      for (let i = 0; i < 2; i++) {
        const p = at(42 + i * 2);
        ctx.beginPath();
        ctx.moveTo(p.x - s * 0.14, p.y);
        ctx.quadraticCurveTo(p.x, p.y - s * 0.05, p.x + s * 0.14, p.y);
        ctx.stroke();
      }
      break;
    }
    case 'wood': {
      ctx.strokeStyle = 'rgba(27,20,16,0.35)';
      ctx.lineWidth = Math.max(1, s * 0.02);
      const ly = box.y + s * (0.3 + 0.4 * roll);
      ctx.beginPath();
      ctx.moveTo(box.x, ly);
      ctx.lineTo(box.x + s, ly);
      ctx.stroke();
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

function tuft(ctx: Ctx, p: Vec2, s: number, pos: Vec2, salt: number): void {
  const lean = (tileNoise(pos.x, pos.y, salt) - 0.5) * 0.6;
  ctx.lineWidth = Math.max(1, s * 0.03);
  for (const [pass, color] of [
    [0, '#2f4324'],
    [1, '#6a8449'],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let b = -1; b <= 1; b++) {
      const dx = (b * 0.35 + lean) * s * 0.12;
      ctx.moveTo(p.x + b * s * 0.02, p.y + (pass ? -s * 0.01 : 0));
      ctx.lineTo(p.x + dx, p.y - s * (0.11 + Math.abs(b) * -0.03) - pass * s * 0.005);
    }
    ctx.stroke();
  }
}

function pebble(ctx: Ctx, p: Vec2, r: number, base: string, lit: string): void {
  ctx.lineWidth = Math.max(1, r * 0.3);
  ctx.strokeStyle = 'rgba(27,20,16,0.7)';
  ctx.fillStyle = base;
  ellipse(ctx, p.x, p.y, r * 1.2, r);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = lit;
  ellipse(ctx, p.x - r * 0.3, p.y - r * 0.3, r * 0.5, r * 0.35);
  ctx.fill();
}

function crack(ctx: Ctx, p: Vec2, s: number, pos: Vec2): void {
  const angle = tileNoise(pos.x, pos.y, 48) * Math.PI;
  const len = s * (0.14 + 0.12 * tileNoise(pos.x, pos.y, 49));
  ctx.strokeStyle = 'rgba(27,20,16,0.42)';
  ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.beginPath();
  ctx.moveTo(p.x - Math.cos(angle) * len, p.y - Math.sin(angle) * len);
  ctx.lineTo(p.x + Math.sin(angle) * len * 0.3, p.y - Math.cos(angle) * len * 0.3);
  ctx.lineTo(p.x + Math.cos(angle) * len, p.y + Math.sin(angle) * len);
  ctx.stroke();
}
