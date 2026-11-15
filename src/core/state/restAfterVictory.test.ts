import { describe, expect, it } from 'vitest';
import { CONTENT, STORY_ENTRY } from '../../content';
import { createGame, restAfterVictory } from './createGame';

/**
 * The rest after a won fight had no test of its own: the quarry checkpoints
 * used to hold it only through a digest of the whole save (#795).
 */
describe('rest after a won fight', () => {
  const party = createGame(CONTENT, {
    seed: 'rest-after-victory',
    party: [{ characterId: 'kaya' }, { characterId: 'nilak' }, { characterId: 'bo' }],
    startNode: STORY_ENTRY,
  }).party;
  const hurt = (hp: (maxHp: number) => number) =>
    party.map((member) => ({ ...member, hp: hp(member.base.maxHp) }));

  it('gives each hero back a quarter of their full health', () => {
    const rested = restAfterVictory(hurt(() => 1));
    for (const member of rested)
      expect(member.hp, member.name).toBe(1 + Math.round(member.base.maxHp / 4));
    // Stated once in plain numbers, so a changed share cannot hide in the formula above.
    const bo = rested.find((member) => member.characterId === 'bo');
    expect(bo?.base.maxHp).toBe(38);
    expect(bo?.hp).toBe(11);
  });

  it('never heals past full health', () => {
    const rested = restAfterVictory(hurt((maxHp) => maxHp - 1));
    for (const member of rested) expect(member.hp, member.name).toBe(member.base.maxHp);
  });

  it('gets a hero who fell back on their feet, and changes nothing else', () => {
    const before = hurt(() => 0);
    const rested = restAfterVictory(before);
    for (const [index, member] of rested.entries()) {
      expect(member.hp, member.name).toBeGreaterThan(0);
      expect({ ...member, hp: 0 }).toEqual(before[index]);
    }
  });

  it('does not change the party it was given', () => {
    const before = hurt(() => 5);
    const copy = structuredClone(before);
    restAfterVictory(before);
    expect(before).toEqual(copy);
  });
});
