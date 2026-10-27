import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveFx } from '../../src/content/fx';
import { CEL_FRAMES, CEL_SIZE, FX_CELS, FX_CEL_SHEETS } from '../../src/content/fxCels';
import { ATLAS_CELL, ATLAS_SIZE } from '../../src/render/fx/atlas';
import { FX_CELLS } from '../../src/content/fx';
import { parseHex, readPng } from './lib/image';
import { decodeWebp, isLosslessWebp } from './lib/webp';
import {
  BEND_PAGE,
  INK,
  RAMPS,
  SHEET_RAMP,
  buildG1,
  checkG1Sources,
  luma,
  snap,
  upscale,
} from './fx-g1';
import { validateBendFx, validateFxCels } from './validate';

const build = buildG1();

describe('the G1 effects packer', () => {
  it('reads only pinned, unchanged sources', () => {
    expect(checkG1Sources()).toEqual([]);
  });

  it('snaps by value: each band runs halfway to the next tone, ink darkest', () => {
    expect(snap([0, 0, 0], 'fire')).toEqual(parseHex(INK));
    expect(snap([255, 255, 255], 'fire')).toEqual(parseHex('#fff6e0'));
    // A painted red as light as the burning surface's orange takes that tone.
    expect(snap([230, 80, 40], 'fire')).toEqual(parseHex('#e0521f'));
    // A shift moves the value, never the hue choice off the ramp.
    expect(snap([230, 80, 40], 'fire', 60)).toEqual(parseHex('#ffb648'));
    expect(luma([255, 255, 255])).toBe(255);
  });

  it('upscales an art px to a 2 x 2 block, cropped to the frame', () => {
    const one = { width: 2, height: 1, data: new Uint8Array([1, 2, 3, 255, 4, 5, 6, 255]) };
    const out = upscale(one, 2, 3, 2);
    expect([...out.data.subarray(0, 12)]).toEqual([1, 2, 3, 255, 1, 2, 3, 255, 4, 5, 6, 255]);
    expect([...out.data.subarray(12, 24)]).toEqual([1, 2, 3, 255, 1, 2, 3, 255, 4, 5, 6, 255]);
  });

  it('ships exactly what the sources make', async () => {
    const page = new Uint8Array(readFileSync(BEND_PAGE));
    expect(isLosslessWebp(page)).toBe(true);
    expect((await decodeWebp(page)).data).toEqual(build.page.data);
    for (const [url, image] of build.sheets) expect(readPng(url).data).toEqual(image.data);
  }, 60_000);

  it('gives every cel at most four tones and the ink, all on its ramp, with one opacity', () => {
    expect(build.report).toHaveLength(33 + FX_CELS.length * CEL_FRAMES);
    for (const cel of build.report) expect(cel.colours).toBeLessThanOrEqual(5);
    const allowed = (ramp: keyof typeof RAMPS) =>
      new Set([INK, ...RAMPS[ramp]].map((hex) => parseHex(hex).join(',')));
    for (const def of FX_CEL_SHEETS) {
      const image = build.sheets.get(`public/${def.url}`)!;
      def.clips.forEach((clip, row) => {
        const ok = allowed(SHEET_RAMP[`cel-${clip}`]!);
        for (let col = 0; col < CEL_FRAMES; col++) {
          const alphas = new Set<number>();
          for (let y = row * CEL_SIZE; y < (row + 1) * CEL_SIZE; y++)
            for (let x = col * CEL_SIZE; x < (col + 1) * CEL_SIZE; x++) {
              const i = (y * image.width + x) * 4;
              const a = image.data[i + 3]!;
              if (a === 0) continue;
              alphas.add(a);
              expect(ok.has(`${image.data[i]},${image.data[i + 1]},${image.data[i + 2]}`)).toBe(
                true,
              );
            }
          expect(alphas.size).toBe(1);
        }
      });
    }
  });

  it('passes art:validate, the bend page against its re-written pins', async () => {
    expect(validateFxCels()).toEqual([]);
    expect(await validateBendFx()).toEqual([]);
  }, 60_000);

  it('fits the shared atlas: nine shape ladders and every cel master in a slot', () => {
    expect(FX_CELLS.length + FX_CELS.length * CEL_FRAMES).toBeLessThanOrEqual(
      (ATLAS_SIZE / ATLAS_CELL) ** 2,
    );
    expect(CEL_SIZE).toBeLessThanOrEqual(ATLAS_CELL);
  });

  it('is smaller than the painted effects it replaced', () => {
    // Painted: bend page 54,376 B; the five cel sheets 1,497,073 B (ADR 0086).
    expect(readFileSync(BEND_PAGE).length).toBeLessThan(54_376 / 4);
    const sheets = FX_CEL_SHEETS.reduce(
      (sum, def) => sum + readFileSync(`public/${def.url}`).length,
      0,
    );
    expect(sheets).toBeLessThan(1_497_073 / 8);
  });

  it('repeats the one rigid flask in all four cels', () => {
    const image = build.sheets.get('public/art/fx/flask-cels.png')!;
    const cel = (col: number) => {
      const out: number[] = [];
      for (let y = 0; y < CEL_SIZE; y++)
        out.push(
          ...image.data.subarray(
            (y * image.width + col * CEL_SIZE) * 4,
            (y * image.width + (col + 1) * CEL_SIZE) * 4,
          ),
        );
      return out;
    };
    for (let col = 1; col < CEL_FRAMES; col++) expect(cel(col)).toEqual(cel(0));
  });
});

it('throws one small flask with a dark fallback and preserves oil flight and spill', () => {
  const recipe = resolveFx('fx.enemy.oil');
  const heads = recipe.travel!.emitters.filter(
    (e) => e.kind === 'particles' && e.shape === 'projectile',
  );
  expect(heads).toHaveLength(1);
  expect(heads[0]).toMatchObject({
    cel: 'flask',
    cell: 'drop',
    color: 'dark',
    count: 1,
    size: [0.3, 0.3],
    spin: 3,
    fade: 'none',
  });
  expect(recipe.travel).toMatchObject({ speed: 16, arc: 0.7 });
  expect(recipe.travel!.emitters.some((e) => e.kind === 'particles' && e.cel === 'boulder')).toBe(
    false,
  );
  expect(
    recipe.impact.every((e) => e.kind === 'particles' && (e.cell === 'drop' || e.cell === 'shard')),
  ).toBe(true);
});
