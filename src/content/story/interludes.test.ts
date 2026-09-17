import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACT1_NODES } from './act1';
import { INTERLUDES, INTERLUDE_ART, interludeHoldMs } from './interludes';

describe('illustrated story continuity', () => {
  for (const [id, scene] of Object.entries(INTERLUDES)) {
    it(`${id} covers every authored line with shipped art`, () => {
      const node = ACT1_NODES.find((candidate) => candidate.id === id);
      expect(node && (node.kind === 'dialogue' || node.kind === 'end')).toBe(true);
      if (!node || (node.kind !== 'dialogue' && node.kind !== 'end')) return;
      expect(scene.shots).toHaveLength(node.lines.length + (node.kind === 'end' ? 1 : 0));
      for (const shot of scene.shots) {
        expect(existsSync(`public/art/interludes/${INTERLUDE_ART[shot].file}`)).toBe(true);
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

  it('gives long captions enough time to read', () => {
    expect(interludeHoldMs('A quiet road.')).toBeGreaterThanOrEqual(6000);
    const text = Array.from({ length: 50 }, () => 'word').join(' ');
    expect(interludeHoldMs(text)).toBeGreaterThanOrEqual(20000);
  });
});
