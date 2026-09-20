import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { FX_CELLS, resolveFx } from '../../src/content/fx';
import { CEL_FRAMES, CEL_SIZE, FX_CELS } from '../../src/content/fxCels';
import { ATLAS_CELL, ATLAS_SIZE } from '../../src/render/fx/atlas';
import { readPng } from './lib/image';
import { alphaBounds, crop } from './lib/trim';
import { FLASK_CELS, FLASK_SOURCE, packFlask } from './flask-cels';
import { validateFxCels } from './validate';

it('reuses the vessel pixels in four centred cels within the existing atlas and gutters', () => {
  const source = readPng(FLASK_SOURCE),
    shipped = readPng(FLASK_CELS);
  expect(packFlask(source)).toEqual(shipped);
  expect(validateFxCels()).toEqual([]);
  expect(FX_CELLS.length + FX_CELS.length * CEL_FRAMES).toBeLessThanOrEqual(
    (ATLAS_SIZE / ATLAS_CELL) ** 2,
  );
  const vessel = crop(source, alphaBounds(source, 1)!);
  for (let i = 0; i < CEL_FRAMES; i++) {
    const frame = crop(shipped, { x: i * CEL_SIZE, y: 0, width: CEL_SIZE, height: CEL_SIZE });
    expect(crop(frame, alphaBounds(frame, 1)!)).toEqual(vessel);
  }
  expect(readFileSync(FLASK_CELS).length).toBeLessThan(64 * 1024);
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
