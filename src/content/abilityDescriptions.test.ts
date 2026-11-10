import { describe, expect, it } from 'vitest';
import {
  analyzeAbilityDescription,
  checkAbilityDescription,
} from '../../scripts/content/ability-description-claims';
import { CONTENT } from './index';

function ability(id: string) {
  const found = CONTENT.abilities.get(id);
  if (!found) throw new Error(`Missing real ability ${id}`);
  return found;
}

describe('authored ability description claims', () => {
  it.each([...CONTENT.abilities.values()])('$id agrees with its stated mechanics', (entry) => {
    const issues = checkAbilityDescription(CONTENT, entry);
    expect(issues, JSON.stringify(issues, null, 2)).toEqual([]);
  });

  it.each([
    ['rock_throw', 'One enemy up to 99 tiles away.', 'range'],
    ['flame_arc', 'A cone two tiles deep.', 'shape'],
    ['ice_spikes', 'A 5×5 area.', 'shape'],
    ['fire_jab', 'At 9 AP you can attack.', 'apCost'],
    ['pressure_points', 'Gives you 2 AP back.', 'apGrant'],
    ['fire_wall', 'Cooldown: 9 rounds.', 'cooldown'],
    ['fire_jab', 'It can be used only once a turn.', 'cooldownUpperBound'],
    ['water_whip', 'Leaves them Rooted for 2 rounds.', 'status'],
    ['water_whip', 'Leaves them Drowsy for 2 rounds.', 'status'],
    ['water_whip', 'Leaves them Wet for 9 rounds.', 'statusDuration'],
    ['water_whip', 'A 10% chance to leave them Wet for 2 rounds.', 'statusChance'],
    ['healing_stream', 'Clears Frozen.', 'cleanse'],
    ['ice_spikes', 'The ground turns to mud for 2 rounds.', 'surface'],
    ['ice_spikes', 'The ground turns to ice for 9 rounds.', 'surfaceDuration'],
    ['air_scooter', 'You must see the destination.', 'abilityLoS'],
    ['smoke_bomb', 'The cloud blocks sight.', 'surfaceLoS'],
    ['fire_jab', 'Base fire damage: 99.', 'baseDamage'],
    ['fire_jab', 'Ignores Defence.', 'ignoreDefence'],
    ['fire_jab', 'Fire damage is doubled if they are Wet.', 'wetMultiplier'],
    ['air_blast', 'Pushes them 9 tiles away.', 'displacement'],
    ['rock_throw', 'Range 99 squares.', 'unclassified'],
    ['rock_throw', 'It costs 19 mana.', 'unclassified'],
    ['flame_arc', 'A cone within 4 rounds.', 'unclassified'],
    ['water_whip', 'Wet for 2 AP. Guarded for 2 rounds.', 'unclassified'],
    ['ice_spikes', 'The ground turns to ice for 2 AP. Chilled for 2 rounds.', 'unclassified'],
    ['fire_wall', 'Usable every 9 turns.', 'cooldown'],
    ['water_whip', 'Leaves them Wet for 2 rounds.', 'statusChance'],
    ['ice_spikes', 'Onto one tile.', 'surfacePlacement'],
    ['fire_step', 'Bare ground catches fire, slow to cross.', 'surfaceMove'],
    ['tidal_wave', 'The ground floods for 3 AP.', 'unclassified'],
    ['fire_step', 'You land in fire that lasts 2 rounds, and can attack.', 'surfaceGuarantee'],
  ])('rejects a planted %s description: %s', (id, description, kind) => {
    const entry = ability(id);
    const original = structuredClone(entry);
    const issues = checkAbilityDescription(CONTENT, entry, description);
    expect(
      issues.some((issue) => issue.kind === kind),
      JSON.stringify(issues),
    ).toBe(true);
    expect(entry).toEqual(original);
    for (const issue of issues) {
      expect(issue.abilityId).toBe(id);
      expect(description.slice(issue.span.start, issue.span.end)).toBe(issue.span.text);
      expect(issue.span.text.length).toBeGreaterThan(0);
      expect(issue).toHaveProperty('expected');
      expect(issue).toHaveProperty('actual');
    }
  });

  it.each([
    'fire_wall', // Three-tile line, six-tile aiming range.
    'metal_cable', // Seven-tile range, three-tile pull.
    'pressure_points', // Three AP spent, one AP returned.
    'smoke_bomb', // Steam does not block sight; the ability requires sight.
    'purifying_mist', // Named cleanses are not applied debuffs.
    'ice_path', // Ice contact Chills; existing water can become Frozen.
    'flame_arc', // A fan of fire does not claim to paint a fire surface.
    'rock_throw', // Existing fire/water reactions are not direct surfaces.
    'gust', // Clears steam and spreads existing fire.
    'torch_toss', // Two-round paint and conditional oil/water reactions.
    'tidal_wave', // Shared/trailing status and surface duration clauses.
    'octopus_form', // Wet for three rounds, Guarded for two.
    'disruptor_array', // Separate chances with one shared duration.
  ])('keeps category boundaries and conditional prose honest: %s', (id) => {
    expect(checkAbilityDescription(CONTENT, ability(id))).toEqual([]);
  });

  it('binds coordinated statuses and trailing durations to their named subjects', () => {
    const cases = [
      ['pressure_points', 'statusDuration', 3, 2],
      ['disruptor_array', 'statusDuration', 2, 2],
      ['octopus_form', 'statusDuration', 3, 1],
      ['octopus_form', 'statusDuration', 2, 1],
      ['dragon_breath', 'surfaceDuration', 2, 1],
      ['tidal_wave', 'surfaceDuration', 3, 1],
    ] as const;
    for (const [id, kind, expected, count] of cases) {
      const report = analyzeAbilityDescription(CONTENT, ability(id));
      expect(
        report.claims.filter((claim) => claim.kind === kind && claim.expected === expected),
        id,
      ).toHaveLength(count);
    }
  });

  it('rejects unqualified dash landing and all-terrain surface promises', () => {
    const entry = ability('fire_step');
    const description =
      'Leap to any tile you can see within 4. You land in fire that lasts 2 rounds, so you take its damage and start Burning.';
    const issues = checkAbilityDescription(CONTENT, entry, description);
    expect(issues.some((issue) => issue.kind === 'dashLanding')).toBe(true);
    expect(issues.some((issue) => issue.kind === 'surfaceGuarantee')).toBe(true);
  });

  it('accepts qualified dash consequences without freezing editorial wording', () => {
    const description =
      'Jet to an open tile you can see within 4. Bare ground catches fire for 2 rounds and can leave you Burning; water turns to steam instead.';
    expect(checkAbilityDescription(CONTENT, ability('fire_step'), description)).toEqual([]);
  });

  it('accepts an explicit terrain condition on the landing clause', () => {
    const description =
      'On bare ground, you land in fire that lasts 2 rounds; water turns to steam instead.';
    expect(checkAbilityDescription(CONTENT, ability('fire_step'), description)).toEqual([]);
  });

  it('does not require numbers or effects the description never states', () => {
    expect(
      checkAbilityDescription(CONTENT, ability('rock_throw'), 'A stone hurled at your opponent.'),
    ).toEqual([]);
  });
});
