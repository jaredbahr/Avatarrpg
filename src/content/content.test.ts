import { describe, expect, it } from 'vitest';
import { CONTENT, CONTENT_BUNDLE, STORY_ENTRY } from './index';
import { validateContent } from './schemas';
import { ELEMENTS } from './elements';
import { resolveAsset } from './assets/manifest';
import { combinedKit } from '../core/rules/leveling';

/**
 * The guard rail for every piece of game data. A dangling story link or a
 * misspelled ability id fails here rather than stranding a family mid-session.
 */
describe('content', () => {
  it('passes shape and cross-reference validation', () => {
    const problems = validateContent(CONTENT_BUNDLE);
    expect(problems, `\n${problems.join('\n')}\n`).toEqual([]);
  });

  it('indexes every item exactly once', () => {
    expect(CONTENT.abilities.size).toBe(CONTENT_BUNDLE.abilities.length);
    expect(CONTENT.characters.size).toBe(CONTENT_BUNDLE.characters.length);
    expect(CONTENT.enemies.size).toBe(CONTENT_BUNDLE.enemies.length);
    expect(CONTENT.maps.size).toBe(CONTENT_BUNDLE.maps.length);
    expect(CONTENT.encounters.size).toBe(CONTENT_BUNDLE.encounters.length);
    expect(CONTENT.story.size).toBe(CONTENT_BUNDLE.story.length);
  });

  it('starts at a node that exists', () => {
    expect(CONTENT.story.has(STORY_ENTRY)).toBe(true);
  });

  it('offers exactly two characters per element', () => {
    for (const element of ELEMENTS) {
      const matching = CONTENT_BUNDLE.characters.filter((c) => c.element === element.id);
      expect(matching.length, `element ${element.id}`).toBe(2);
    }
  });

  it('gives every character an unlock at levels 1, 3 and 5', () => {
    for (const character of CONTENT_BUNDLE.characters) {
      const levels = character.kit.map((k) => k.level);
      for (const required of [1, 3, 5]) {
        expect(levels, `${character.id} level ${required}`).toContain(required);
      }
    }
  });

  /*
   * The cadence, since it moved when disciplines landed: a character kit runs
   * 1, 2, 3, 5 and stops — a choice at 3, the discipline gate at 5, flat grants
   * either side. Levels 7 and 10 belong to the path, not to the character.
   */
  it('offers a choice at level 3, the gate at level 5, and nothing above it', () => {
    for (const character of CONTENT_BUNDLE.characters) {
      for (const entry of character.kit) {
        const where = `${character.id} level ${entry.level}`;
        expect(entry.level, where).toBeLessThanOrEqual(5);
        expect('choose' in entry, where).toBe(entry.level === 3);
        expect('specialize' in entry, where).toBe(entry.level === 5);
      }
    }
  });

  it('has every discipline supply levels 5, 7 and 10', () => {
    for (const discipline of CONTENT_BUNDLE.disciplines) {
      const levels = discipline.kit.map((k) => k.level);
      expect(levels.slice().sort((a, b) => a - b), discipline.id).toEqual([5, 7, 10]);
    }
  });

  it('keeps every party ability on-element for its kit', () => {
    const ladders = CONTENT_BUNDLE.characters.flatMap((character) =>
      [undefined, ...CONTENT_BUNDLE.disciplines.filter((d) => d.element === character.element)].map(
        (discipline) => ({ character, discipline }),
      ),
    );

    for (const { character, discipline } of ladders) {
      for (const entry of combinedKit(character, discipline)) {
        const refs = 'ability' in entry ? [entry.ability] : 'choose' in entry ? entry.choose : [];
        for (const ref of refs) {
          const ability = CONTENT.abilities.get(ref);
          expect(ability, `${character.id} -> ${ref}`).toBeDefined();
          expect(ability?.element, `${ref} on ${character.id}`).toBe(character.element);
        }
      }
    }
  });

  /*
   * The floor the whole gating model rests on. If an element ever loses its
   * unconditional path, a table that skipped the optional story reaches level 5
   * and is shown nothing it can take.
   */
  it('gives every element at least two paths, one of them ungated', () => {
    for (const element of ELEMENTS) {
      const paths = CONTENT_BUNDLE.disciplines.filter((d) => d.element === element.id);
      expect(paths.length, `element ${element.id}`).toBeGreaterThanOrEqual(2);
      expect(
        paths.filter((d) => d.requiresFlag === null).length,
        `element ${element.id} has no ungated path`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('offers every discipline at the gate of both characters of its element', () => {
    for (const discipline of CONTENT_BUNDLE.disciplines) {
      const offeredBy = CONTENT_BUNDLE.characters.filter((c) =>
        c.kit.some((e) => 'specialize' in e && e.specialize.includes(discipline.id)),
      );
      expect(offeredBy.map((c) => c.id).sort(), discipline.id).toEqual(
        CONTENT_BUNDLE.characters
          .filter((c) => c.element === discipline.element)
          .map((c) => c.id)
          .sort(),
      );
    }
  });

  it('lands a level 10 character on six abilities whichever path they took', () => {
    for (const character of CONTENT_BUNDLE.characters) {
      for (const discipline of CONTENT_BUNDLE.disciplines.filter(
        (d) => d.element === character.element,
      )) {
        const kit = combinedKit(character, discipline);
        // Three flat grants below the gate plus three from the path, and one
        // pick from each choice offered along the way.
        const flat = kit.filter((e) => 'ability' in e).length;
        const picks = kit.filter((e) => 'choose' in e).length;
        expect(flat + picks, `${character.id} / ${discipline.id}`).toBe(6);
      }
    }
  });

  it('resolves every referenced asset key to a painter or an image', () => {
    const keys = new Set<string>();
    for (const c of CONTENT_BUNDLE.characters) {
      keys.add(c.portrait);
      keys.add(c.sprite);
    }
    for (const d of CONTENT_BUNDLE.disciplines) keys.add(d.icon);
    for (const e of CONTENT_BUNDLE.enemies) keys.add(e.sprite);
    for (const a of CONTENT_BUNDLE.abilities) keys.add(a.fx);
    for (const m of CONTENT_BUNDLE.maps) for (const npc of m.npcs) keys.add(npc.sprite);
    for (const node of CONTENT_BUNDLE.story) {
      if (node.kind === 'dialogue' || node.kind === 'choice') keys.add(node.portrait);
    }

    for (const key of keys) {
      const entry = resolveAsset(key);
      expect(entry.kind === 'painter' || entry.kind === 'image', key).toBe(true);
    }
  });

  it('keeps AP costs inside the 1/2/3 convention', () => {
    for (const ability of CONTENT_BUNDLE.abilities) {
      expect([1, 2, 3], `${ability.id} costs ${ability.apCost}`).toContain(ability.apCost);
    }
  });

  it('gives every combo rule a plain-language label', () => {
    for (const combo of CONTENT_BUNDLE.combos) {
      expect(combo.label.length, combo.id).toBeGreaterThan(8);
    }
  });

  it('has no two combo rules matching the same (existing, applied) pair', () => {
    const seen = new Map<string, string>();
    for (const combo of CONTENT_BUNDLE.combos) {
      const key = `${combo.existing ?? 'bare'}+${combo.applied}`;
      const previous = seen.get(key);
      expect(previous, `${combo.id} duplicates ${previous} on ${key}`).toBeUndefined();
      seen.set(key, combo.id);
    }
  });
});
