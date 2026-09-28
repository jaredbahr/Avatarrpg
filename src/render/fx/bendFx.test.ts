import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { BendEffectDef, BendSetDef } from '../../content/bends';
import { BEND_FX, effectCelName } from '../../content/fxCels';
import { bendFxIndex, celIndexAt, layerLoops, loadBendFx, parseBendFxPage } from './bendFx';

const read = (path: string): unknown => JSON.parse(readFileSync(join('public', path), 'utf8'));
const effects = read(BEND_FX.data) as BendEffectDef[];
const pages = BEND_FX.pages.map((path) => parseBendFxPage(read(path), path));
const index = bendFxIndex(effects, pages);
const PARTY = ['kaya', 'sura', 'bo'] as const;

describe('celIndexAt', () => {
  const ms = [40, 150, 110];

  it('walks the cumulative timing and ends after the last cel', () => {
    expect(celIndexAt(ms, -5, false)).toBe(0);
    expect(celIndexAt(ms, 0, false)).toBe(0);
    expect(celIndexAt(ms, 39.9, false)).toBe(0);
    expect(celIndexAt(ms, 40, false)).toBe(1);
    expect(celIndexAt(ms, 189, false)).toBe(1);
    expect(celIndexAt(ms, 190, false)).toBe(2);
    expect(celIndexAt(ms, 299, false)).toBe(2);
    expect(celIndexAt(ms, 300, false)).toBeNull();
  });

  it('wraps a looping sequence, however many turns have passed', () => {
    expect(celIndexAt(ms, 300, true)).toBe(0);
    expect(celIndexAt(ms, 300 * 7 + 45, true)).toBe(1);
    expect(celIndexAt([100], 12_345, true)).toBe(0);
  });

  it('draws nothing for an empty sequence', () => {
    expect(celIndexAt([], 0, true)).toBeNull();
  });
});

describe('the shipped bend effects', () => {
  it('resolves every cel every layer times, each with a pivot inside it', () => {
    for (const effect of effects) {
      for (const layer of effect.layers) {
        layer.frameMs.forEach((_, cel) => {
          const found = index.cel(effectCelName(layer.sequence, cel));
          expect(found, `${layer.sequence}/${cel}`).toBeDefined();
          if (!found) return;
          expect(found.image).toBe('art/fx/bend-fx.webp');
          expect(found.meta.pivot.x).toBeGreaterThanOrEqual(0);
          expect(found.meta.pivot.y).toBeGreaterThanOrEqual(0);
          expect(found.meta.pivot.x).toBeLessThanOrEqual(found.frame.w);
          expect(found.meta.pivot.y).toBeLessThanOrEqual(found.frame.h);
        });
      }
    }
  });

  it('serves the effect every party bend names, of its element', () => {
    for (const name of PARTY) {
      const set = read(`art/units/${name}-bend.json`) as BendSetDef;
      for (const attack of set.facings.southEast.attacks) {
        const effect = index.effect(attack.effectId);
        expect(effect?.element, attack.effectId).toBe(set.element);
        attack.releases.forEach((_, release) => {
          expect(index.layersFor(attack.effectId, release).length).toBeGreaterThan(0);
        });
      }
    }
  });

  it('gives each fire fist its own fireball and both the same burst', () => {
    const phases = (release: number) =>
      index
        .layersFor('fx.fire.fireball', release)
        .map((layer) => `${layer.phase}:${layer.sequence.split('/')[1]}`);
    expect(phases(0)).toEqual(['launch:jab-launch', 'travel:jab-ball', 'impact:burst']);
    expect(phases(1)).toEqual(['launch:cross-launch', 'travel:cross-ball', 'impact:burst']);
  });

  it('opens the earth crack on the stomp and throws the rock on the drive', () => {
    const stomp = index.layersFor('fx.earth.rock', 0).map((layer) => layer.sequence);
    const drive = index.layersFor('fx.earth.rock', 1).map((layer) => layer.sequence);
    expect(stomp).toEqual(['fx.earth.rock/crack']);
    expect(drive).toEqual([
      'fx.earth.rock/emerge',
      'fx.earth.rock/hang',
      'fx.earth.rock/tumble',
      'fx.earth.rock/shatter',
    ]);
  });

  it('samples a layer by its own clock: travel loops, the rest play once', () => {
    const [launch, travel] = index
      .layersFor('fx.water.bolt', 0)
      .filter((layer) => ['launch', 'travel'].includes(layer.phase));
    if (!launch || !travel) throw new Error('no water launch and travel');
    expect(layerLoops(travel)).toBe(true);
    expect(layerLoops(launch)).toBe(false);
    expect(index.layerCel(launch, 0)?.name).toBe('fx.water.bolt/lash/0');
    expect(index.layerCel(launch, 10_000)).toBeNull();
    const lap = travel.frameMs.reduce((sum, ms) => sum + ms, 0);
    expect(index.layerCel(travel, lap + 1)?.name).toBe('fx.water.bolt/bolt/0');
    expect(index.layerCel(travel, lap + (travel.frameMs[0] ?? 0))?.name).toBe(
      'fx.water.bolt/bolt/1',
    );
  });

  it('records how each cel turns: toward the target, by a fixed angle, or along a segment', () => {
    expect(index.cel('fx.fire.fireball/jab-ball/0')?.meta.facing).toBe(32);
    expect(index.cel('fx.water.bolt/bolt/0')?.meta.facing).toBe(0);
    expect(index.cel('fx.water.bolt/coil/0')?.meta.angle).toBe(-8);
    // The ink spans 1.12 times the distance; the whole cel, margins and all, a little more.
    const lash = index.cel('fx.water.bolt/lash/0');
    const ink = (lash?.frame.w ?? 0) - 16;
    expect(lash?.meta.segment).toBeCloseTo((1.12 * (lash?.frame.w ?? 0)) / ink, 3);
    expect(index.cel('fx.earth.rock/shatter/0')?.meta).not.toHaveProperty('facing');
  });

  it('loads through the registration with any fetch', async () => {
    const urls: string[] = [];
    const loaded = await loadBendFx(BEND_FX, '/base/', async (url) => {
      urls.push(url);
      return read(url.replace('/base/', ''));
    });
    expect(urls).toEqual(['/base/art/fx/bend-effects.json', '/base/art/fx/bend-fx.json']);
    expect(loaded.effect('fx.earth.rock')?.trajectory.kind).toBe('arc');
  });
});

describe('a bad effect atlas', () => {
  const page = read(BEND_FX.pages[0] ?? '') as { frames: Record<string, { fx?: unknown }> };

  it('fails on a cel without a pivot', () => {
    const [first] = Object.keys(page.frames);
    const broken = structuredClone(page);
    if (first) broken.frames[first] = { ...broken.frames[first], fx: {} };
    expect(() => parseBendFxPage(broken, 'art/fx/bend-fx.json')).toThrow('has no pivot');
  });

  it('fails when a layer names a cel no page carries, or a cel is on two pages', () => {
    const [cels] = pages;
    if (!cels) throw new Error('no page');
    const missing = new Map(cels);
    missing.delete('fx.earth.rock/tumble/3');
    expect(() => bendFxIndex(effects, [missing])).toThrow(
      'Effect "fx.earth.rock" needs cel "fx.earth.rock/tumble/3"',
    );
    expect(() => bendFxIndex(effects, [cels, cels])).toThrow('is on two pages');
  });
});
