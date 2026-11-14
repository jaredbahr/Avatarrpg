import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACT1_NODES } from './act1';
import { STORY_ENTRY, STORY_PROLOGUE } from '../entry';
import {
  INTERLUDES,
  INTERLUDE_ART,
  INTERLUDE_CARDS,
  interludeHoldMs,
  isCardStill,
} from './interludes';

describe('illustrated story continuity', () => {
  for (const [id, scene] of Object.entries(INTERLUDES)) {
    it(`${id} covers every authored line with shipped art`, () => {
      const node = ACT1_NODES.find((candidate) => candidate.id === id);
      expect(node && (node.kind === 'dialogue' || node.kind === 'end')).toBe(true);
      if (!node || (node.kind !== 'dialogue' && node.kind !== 'end')) return;
      expect(scene.shots).toHaveLength(node.lines.length + (node.kind === 'end' ? 1 : 0));
      for (const shot of scene.shots) {
        const art = INTERLUDE_ART[shot];
        // A placeholder card is drawn by the stylesheet; a painting must ship.
        if (isCardStill(art)) expect(INTERLUDE_CARDS).toContain(art.card);
        else expect(existsSync(`public/art/interludes/${art.file}`)).toBe(true);
      }
    });
  }

  it('holds the outpost reveal until the final teaser in either ending', () => {
    for (const [id, scene] of Object.entries(INTERLUDES)) {
      const node = ACT1_NODES.find((candidate) => candidate.id === id);
      if (node?.kind === 'end') {
        expect(scene.shots.at(-1)).toBe('bay');
        expect(scene.shots.slice(0, -1)).not.toContain('bay');
      } else expect(scene.shots).not.toContain('bay');
    }
  });

  it('never shows liberation on the loss route or interrupts a choice', () => {
    expect(INTERLUDES.act1_epilogue_lost?.shots).not.toContain('rescue');
    expect(INTERLUDES.act1_epilogue?.shots).toContain('rescue');
    for (const node of ACT1_NODES.filter((candidate) => candidate.kind === 'choice')) {
      expect(INTERLUDES[node.id]).toBeUndefined();
    }
  });

  it('keeps every worker departure beat on the rescue image', () => {
    expect(INTERLUDES.act1_epilogue?.shots.slice(0, 4)).toEqual([
      'rescue',
      'rescue',
      'rescue',
      'rescue',
    ]);
  });

  it('opens a new game on the storm, then cuts to Ba Dan', () => {
    expect(STORY_PROLOGUE).toBe('prologue_storm');
    const prologue = ACT1_NODES.find((node) => node.id === STORY_PROLOGUE);
    expect(prologue?.kind === 'dialogue' && prologue.next).toBe(STORY_ENTRY);
    // The storm is cards until the art batch; the cut to the bowls is Ba Dan's own painting.
    const shots = INTERLUDES.prologue_storm?.shots ?? [];
    expect(shots.slice(0, -1).every((shot) => isCardStill(INTERLUDE_ART[shot]))).toBe(true);
    expect(isCardStill(INTERLUDE_ART[shots.at(-1) ?? 'village'])).toBe(false);
  });

  it('keeps the prologue nameless (the reveal ladder)', () => {
    const prologue = ACT1_NODES.find((node) => node.id === 'prologue_storm');
    const text = [
      INTERLUDES.prologue_storm?.title ?? '',
      ...(prologue?.kind === 'dialogue' ? prologue.lines : []),
      ...(INTERLUDES.prologue_storm?.shots ?? []).map((shot) => INTERLUDE_ART[shot].alt),
    ].join(' ');
    for (const name of ['Veyra', 'Sen', 'Stillwater', 'Works', 'Commonworks', 'Rusk', 'Keeper'])
      expect(text).not.toMatch(new RegExp(`\\b${name}\\b`));
  });

  it('gives long captions enough time to read', () => {
    expect(interludeHoldMs('A quiet road.')).toBeGreaterThanOrEqual(6000);
    const text = Array.from({ length: 50 }, () => 'word').join(' ');
    expect(interludeHoldMs(text)).toBeGreaterThanOrEqual(20000);
  });
});
