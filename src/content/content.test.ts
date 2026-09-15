import { describe, expect, it } from 'vitest';
import { CONTENT, CONTENT_BUNDLE, STORY_ENTRY } from './index';
import { validateContent } from './schemas';
import { ELEMENTS } from './elements';
import { resolveAsset } from './assets/manifest';

/**
 * The guard rail for every piece of game data. A dangling story link or a
 * misspelled ability id fails here rather than stranding a family mid-session.
 */
describe('content', () => {
  it('passes shape and cross-reference validation', () => {
    const problems = validateContent(CONTENT_BUNDLE);
    expect(problems, `\n${problems.join('\n')}\n`).toEqual([]);
  });

  /*
   * Standing is stored in `flags` as a number, and 0 is falsy. Every flag reader
   * older than conditions tests truthiness, so a neutral nation would silently
   * read as "no standing at all" and take the wrong road. The validator is where
   * that gets caught, so the validator is what gets tested.
   */
  it('refuses a branch node that reads standing through truthiness', () => {
    const problems = validateContent({
      ...CONTENT_BUNDLE,
      story: [
        ...CONTENT_BUNDLE.story,
        {
          id: 'standing_trap',
          kind: 'branch',
          flag: 'standing.fire',
          ifSet: STORY_ENTRY,
          ifUnset: STORY_ENTRY,
        },
      ],
    });
    expect(problems.some((p) => p.includes('standing_trap') && p.includes('0 is'))).toBe(true);
  });

  it('refuses conditional enemies gated on standing', () => {
    const [first, ...rest] = CONTENT_BUNDLE.encounters;
    if (!first) throw new Error('no encounters to test against');
    const problems = validateContent({
      ...CONTENT_BUNDLE,
      encounters: [
        {
          ...first,
          conditionalEnemies: [
            { flag: 'standing.earth', whenSet: true, placements: first.reinforcements.slice(0, 1) },
          ],
        },
        ...rest,
      ],
    });
    expect(problems.some((p) => p.includes('standing.earth'))).toBe(true);
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

  it('gives every character an unlock at levels 1, 3, 5, 7 and 10', () => {
    for (const character of CONTENT_BUNDLE.characters) {
      const levels = character.kit.map((k) => k.level);
      for (const required of [1, 3, 5, 7, 10]) {
        expect(levels, `${character.id} level ${required}`).toContain(required);
      }
    }
  });

  it('offers a choice at levels 3 and 7 and a flat unlock elsewhere', () => {
    for (const character of CONTENT_BUNDLE.characters) {
      for (const entry of character.kit) {
        const isChoice = 'choose' in entry;
        const shouldBeChoice = entry.level === 3 || entry.level === 7;
        expect(isChoice, `${character.id} level ${entry.level}`).toBe(shouldBeChoice);
      }
    }
  });

  it('keeps every party ability on-element for its kit', () => {
    for (const character of CONTENT_BUNDLE.characters) {
      for (const entry of character.kit) {
        const refs = 'ability' in entry ? [entry.ability] : entry.choose;
        for (const ref of refs) {
          const ability = CONTENT.abilities.get(ref);
          expect(ability, `${character.id} -> ${ref}`).toBeDefined();
          expect(ability?.element, `${ref} on ${character.id}`).toBe(character.element);
        }
      }
    }
  });

  it('resolves every referenced asset key to a painter or an image', () => {
    const keys = new Set<string>();
    for (const c of CONTENT_BUNDLE.characters) {
      keys.add(c.portrait);
      keys.add(c.sprite);
    }
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
