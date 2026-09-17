import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_ABILITIES } from './abilities';
import {
  ALL_SOUNDS,
  SOUND_CUES,
  SOUND_FAMILIES,
  resolveSound,
  soundFamily,
  soundFiles,
  soundSchema,
} from './sounds';

describe('sounds', () => {
  it('parse every row in the table', () => {
    for (const { key, def } of ALL_SOUNDS) {
      expect(() => soundSchema.parse(def), key).not.toThrow();
    }
  });

  it('give an fx key its element without a row of its own', () => {
    // The whole point of the family fallback: no ability needs an entry.
    const fire = resolveSound('fx.fire.blast');
    expect(fire?.kind).toBe('voice');
    expect(fire).toEqual(soundSchema.parse(SOUND_FAMILIES.fire));
    // A key no one has ever written down still lands on its element.
    expect(resolveSound('fx.water.invented')).toEqual(soundSchema.parse(SOUND_FAMILIES.water));
  });

  it('let a named cue win over its family', () => {
    // `step` has no middle segment, so it can only resolve as its own cue.
    const step = resolveSound('step');
    expect(step?.kind).toBe('sample');
    expect(soundFamily('step')).toBe('step');
  });

  it('are silent rather than wrong for a key nothing covers', () => {
    expect(resolveSound('fx.nosuchelement.blast')).toBeNull();
    expect(resolveSound('utterly-unknown')).toBeNull();
  });

  it('ship every file the table names', () => {
    const files = soundFiles();
    expect(files.length).toBeGreaterThan(0);
    for (const url of files) {
      expect(existsSync(resolve('public', url)), `${url} is named but not shipped`).toBe(true);
    }
  });

  it('give every ability in the game a voice', () => {
    // The choreography cues `ability.fx` at the release, so an unresolved key
    // is an ability that casts in silence. Only the keys abilities actually
    // name are in scope: `fx.surface.*` and `fx.status.*` describe what the
    // ground and a condition look like, and those are cued, when they are
    // cued at all, by name rather than through an element.
    const silent = [
      ...new Set(
        ALL_ABILITIES.map((ability) => ability.fx).filter((key) => resolveSound(key) === null),
      ),
    ].sort();
    expect(silent, 'give these a voice in SOUND_FAMILIES').toEqual([]);
  });

  it('keep a sample cue pointing at a real file, not a family', () => {
    // A typo in `url` would otherwise fall through to a family voice and the
    // missing file would never be noticed.
    for (const [key, input] of Object.entries(SOUND_CUES)) {
      const def = soundSchema.parse(input);
      if (def.kind !== 'sample') continue;
      for (const url of [def.url, ...def.variants]) {
        expect(existsSync(resolve('public', url)), `${key} names ${url}`).toBe(true);
      }
    }
  });
});
