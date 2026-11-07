import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ABILITY_BY_ID } from '../../../src/content/abilities';
import { FX_RECIPES } from '../../../src/content/fx';
import { describe, expect, it, vi } from 'vitest';
import { readPng } from '../lib/image';
import { decodeWebp, isLosslessWebp } from '../lib/webp';
import {
  JSON_OUTPUT,
  OUT,
  SOURCE,
  packTopdownVfx,
  WEBP,
  type PackedVfx,
  type VfxUse,
} from './pack-vfx';

vi.setConfig({ testTimeout: 600_000, hookTimeout: 600_000 });

const readManifest = (): PackedVfx => JSON.parse(readFileSync(JSON_OUTPUT, 'utf8')) as PackedVfx;
const abilityUse = (
  uses: readonly VfxUse[] | undefined,
  abilityId: string,
): Extract<VfxUse, { kind: 'ability' }> | undefined => {
  const use = uses?.find(
    (candidate) => candidate.kind === 'ability' && candidate.abilityId === abilityId,
  );
  return use?.kind === 'ability' ? use : undefined;
};

describe('top-down VFX packing', () => {
  it('packs deterministically and passes its exact-output check mode', async () => {
    const first = await packTopdownVfx();
    const second = await packTopdownVfx();
    expect([...first.keys()].sort()).toEqual([JSON_OUTPUT, WEBP].sort());
    expect([...second.keys()].sort()).toEqual([JSON_OUTPUT, WEBP].sort());
    for (const [path, bytes] of first) {
      const other = second.get(path);
      expect(other, path).toBeDefined();
      expect(Buffer.from(other ?? '').equals(Buffer.from(bytes)), path).toBe(true);
      expect(Buffer.from(readFileSync(path)).equals(Buffer.from(bytes)), path + ' is stale').toBe(
        true,
      );
    }

    const check = execFileSync(
      process.execPath,
      ['--import', 'tsx', 'scripts/art/topdown/pack-vfx.ts', '--check'],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 600_000 },
    );
    expect(check).toContain('0 stale');
  });

  it('keeps every recipe frame in the lossless hard-alpha atlas', async () => {
    const bytes = new Uint8Array(readFileSync(WEBP));
    expect(isLosslessWebp(bytes)).toBe(true);
    const image = await decodeWebp(bytes);
    for (let i = 3; i < image.data.length; i += 4)
      if (image.data[i] !== 0 && image.data[i] !== 255)
        throw new Error('VFX atlas has a soft-alpha pixel');

    const manifest = readManifest();
    expect(manifest.meta.image).toBe('vfx.webp');
    expect(manifest.meta.size).toEqual({ w: image.width, h: image.height });
    for (const [key, effect] of Object.entries(manifest.effects)) {
      expect(effect.frames.length, key).toBeGreaterThan(0);
      expect(effect.frameMs.length, key).toBe(effect.frames.length);
      expect(
        effect.frameMs.every((duration) => Number.isFinite(duration) && duration > 0),
        key,
      ).toBe(true);
      for (const name of effect.frames) {
        const rect = manifest.frames[name]?.frame;
        expect(rect, key + ': ' + name).toBeDefined();
        expect(rect?.x, name).toBeGreaterThanOrEqual(0);
        expect(rect?.y, name).toBeGreaterThanOrEqual(0);
        expect((rect?.x ?? 0) + (rect?.w ?? 0), name).toBeLessThanOrEqual(image.width);
        expect((rect?.y ?? 0) + (rect?.h ?? 0), name).toBeLessThanOrEqual(image.height);
      }
      expect(Boolean(effect.uses) !== Boolean(effect.unused), key).toBe(true);
      for (const use of effect.uses ?? []) {
        if (use.kind === 'ability') {
          const ability = ABILITY_BY_ID.get(use.abilityId ?? '');
          expect(ability, key + ': ' + use.abilityId).toBeDefined();
          if (use.fxId) {
            expect(Object.hasOwn(FX_RECIPES, use.fxId), key + ': ' + use.fxId).toBe(true);
            expect(ability?.fx, key + ': ' + use.abilityId).toBe(use.fxId);
          } else {
            expect(use.fxOmittedReason, key + ': ' + use.abilityId).toBeTruthy();
            expect(Object.hasOwn(FX_RECIPES, ability?.fx ?? ''), key + ': ' + use.abilityId).toBe(
              false,
            );
          }
        }
        if (use.kind === 'surface') {
          expect(Object.hasOwn(FX_RECIPES, use.fxId), key + ': ' + use.fxId).toBe(true);
          for (const id of use.abilityIds ?? [])
            expect(ABILITY_BY_ID.has(id), key + ': ' + id).toBe(true);
        }
      }
    }

    const debris = manifest.effects['vfx13/debris'];
    expect(debris?.uses?.some((use) => 'hitStopMs' in use)).toBe(false);
    expect(abilityUse(manifest.effects['vfx13/slam_shock']?.uses, 'driller_slam')?.hitStopMs).toBe(
      170,
    );
    expect(abilityUse(manifest.effects['vfx13/rock_hit']?.uses, 'rock_throw')?.hitStopMs).toBe(50);
    expect(abilityUse(manifest.effects['vfx13/club_hit']?.uses, 'club_swing')?.hitStopMs).toBe(90);
    expect(abilityUse(manifest.effects['vfx13/slash']?.uses, 'merc_blade')?.hitStopMs).toBe(70);
    expect(abilityUse(manifest.effects['vfx13/slash']?.uses, 'ruon_sabre')?.hitStopMs).toBe(80);

    for (const key of ['vfx/vfx_ball', 'vfx/vfx_ball_diag', 'vfx/vfx_burst', 'vfx/vfx_embers'])
      expect(
        new Set(
          manifest.effects[key]?.uses?.flatMap((use) =>
            use.kind === 'ability' ? [use.abilityId] : [],
          ),
        ),
        key,
      ).toEqual(new Set(['fire_jab', 'fire_blast']));
    expect(
      manifest.effects['vfx/vfx_ring_pro']?.uses?.map((use) =>
        use.kind === 'ability' ? [use.abilityId, use.fxId] : [],
      ),
    ).toEqual([['fire_blast', 'fx.fire.blast']]);

    // The prototype overrides these source JSON durations at playback sites.
    expect(manifest.effects['vfx13/torch']?.frameMs.every((duration) => duration === 70)).toBe(
      true,
    );
    expect(
      manifest.effects['vfx13/torch']?.sourceFrameMs?.every((duration) => duration === 100),
    ).toBe(true);
    for (const key of ['vfx13/fire_ground_a', 'vfx13/fire_ground_b', 'vfx13/fire_ground_c'])
      expect(
        manifest.effects[key]?.frameMs.every((duration) => duration === 85),
        key,
      ).toBe(true);
  });

  it('preserves every source-frame pixel through crop and hard-alpha packing', async () => {
    const manifest = readManifest();
    const atlas = await decodeWebp(new Uint8Array(readFileSync(WEBP)));
    for (const [key, effect] of Object.entries(manifest.effects)) {
      const [folder, file] = key.split('/');
      if (!folder || !file) throw new Error('invalid VFX source key: ' + key);
      const source = readPng(join(SOURCE, folder, file + '.png'));
      const metadata = JSON.parse(readFileSync(join(SOURCE, folder, file + '.json'), 'utf8')) as {
        frames: Array<{
          frame: { x: number; y: number; w: number; h: number };
        }>;
      };
      for (let index = 0; index < effect.frames.length; index++) {
        const name = effect.frames[index];
        const sourceFrame = metadata.frames[index];
        const packedFrame = name ? manifest.frames[name]?.frame : undefined;
        if (!name || !sourceFrame || !packedFrame)
          throw new Error(key + '/' + index + ': source or packed frame is missing');
        if (sourceFrame.frame.w !== packedFrame.w || sourceFrame.frame.h !== packedFrame.h)
          throw new Error(name + ': packed frame dimensions differ from the source crop');
        for (let y = 0; y < sourceFrame.frame.h; y++) {
          for (let x = 0; x < sourceFrame.frame.w; x++) {
            const sourceOffset =
              ((sourceFrame.frame.y + y) * source.width + sourceFrame.frame.x + x) * 4;
            const atlasOffset = ((packedFrame.y + y) * atlas.width + packedFrame.x + x) * 4;
            const alpha = source.data[sourceOffset + 3] ?? 0;
            const visible = alpha >= 128;
            for (let channel = 0; channel < 4; channel++) {
              const expected = visible
                ? channel === 3
                  ? 255
                  : (source.data[sourceOffset + channel] ?? 0)
                : 0;
              if (atlas.data[atlasOffset + channel] !== expected)
                throw new Error(
                  name + ': pixel mismatch at ' + x + ',' + y + ' channel ' + channel,
                );
            }
          }
        }
      }
    }
  });

  it('preserves the prototype directional transform and pivot tables without resampling', () => {
    const directions = readManifest().effects;
    const tableOf = (key: string) =>
      Object.fromEntries(
        Object.entries(directions[key]?.directions ?? {}).map(([heading, recipe]) => [
          heading,
          recipe?.transform,
        ]),
      );
    expect(tableOf('vfx/vfx_burst')).toEqual({
      south: 'rotate-90-cw',
      'south-east': 'identity',
      east: 'identity',
      'north-east': 'identity',
      north: 'rotate-90-ccw',
      'north-west': 'flip-x',
      west: 'flip-x',
      'south-west': 'flip-x',
    });
    expect(tableOf('vfx/vfx_ball')).toEqual({
      south: 'rotate-90-cw',
      east: 'identity',
      north: 'rotate-90-ccw',
      west: 'flip-x',
    });
    expect(tableOf('vfx/vfx_ball_diag')).toEqual({
      'south-east': 'flip-y',
      'north-east': 'identity',
      'north-west': 'flip-x',
      'south-west': 'rotate-180',
    });
    expect(tableOf('vfx/vfx_whip_pro')).toEqual({
      south: 'rotate-90-cw',
      'south-east': 'identity',
      east: 'identity',
      'north-east': 'identity',
      north: 'rotate-90-ccw',
      'north-west': 'flip-x',
      west: 'flip-x',
      'south-west': 'flip-x',
    });

    const manifest = readManifest();
    const ballRaw = JSON.parse(
      readFileSync('prototypes/topdown/assets/vfx/vfx_ball.json', 'utf8'),
    ) as { frames: Array<{ pivot: { x: number; y: number }; frame: { w: number; h: number } }> };
    const sourceFrame = ballRaw.frames[0];
    if (!sourceFrame) throw new Error('vfx_ball source has no first frame');
    const pivot = {
      x: Math.round(sourceFrame.pivot.x * sourceFrame.frame.w),
      y: Math.round(sourceFrame.pivot.y * sourceFrame.frame.h),
    };
    const width = sourceFrame.frame.w;
    const height = sourceFrame.frame.h;
    expect(manifest.effects['vfx/vfx_ball']?.directions?.south).toMatchObject({
      pivot: { x: height - 1 - pivot.y, y: pivot.x },
      frameSize: { w: height, h: width },
    });
    expect(manifest.effects['vfx/vfx_ball']?.directions?.west).toMatchObject({
      pivot: { x: width - 1 - pivot.x, y: pivot.y },
      frameSize: { w: width, h: height },
    });
  });

  it('keeps the complete top-down art family under 6 MiB', () => {
    const bytes = readdirSync(OUT).reduce((sum, name) => {
      const path = join(OUT, name);
      return statSync(path).isFile() ? sum + statSync(path).size : sum;
    }, 0);
    expect(bytes).toBeLessThan(6 * 1024 * 1024);
  });
});
