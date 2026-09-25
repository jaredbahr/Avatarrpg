import { describe, expect, it } from 'vitest';
import { CONTENT, CONTENT_BUNDLE, STORY_ENTRY } from './index';
import { conditionSchema, mapSchema, storyNodeSchema, validateContent } from './schemas';
import type { ContentBundle } from './schemas';
import { ELEMENTS } from './elements';
import { resolveAsset } from './assets/manifest';
import { combinedKit } from '../core/rules/leveling';
import { createGame } from '../core/state/createGame';

/**
 * The guard rail for every piece of game data. A dangling story link or a
 * misspelled ability id fails here rather than stranding a family mid-session.
 */
describe('content', () => {
  it('accepts partial ground mode and rejects other ground modes', () => {
    const source = CONTENT_BUNDLE.maps.find((map) => map.scene);
    if (!source?.scene) throw new Error('Missing scene map');
    const partial = mapSchema.safeParse({
      ...source,
      scene: { ...source.scene, groundMode: 'partial' },
    });
    expect(partial.success).toBe(true);
    if (!partial.success) throw new Error('Partial scene should parse');
    expect(partial.data.scene?.groundMode).toBe('partial');
    const invalid = mapSchema.safeParse({
      ...source,
      scene: { ...source.scene, groundMode: 'complete' },
    });
    expect(invalid.success).toBe(false);
  });

  it('passes shape and cross-reference validation', () => {
    const problems = validateContent(CONTENT_BUNDLE);
    expect(problems, `\n${problems.join('\n')}\n`).toEqual([]);
  });

  it('requires pos only on an NpcDef that binds no resident', () => {
    const map = CONTENT_BUNDLE.maps.find((candidate) => candidate.npcs.length > 0);
    const npc = map?.npcs[0];
    if (!map || !npc) throw new Error('Missing map with an npc');
    const plain = { ...npc };
    delete plain.pos;
    const bound = (candidate: unknown) =>
      mapSchema.safeParse({ ...map, npcs: [candidate] }).success;
    // A resident-bound NpcDef takes its tile from the resident's anchor (ADR 0047 §2).
    expect(bound({ ...plain, resident: 'lw.npc.gao' })).toBe(true);
    expect(bound(plain)).toBe(false);
  });

  it('accepts a phase condition for a real phase and rejects the rest', () => {
    expect(conditionSchema.safeParse({ kind: 'phase', in: ['dawn'] }).success).toBe(true);
    expect(conditionSchema.safeParse({ kind: 'phase', in: ['tuesday'] }).success).toBe(false);
    expect(conditionSchema.safeParse({ kind: 'phase', in: [] }).success).toBe(false);
  });

  it('accepts typed resident assignments only on authored flags nodes', () => {
    const node = {
      id: 'profile_completion',
      kind: 'flags',
      set: { complete: true },
      residentProfiles: { 'lw.npc.bo_shan': 'returning' },
      next: STORY_ENTRY,
    };
    expect(storyNodeSchema.safeParse(node).success).toBe(true);
    expect(
      storyNodeSchema.safeParse({
        ...node,
        residentProfiles: { 'lw.npc.bo_shan': 'arrived' },
      }).success,
    ).toBe(false);
  });

  it('rejects a profile assignment to an unknown resident', () => {
    const problems = validateContent({
      ...CONTENT_BUNDLE,
      story: [
        ...CONTENT_BUNDLE.story,
        {
          id: 'unknown_profile_completion',
          kind: 'flags',
          set: {},
          residentProfiles: { 'lw.npc.unknown': 'returning' },
          next: STORY_ENTRY,
        },
      ],
    });
    expect(problems).toContain(
      'story node "unknown_profile_completion" writes unknown resident profile "lw.npc.unknown"',
    );
  });

  /*
   * The Slice B returnees are placeholder actors: their NPC binding points at
   * their map's explore hub on purpose, and `validateContent` defers exactly
   * those by name. That deferral used to be pre-empted by a generic exemption in
   * the presentation validator, so any resident could be pointed at the hub and
   * still pass — Dorin tapped without a conversation, silently bounced into
   * exploration. The exemption is gone; only the profile-backed case is allowed.
   */
  it('rejects an ordinary resident pointed at the explore hub, but defers the returnees', () => {
    const missingPresentation = (bundle: ContentBundle) =>
      validateContent(bundle).filter((problem) => problem.includes('has no story presentation'));
    const village = CONTENT_BUNDLE.maps.find((map) => map.id === 'ba_dan_village');
    const dorin = village?.npcs.find((npc) => npc.id === 'guard_dorin');
    if (!village || !dorin) throw new Error('Missing village Dorin');
    expect(dorin.resident).toBe('lw.npc.dorin');
    expect(dorin.node).toBe('dorin_directions');

    // The five returnees are profile-backed and keep their exemption.
    expect(missingPresentation(CONTENT_BUNDLE)).toEqual([]);

    expect(
      missingPresentation({
        ...CONTENT_BUNDLE,
        maps: CONTENT_BUNDLE.maps.map((map) =>
          map.id === village.id
            ? {
                ...map,
                npcs: map.npcs.map((npc) =>
                  npc === dorin ? { ...npc, node: 'village_explore' } : npc,
                ),
              }
            : map,
        ),
      }),
    ).toEqual([
      'map "ba_dan_village" npc "guard_dorin" conversation "village_explore" has no story presentation',
    ]);
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
    expect(withNext(ending.next ?? 'village_explore')).toEqual([]);
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

  it('refuses scene memory other than completed or declined (ADR 0047 §6)', () => {
    const problems = validateContent({
      ...CONTENT_BUNDLE,
      story: [
        ...CONTENT_BUNDLE.story,
        { id: 'scene_trap', kind: 'flags', set: { 'scene.trap': true }, next: STORY_ENTRY },
      ],
    });
    expect(problems.some((p) => p.includes('scene_trap') && p.includes('scene memory'))).toBe(true);
  });

  it('refuses a branch on scene memory, which would read declined as set', () => {
    const problems = validateContent({
      ...CONTENT_BUNDLE,
      story: [
        ...CONTENT_BUNDLE.story,
        {
          id: 'scene_branch_trap',
          kind: 'branch',
          flag: 'scene.bd01_plant_chair',
          ifSet: STORY_ENTRY,
          ifUnset: STORY_ENTRY,
        },
      ],
    });
    expect(problems.some((p) => p.includes('scene_branch_trap') && p.includes('truthy'))).toBe(
      true,
    );
  });

  it('refuses a condition comparing scene memory with a value it never holds', () => {
    const [map, ...restMaps] = CONTENT_BUNDLE.maps;
    const npc = map?.npcs[0];
    if (!map || !npc) throw new Error('Missing an NPC to probe');
    const trap = { kind: 'flag', key: 'scene.bd01_plant_chair', op: 'eq', value: 'done' } as const;
    const problems = validateContent({
      ...CONTENT_BUNDLE,
      maps: [
        {
          ...map,
          npcs: [{ ...npc, routes: [{ when: trap, node: npc.node }] }, ...map.npcs.slice(1)],
        },
        ...restMaps,
      ],
    });
    expect(problems.some((p) => p.includes(`map "${map.id}"`) && p.includes('"done"'))).toBe(true);
    // The shipped comparisons (Gao's afternoon pose) use real values.
    expect(problems.filter((p) => p.includes('scene memory') && !p.includes('"done"'))).toEqual([]);
  });

  /*
   * An authored `flags` node may advance the clock (ADR 0047 §1), but the
   * validator only allows it where a replay cannot reach it: a phase change
   * that opens straight into a conversation, or that a repeatable NPC
   * conversation can enter again, would churn time every time somebody said
   * hello. Both halves of that rule deserve a test.
   */
  it('refuses a phase node that reaches a conversation before a resting point', () => {
    const victory = CONTENT_BUNDLE.story.find((node) => node.id === 'act1_victory');
    if (victory?.kind !== 'flags') throw new Error('Missing the Act 1 victory beat');
    const problems = validateContent({
      ...CONTENT_BUNDLE,
      story: [
        ...CONTENT_BUNDLE.story.map((node) =>
          node.id === victory.id ? { ...victory, next: 'phase_trap' } : node,
        ),
        {
          id: 'phase_trap',
          kind: 'branch',
          flag: 'act1_complete',
          ifSet: 'quarry_assessment',
          ifUnset: 'quarry_assessment',
        },
      ],
    });
    expect(
      problems.some((p) => p.includes('act1_victory') && p.includes('dialogue or choice')),
    ).toBe(true);
  });

  it('refuses a phase node that an NPC conversation could replay', () => {
    const [map, ...restMaps] = CONTENT_BUNDLE.maps;
    if (!map) throw new Error('Missing maps to probe');
    const npc = map.npcs[0];
    if (!npc) throw new Error('Missing an NPC to probe');
    const victory = CONTENT_BUNDLE.story.find((node) => node.id === 'act1_victory');
    if (victory?.kind !== 'flags') throw new Error('Missing the Act 1 victory beat');
    const problems = validateContent({
      ...CONTENT_BUNDLE,
      maps: [{ ...map, npcs: [{ ...npc, node: victory.id }, ...map.npcs.slice(1)] }, ...restMaps],
    });
    expect(problems.some((p) => p.includes('act1_victory') && p.includes('churn'))).toBe(true);
  });

  it('accepts the Act 1 victory beat, which rests at an ending nobody replays', () => {
    expect(validateContent(CONTENT_BUNDLE).filter((p) => p.includes('act1_victory'))).toEqual([]);
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

  it('gives every character a distinct level-2 job within their element', () => {
    const tools = new Map([
      ['kaya', 'flame_arc'],
      ['tenzo', 'fire_blast'],
      ['nilak', 'healing_stream'],
      ['sura', 'ice_path'],
      ['bo', 'stone_stance'],
      ['lin_mei', 'shockwave'],
      ['nima', 'air_scooter'],
      ['jinu', 'gust'],
      ['riko', 'chi_block'],
      ['wen', 'gauntlet_spark'],
    ]);
    expect(tools.size).toBe(CONTENT_BUNDLE.characters.length);
    for (const character of CONTENT_BUNDLE.characters) {
      const levelTwo = character.kit.find((entry) => entry.level === 2);
      expect(levelTwo, `${character.id} level 2`).toEqual({
        level: 2,
        ability: tools.get(character.id),
      });
      expect(CONTENT.abilities.has(tools.get(character.id) ?? '')).toBe(true);
      const party = createGame(CONTENT, {
        seed: `early-${character.id}`,
        party: [{ characterId: character.id, level: 2 }],
        startNode: '',
      }).party;
      expect(party[0]?.abilities, `${character.id} in a level-2 game`).toContain(
        tools.get(character.id),
      );
    }
    for (const element of ELEMENTS) {
      const pair = CONTENT_BUNDLE.characters.filter(
        (character) => character.element === element.id,
      );
      const defaultKits = pair.map((character) =>
        createGame(CONTENT, {
          seed: `boss-${character.id}`,
          party: [{ characterId: character.id, level: 3, autoChoose: true }],
          startNode: '',
        })
          .party[0]?.abilities.slice()
          .sort()
          .join(','),
      );
      expect(new Set(defaultKits).size, `${element.id} at the Act 1 boss`).toBe(2);
    }
  });

  it('does not repeat an early technique at the discipline gate', () => {
    for (const character of CONTENT_BUNDLE.characters) {
      const early = character.kit.flatMap((entry) =>
        'ability' in entry ? [entry.ability] : 'choose' in entry ? entry.choose : [],
      );
      for (const discipline of CONTENT_BUNDLE.disciplines.filter(
        (path) => path.element === character.element,
      )) {
        const later = discipline.kit.flatMap((entry) =>
          'ability' in entry ? [entry.ability] : 'choose' in entry ? entry.choose : [],
        );
        for (const ability of early) {
          expect(later, `${character.id} / ${discipline.id}: ${ability}`).not.toContain(ability);
        }
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
