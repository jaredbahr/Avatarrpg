/**
 * The Forest Road's top-down board (ADR 0104 T4) is the approved prototype's (`forest-combat.html`):
 * its tile strip and every sprite it borrows or recolours are the page's own pixels, and the bake
 * lays the rules' features where the rows put them: the puddle on the `~` cells, the creek on `W`,
 * a heap on each rubble cell. The generic checks (seating, contrast, halos, straight edges,
 * `--check`) run for it in `pack-ground.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import type { MapScene } from '../../../src/core/types';
import { FOREST_GROUND_ROWS } from '../../../src/content/maps/combat';
import { FOREST_RUBBLE_CELLS } from '../../../src/content/scenes/forestRoad';
import { FOREST_TOPDOWN_OBJECTS } from '../../../src/content/scenes/forestRoad.topdown';
import { FOREST, GRID, forestClass } from '../../../src/content/scenes/forestRoad.topdown.terrain';
import type { RgbaImage } from '../../../src/render/shadow/hardShadowMask';
import { FOREST_ROAD_BOARD, prototypeObject, tileStrip } from './boards/forestRoad';
import { sceneFile } from './lib/board';

const PAGE = readFileSync('prototypes/topdown/forest-combat.html', 'utf8');

function embedded(name: string): PNG {
  const match = new RegExp(
    `"${name}"\\s*:\\s*\\{[^{}]*?"(?:src|data|img)"\\s*:\\s*"data:image/png;base64,([A-Za-z0-9+/=]+)"`,
  ).exec(PAGE);
  if (!match?.[1]) throw new Error(`forest-combat.html embeds no "${name}" image`);
  return PNG.sync.read(Buffer.from(match[1], 'base64'));
}

/** Pixels that differ: alpha anywhere, colour where either is opaque. */
function differing(a: RgbaImage, b: PNG): number {
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const aa = a.data[i + 3] ?? 0,
      ba = b.data[i + 3] ?? 0;
    if (aa !== ba) n++;
    else if (aa && [0, 1, 2].some((c) => a.data[i + c] !== b.data[i + c])) n++;
  }
  return n;
}

describe('the Forest Road board', () => {
  it.each(['alder', 'bush_dark', 'signpost', 'fence', 'lamp', 'tuft', 'flowers', 'pine_a', 'log'])(
    'prepares %s exactly as the approved page embeds it',
    (name) => {
      const mine = prototypeObject(name),
        page = embedded(name);
      expect([mine.width, mine.height]).toEqual([page.width, page.height]);
      expect(differing(mine, page)).toBe(0);
    },
  );

  it("samples the page's own tile strip", () => {
    const page = embedded('tiles');
    const strip = tileStrip();
    expect(page.width).toBe(strip.length * 32);
    for (const [i, tile] of strip.entries()) {
      const cut: RgbaImage = { width: 32, height: 32, data: new Uint8ClampedArray(32 * 32 * 4) };
      for (let y = 0; y < 32; y++)
        for (let x = 0; x < 32; x++)
          for (let c = 0; c < 4; c++)
            cut.data[(y * 32 + x) * 4 + c] = page.data[(y * page.width + i * 32 + x) * 4 + c] ?? 0;
      const asPng = { data: Buffer.from(tile.data), width: 32, height: 32 } as unknown as PNG;
      expect(differing(cut, asPng), `tile ${i}`).toBe(0);
    }
  });

  it('lays the puddle on the `~` cells and the creek on the `W` cells, at their centres', () => {
    const centre = (x: number, y: number): number =>
      forestClass(GRID.x + x * 40 + 20, GRID.y + y * 40 + 20);
    FOREST_GROUND_ROWS.forEach((row, y) =>
      [...row].forEach((c, x) => {
        if (c === '~') expect(centre(x, y), `(${x},${y})`).toBe(FOREST.puddle);
        else if (c === 'W') expect(centre(x, y), `(${x},${y})`).toBe(FOREST.water);
        else expect(centre(x, y), `(${x},${y})`).not.toBe(FOREST.water);
      }),
    );
  });

  it('stands a rubble heap on every painted rubble cell, and paints the water', () => {
    for (const cell of FOREST_RUBBLE_CELLS)
      expect(
        FOREST_TOPDOWN_OBJECTS.some(
          (o) => o.sprite === 'rubble' && o.footprint.some((f) => f.x === cell.x && f.y === cell.y),
        ),
        `(${cell.x},${cell.y})`,
      ).toBe(true);
    const scene = JSON.parse(readFileSync(sceneFile(FOREST_ROAD_BOARD), 'utf8')) as MapScene;
    expect(scene.paintedWater).toBe(true);
    expect(scene.scenery.length).toBe(
      FOREST_TOPDOWN_OBJECTS.filter((o) => o.kind !== 'flat').length,
    );
  });
});
