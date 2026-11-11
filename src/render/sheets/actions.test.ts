/**
 * A top-down sheet's actions file (ADR 0104) folded into its clips: every pose in each of PixelLab's eight
 * headings, each ability under the pose `actionMap` gives it, the idle loop the map names, and every heading's
 * actions and reactions standing on the ground its idle is planted on.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  HEADINGS,
  actionClip,
  headingClip,
  hitClip,
  type Heading,
} from '../../content/assets/clips';
import {
  TOPDOWN_KEYS,
  resolveAsset,
  useTopDownStyle,
  type SheetEntry,
} from '../../content/assets/manifest';
import type { FrameFeet } from './feet';
import { resolveClip } from './resolveClip';
import { withActions, type SheetActions, type SheetClips } from './store';

const read = <T>(path: string): T => JSON.parse(readFileSync(`public/${path}`, 'utf8')) as T;

function sheet(key: string): { entry: SheetEntry; clips: SheetClips; actions: SheetActions } {
  const entry = resolveAsset(key);
  if (entry.kind !== 'sheet' || !entry.actions) throw new Error(`${key}: no actions`);
  const clips = { ...entry.clips, ...(entry.clipData ? read<SheetClips>(entry.clipData) : {}) };
  return { entry, clips, actions: read<SheetActions>(entry.actions) };
}

const folded = (key: string): SheetClips => {
  const { entry, clips, actions } = sheet(key);
  return withActions(entry, clips, actions, new Map(), () => undefined);
};

beforeAll(() => useTopDownStyle());

describe('a top-down sheet with its actions', () => {
  it('names every pose in all eight headings, each as drawn', () => {
    const { actions } = sheet('unit.fire.kaya');
    const clips = folded('unit.fire.kaya');
    for (const pose of ['jab', 'whip', 'stomp', 'blast', 'ko'])
      for (const heading of HEADINGS)
        expect(clips[actionClip(pose, heading)]?.frames).toEqual(actions[pose]?.[heading]?.frames);
  });

  it("plays each ability's own pose, and the sheet's cast pose for any other", () => {
    const clips = folded('unit.fire.kaya');
    const frames = (clip: `${string}@${Heading}`) => clips[clip]?.frames;
    expect(frames('flame_arc@north')).toEqual(frames('whip@north'));
    expect(frames('fire_blast@southWest')).toEqual(frames('blast@southWest'));
    expect(frames('fire_step@west')).toEqual(frames('stomp@west'));
    expect(frames('cast@northEast')).toEqual(frames('jab@northEast'));
    expect(frames('fire_jab@east')).toBeUndefined();
  });

  it('maps every ability-bearing pose of every shipped sheet, and only poses the sheet draws', () => {
    for (const key of Object.keys(TOPDOWN_KEYS)) {
      const entry = resolveAsset(key);
      if (entry.kind !== 'sheet' || !entry.actions) continue;
      const poses = Object.keys(read<SheetActions>(entry.actions));
      const map = entry.actionMap;
      expect(map, key).toBeDefined();
      const used = new Set([map?.cast, map?.idle, ...Object.values(map?.abilities ?? {})]);
      used.delete(undefined);
      for (const pose of used) expect(poses, `${key} ${pose}`).toContain(pose);
      // Every pose but the knockout is played by something.
      for (const pose of poses) if (pose !== 'ko') expect(used, `${key} ${pose}`).toContain(pose);
    }
  });

  it('loops the Driller rumble in place of its idle, and keeps the static view as its rest', () => {
    const { clips: own, actions } = sheet('unit.enemy.driller');
    const clips = folded('unit.enemy.driller');
    for (const heading of HEADINGS) {
      const idle = clips[headingClip('idle', heading)];
      expect(idle?.frames).toEqual(actions.rumble?.[heading]?.frames);
      expect(idle?.loop).toBe(true);
      expect(clips[headingClip('rest', heading)]).toBe(own[headingClip('rest', heading)]);
      // The tread loop is its walk; the slam its attack; the shudder its hit.
      expect(resolveClip(clips, headingClip('walk', heading))?.def.frames[0]).toMatch(/\/walk/);
      expect(clips[actionClip('cast', heading)]?.frames).toEqual(actions.slam?.[heading]?.frames);
      expect(clips[hitClip(heading)]?.frames[0]).toMatch(/\/hit/);
      expect(clips[actionClip('ko', heading)]?.loop).toBe(false);
    }
  });

  it('stands every heading on the ground its idle is planted on', () => {
    const { entry, clips, actions } = sheet('unit.fire.kaya');
    const h = entry.frameSize?.h ?? 0;
    const idleNorth = clips.idleNorth?.frames[0] ?? '';
    // North's idle soles stand 2 px above the sheet's foot line: its actions are lifted with it.
    const feet = new Map<string, FrameFeet>([
      [
        idleNorth,
        { ground: entry.anchor.y * h - 2, soles: new Int16Array(0), centre: { x: 0, y: 0 } },
      ],
    ]);
    const frame = { x: 0, y: 0, w: entry.frameSize?.w ?? 0, h };
    const out = withActions(entry, clips, actions, feet, (name) =>
      name === idleNorth ? frame : undefined,
    );
    for (const clip of ['jab@north', 'ko@north', 'hitNorth'] as const) {
      const before =
        clip === 'hitNorth' ? clips.hitNorth : actions[clip.split('@')[0] ?? '']?.north;
      const size = before?.frameSize?.h ?? 1;
      expect(((out[clip]?.anchor?.y ?? 0) - (before?.anchor?.y ?? 0)) * size, clip).toBeCloseTo(-2);
    }
    expect(out['jab@east']?.anchor).toEqual(actions.jab?.east?.anchor);
  });

  it('falls back to the legacy cast and knockout while the actions are not in', () => {
    const { clips } = sheet('unit.fire.kaya');
    expect(resolveClip(clips, 'fire_jab@north')?.clip).toBe('cast');
    expect(resolveClip(clips, 'ko@north')?.clip).toBe('ko');
  });
});
