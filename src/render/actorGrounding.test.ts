/**
 * The grounding rule of ADR 0093: everything a backend draws standing on an
 * oblique board — every figure and every prop — gets a contact shadow under its
 * feet or base and a cast down-right along its scene's key, hard-edged on the
 * world-pixel grid, on both backends. A figure's cast is one steady shape a
 * heading, its idle's first cel, whatever its legs are doing (owner, 2026-10-28);
 * its contact band still follows the drawn feet.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALL_MAPS } from '../content/index';
import { ASSETS } from '../content/assets/manifest';
import type { ClipName } from '../content/assets/clips';
import {
  CAST_PER_PIXEL,
  CONTACT_LINE,
  KEY_LIGHT_SCREEN,
  SHADOW_LEVEL_SLOTS,
  actorGrounding,
  castFrame,
  contactBand,
  shadowGrid,
  shadowLevels,
} from './lighting';

const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');

describe('every standing thing on an oblique board is grounded', () => {
  const boards = ALL_MAPS.filter((map) => map.projection === 'oblique');

  it('covers every board the game ships', () => {
    expect(boards.length).toBeGreaterThan(0);
  });

  for (const map of boards) {
    const grounding = actorGrounding(map.scene);

    it(`gives ${map.id} a cast and a contact layer`, () => {
      expect(grounding.cast).toBeGreaterThan(0);
      expect(grounding.contact).toBeGreaterThan(0);
      // The contact is the tighter, darker of the two, as the painting's contact line is.
      expect(grounding.contact).toBeGreaterThan(grounding.cast);
    });

    it(`gives every caster on ${map.id} a contact`, () => {
      expect(contactBand(grounding, 1)).toBe(true);
    });

    it(`casts down-right on ${map.id}, away from the one upper-left key light`, () => {
      const { x, y } = grounding.castKey;
      expect(x).toBeGreaterThan(0);
      expect(y).toBeGreaterThan(0);
      // Opposite the light, within a quarter turn either way.
      expect(x * KEY_LIGHT_SCREEN.x + y * KEY_LIGHT_SCREEN.y).toBeLessThan(0);
      // Short: no point more than half its height away.
      expect(Math.hypot(x, y)).toBeLessThanOrEqual(0.5);
    });
  }

  it("casts Ba Dan's figures along the key its painted objects were set in with", () => {
    // `objects.py` set the G1 tables, baskets and benches into the painting; a figure beside them matches.
    const source = readFileSync(
      new URL('../../art/source/ba-dan-route-a/tools/objects.py', import.meta.url),
      'utf8',
    );
    const match = /^SHADOW_KX, SHADOW_KY = ([\d.]+), ([\d.]+)/m.exec(source);
    expect(match).not.toBeNull();
    const village = boards.find((map) => map.id === 'ba_dan_village');
    expect(actorGrounding(village?.scene).castKey).toEqual({
      x: Number(match?.[1]),
      y: Number(match?.[2]),
    });
  });

  it('casts a scene with no painted shadows along the key its runtime scenery uses', () => {
    for (const map of boards.filter((m) => !m.scene?.actorGrounding?.castKey))
      expect(actorGrounding(map.scene).castKey).toBe(CAST_PER_PIXEL);
  });
});

describe("a figure's cast is steady (ADR 0093's amendment)", () => {
  type Clips = Partial<Record<string, { frames: readonly string[]; fps: number }>>;
  const eightWay = Object.entries(ASSETS).flatMap(([key, asset]) =>
    'locomotion' in asset && asset.locomotion ? [{ key, clips: asset.clips as Clips }] : [],
  );
  // The atlas frame a clip shows at a clip time, as the sheet resolves a looped clip.
  const at = (clips: Clips, name: string, time: number) => {
    const def = clips[name];
    return def?.frames[Math.floor((time * def.fps) / 1000) % def.frames.length];
  };

  it('covers every eight-way figure the game ships', () => {
    expect(eightWay.length).toBeGreaterThan(0);
  });

  for (const { key, clips } of eightWay) {
    const moving = Object.keys(clips).filter((clip) => /^(walk|jog)/.test(clip));

    it(`casts ${key} from one cel across every cel of each walk and jog clip`, () => {
      expect(moving.length).toBeGreaterThan(0);
      for (const name of moving) {
        const clip = clips[name];
        if (!clip) continue;
        // What each drawn cel casts, as the backends choose it: the steady cel, or (null) the cel drawn.
        const cast = new Set(
          clip.frames.map((_, cel) => {
            const steady = castFrame(name as ClipName);
            return steady
              ? at(clips, steady.clip, steady.clipTime)
              : at(clips, name, (cel * 1000) / clip.fps);
          }),
        );
        const idle = clips[name.replace(/^(walk|jog)/, 'idle')]?.frames[0];
        expect(idle, `${key} ${name} has an idle to cast`).toBeDefined();
        expect([...cast], `${key} ${name}`).toEqual([idle]);
      }
    });
  }

  it('casts an action from its own frame, so a body that falls lies on its shadow', () => {
    for (const clip of ['hit', 'ko', 'cast', 'melee', 'koSouthEast'] as const)
      expect(castFrame(clip)).toBeNull();
  });
});

describe('the shadow mask is on the world-pixel grid', () => {
  for (const [scale, offsetX, offsetY] of [
    [2, 852, 347],
    [3, 0, 0],
    [3, -41, 7],
    [2.5, 13.25, -6.5],
  ] as const) {
    it(`puts texel edges on world-pixel edges at scale ${scale}, offset ${offsetX},${offsetY}`, () => {
      const viewport = { width: 1368, height: 715 };
      const grid = shadowGrid(viewport, scale, offsetX, offsetY);
      expect(grid.texel).toBe(scale);
      // Texel 0 starts at or before the viewport, less than one texel out.
      for (const origin of [grid.originX, grid.originY]) {
        expect(origin).toBeLessThanOrEqual(0);
        expect(origin).toBeGreaterThan(-scale);
      }
      // World pixel k's edge is at k * scale - offset; the texel edges land on them.
      const onGrid = (origin: number, offset: number) => {
        const k = (origin + offset) / scale;
        expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-9);
      };
      onGrid(grid.originX, offsetX);
      onGrid(grid.originY, offsetY);
      // And the mask still covers the whole viewport.
      expect(grid.originX + grid.width * scale).toBeGreaterThanOrEqual(viewport.width);
      expect(grid.originY + grid.height * scale).toBeGreaterThanOrEqual(viewport.height);
    });
  }
});

describe('the WebGL composite snaps each texel to a caster level', () => {
  it('keeps every distinct level, strongest first, padded with 0', () => {
    expect(shadowLevels([0.625, 1, 0.625, 0.5])).toEqual([1, 0.625, 0.5, 0, 0, 0, 0, 0]);
    expect(shadowLevels([])).toHaveLength(SHADOW_LEVEL_SLOTS);
  });

  it('folds too many levels onto eighths, so a crowd of fades still fits', () => {
    const levels = shadowLevels(Array.from({ length: 40 }, (_, i) => (i + 1) / 40));
    expect(levels).toHaveLength(SHADOW_LEVEL_SLOTS);
    for (const level of levels) expect((level * 8) % 1).toBeCloseTo(0, 6);
  });
});

describe('both backends draw the same grounding', () => {
  for (const file of ['./backends/canvas2d.ts', './backends/pixi.ts']) {
    const source = read(file);
    it(`${file} draws the mask on the world-pixel grid`, () => {
      expect(source).toContain('shadowGrid(');
    });
    it(`${file} casts figures and props along the scene key`, () => {
      expect(source.match(/this\.grounding\.castKey/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    });
    it(`${file} casts every figure and resident from its steady cel`, () => {
      expect(source.match(/castFrame\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    });
    it(`${file} seats every prop on its contact line and casts it from its own ground`, () => {
      expect(source).toContain('projectContactLine(');
      expect(source).toContain('CONTACT_LINE');
      expect(source).toContain('groundedCastArt(');
    });
    it(`${file} grounds solid scenery on its own base, its feet inside its footprint`, () => {
      expect(source).toContain('groundSceneryPiece(');
      expect(source).toContain('pieceFeet(');
    });
  }

  it('lays the contact line deep enough that a whole world pixel shows under the outline', () => {
    expect(CONTACT_LINE).toBe(2);
  });
});
