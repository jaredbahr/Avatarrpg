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

  it('only resumes an end screen at an existing exploration node', () => {
    const ending = CONTENT_BUNDLE.story.find((node) => node.id === 'act1_epilogue');
    if (ending?.kind !== 'end') throw new Error('Missing Act 1 ending');
    const withNext = (next: string) =>
      validateContent({
        ...CONTENT_BUNDLE,
        story: CONTENT_BUNDLE.story.map((node) =>
          node.id === ending.id ? { ...ending, next } : node,
        ),
      });
    expect(withNext('village_explore')).toEqual([]);
    expect(withNext('battle_grumbler')).toContain(
      'story node "act1_epilogue" continues to "battle_grumbler", which is not an explore node',
    );
    expect(withNext('missing_explore')).toContain(
      'story node "act1_epilogue" links to "missing_explore", which does not exist',
    );
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

  /*
   * No shipping encounter uses `conditionalEnemies` any more, so without these
   * the budget rule is unexercised and could rot into a no-op. The case it
   * exists to catch is the one that shipped: two mercenaries added to the
   * quarry floor boss, a 9% win rate, and nothing in the repo able to see it.
   */
  it('refuses a conditional group that piles bodies onto the authored roster', () => {
    const boss = CONTENT_BUNDLE.encounters.find((e) => e.id === 'enc_grumbler');
    if (!boss) throw new Error('the boss encounter should exist');
    const problems = validateContent({
      ...CONTENT_BUNDLE,
      encounters: [
        ...CONTENT_BUNDLE.encounters.filter((e) => e.id !== 'enc_grumbler'),
        {
          ...boss,
          conditionalEnemies: [
            {
              flag: 'ruon_traded',
              whenSet: true,
              placements: [
                { enemyId: 'merc_blade', pos: { x: 16, y: 9 } },
                { enemyId: 'merc_crossbow', pos: { x: 17, y: 6 } },
              ],
            },
          ],
        },
      ],
    });
    expect(problems.some((p) => p.includes('conditional enemies'))).toBe(true);
  });

  it('adds up conditional groups across flags rather than judging them one by one', () => {
    const boss = CONTENT_BUNDLE.encounters.find((e) => e.id === 'enc_grumbler');
    if (!boss) throw new Error('the boss encounter should exist');
    // Three groups on distinct flags, each legal alone, illegal together.
    const one = { enemyId: 'bandit_thug', pos: { x: 14, y: 3 } } as const;
    const problems = validateContent({
      ...CONTENT_BUNDLE,
      encounters: [
        ...CONTENT_BUNDLE.encounters.filter((e) => e.id !== 'enc_grumbler'),
        {
          ...boss,
          conditionalEnemies: [
            { flag: 'a', whenSet: true, placements: [one] },
            { flag: 'b', whenSet: true, placements: [{ ...one, pos: { x: 14, y: 8 } }] },
            { flag: 'c', whenSet: true, placements: [{ ...one, pos: { x: 13, y: 1 } }] },
          ],
        },
      ],
    });
    expect(problems.some((p) => p.includes('conditional enemies'))).toBe(true);
  });

  it('allows a small conditional group, and ignores the branch that cannot also fire', () => {
    const boss = CONTENT_BUNDLE.encounters.find((e) => e.id === 'enc_grumbler');
    if (!boss) throw new Error('the boss encounter should exist');
    const problems = validateContent({
      ...CONTENT_BUNDLE,
      encounters: [
        ...CONTENT_BUNDLE.encounters.filter((e) => e.id !== 'enc_grumbler'),
        {
          ...boss,
          // Same flag, opposite sides: only one of these can ever spawn, so the
          // pair costs one thug (100 of 510, 20%), not two.
          conditionalEnemies: [
            {
              flag: 'ruon_traded',
              whenSet: true,
              placements: [{ enemyId: 'bandit_thug', pos: { x: 14, y: 3 } }],
            },
            {
              flag: 'ruon_traded',
              whenSet: false,
              placements: [{ enemyId: 'bandit_thug', pos: { x: 14, y: 8 } }],
            },
          ],
        },
      ],
    });
    expect(problems.filter((p) => p.includes('conditional enemies'))).toEqual([]);
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
      expect(
        levels.slice().sort((a, b) => a - b),
        discipline.id,
      ).toEqual([5, 7, 10]);
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

  it('resolves every referenced asset key to a painter, image or sheet', () => {
    const keys = new Set<string>();
    for (const c of CONTENT_BUNDLE.characters) {
      keys.add(c.portrait);
      keys.add(c.sprite);
    }
    for (const d of CONTENT_BUNDLE.disciplines) keys.add(d.icon);
    for (const e of CONTENT_BUNDLE.enemies) keys.add(e.sprite);
    for (const a of CONTENT_BUNDLE.abilities) keys.add(a.fx);
    for (const p of CONTENT_BUNDLE.props) keys.add(p.sprite);
    for (const m of CONTENT_BUNDLE.maps) for (const npc of m.npcs) keys.add(npc.sprite);
    for (const node of CONTENT_BUNDLE.story) {
      if (node.kind === 'dialogue' || node.kind === 'choice') keys.add(node.portrait);
    }

    // The palette names `src/render/palettes.ts` knows. An unknown one falls
    // through to neutral silently, which is exactly the kind of drift a real
    // portrait dropped in with a typo would show as a grey ring in the HUD.
    const palettes = ['fire', 'water', 'earth', 'air', 'nonbender', 'enemy', 'neutral'];

    for (const key of keys) {
      const entry = resolveAsset(key);
      expect(['painter', 'image', 'sheet'], key).toContain(entry.kind);
      if (entry.kind === 'sheet') {
        expect(entry.clips.idle?.frames.length, `${key} idle`).toBeGreaterThanOrEqual(2);
        expect(entry.clips.cast?.frames.length, `${key} cast`).toBe(3);
      }
      if (entry.palette !== undefined) expect(palettes, `${key} palette`).toContain(entry.palette);
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
