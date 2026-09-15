import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { DISCIPLINE_FLAGS } from '../../content/disciplines';
import { createGame, createPartyUnit } from './createGame';
import { apply } from './reducer';
import { awardXp, combinedKit, xpForLevel } from '../rules/leveling';
import { migrate, deserialize, serialize } from '../save/serialize';
import { reconcileDisciplines } from '../save/reconcile';
import type { GameState, PendingChoice, Unit } from '../types';

/**
 * The discipline gate, end to end.
 *
 * The thing worth protecting here is not the happy path — it is that a locked
 * path cannot be taken, that an unlocked one back-pays what it owes, and that
 * neither an old save nor a kit that moved under a save leaves a player
 * silently short of the reward for a level they earned.
 */

const EARTH = 'bo';
const nilak = 'nilak';

function gameAt(
  level: number,
  characterId = EARTH,
  flags: Record<string, boolean> = {},
): GameState {
  return createGame(CONTENT, {
    seed: 'discipline-tests',
    party: [{ characterId, level }],
    startNode: 'act1_open',
    flags,
  });
}

function withPendingGate(state: GameState, options: readonly string[]): GameState {
  const unit = state.party[0];
  if (!unit) throw new Error('fixture has no party');
  const choice: PendingChoice = {
    unitId: unit.id,
    level: unit.level,
    kind: 'discipline',
    options,
  };
  return { ...state, pendingChoices: [choice] };
}

function member(state: GameState): Unit {
  const unit = state.party[0];
  if (!unit) throw new Error('fixture has no party');
  return unit;
}

describe('the discipline gate', () => {
  it('queues a path choice on reaching level 5, locked options included', () => {
    const state = gameAt(4);
    const character = CONTENT.characters.get(EARTH);
    const gain = awardXp(CONTENT, member(state), xpForLevel(5) - member(state).xp, character);

    expect(gain.unit.level).toBe(5);
    expect(gain.pendingSpecializations).toEqual([['earth_shaping', 'metalbending_path']]);
  });

  it('does not queue anything before the gate', () => {
    const state = gameAt(3);
    const character = CONTENT.characters.get(EARTH);
    const gain = awardXp(CONTENT, member(state), xpForLevel(4) - member(state).xp, character);

    expect(gain.unit.level).toBe(4);
    expect(gain.pendingSpecializations).toEqual([]);
  });

  it('grants the path its level-5 ability the moment it is taken', () => {
    const state = withPendingGate(gameAt(5), ['earth_shaping', 'metalbending_path']);
    const before = member(state);
    expect(before.disciplineId).toBeNull();
    expect(before.abilities).not.toContain('mudslide');

    const result = apply(CONTENT, state, {
      type: 'chooseDiscipline',
      unitId: before.id,
      disciplineId: 'earth_shaping',
    });

    const after = member(result.state);
    expect(after.disciplineId).toBe('earth_shaping');
    expect(after.abilities).toContain('mudslide');
    expect(result.state.pendingChoices).toEqual([]);
    expect(result.events.some((e) => e.type === 'disciplineChosen')).toBe(true);
  });

  it('refuses a gated path while its flag is unset, and allows it once set', () => {
    const options = ['earth_shaping', 'metalbending_path'];
    const locked = withPendingGate(gameAt(5), options);
    const unitId = member(locked).id;

    const refused = apply(CONTENT, locked, {
      type: 'chooseDiscipline',
      unitId,
      disciplineId: 'metalbending_path',
    });
    expect(member(refused.state).disciplineId).toBeNull();
    expect(refused.state.pendingChoices).toHaveLength(1);
    expect(refused.events).toEqual([
      { type: 'message', text: expect.stringContaining('Metalbending') },
    ]);

    const open = withPendingGate(
      gameAt(5, EARTH, { [DISCIPLINE_FLAGS.metalbending]: true }),
      options,
    );
    const allowed = apply(CONTENT, open, {
      type: 'chooseDiscipline',
      unitId: member(open).id,
      disciplineId: 'metalbending_path',
    });
    expect(member(allowed.state).disciplineId).toBe('metalbending_path');
    expect(member(allowed.state).abilities).toContain('metal_cable');
  });

  it('refuses a path the gate did not offer', () => {
    const state = withPendingGate(gameAt(5), ['earth_shaping', 'metalbending_path']);
    const result = apply(CONTENT, state, {
      type: 'chooseDiscipline',
      unitId: member(state).id,
      disciplineId: 'healing_path',
    });
    expect(member(result.state).disciplineId).toBeNull();
  });

  it('applies the path stat mods on top of the character mods', () => {
    const plain = createPartyUnit(CONTENT, CONTENT.characters.get(nilak)!, 0, 5);
    const state = withPendingGate(gameAt(5, nilak, { [DISCIPLINE_FLAGS.healing]: true }), [
      'ice_shaping',
      'healing_path',
    ]);
    const result = apply(CONTENT, state, {
      type: 'chooseDiscipline',
      unitId: member(state).id,
      disciplineId: 'healing_path',
    });

    // Healing is +5 Focus, -1 Power against whatever the character already had.
    expect(member(result.state).base.focus).toBe(plain.base.focus + 5);
    expect(member(result.state).base.power).toBe(plain.base.power - 1);
  });

  it('back-pays a path taken several levels late', () => {
    const state = withPendingGate(gameAt(10), ['earth_shaping', 'metalbending_path']);
    const result = apply(CONTENT, state, {
      type: 'chooseDiscipline',
      unitId: member(state).id,
      disciplineId: 'earth_shaping',
    });

    const after = member(result.state);
    // Both flat grants land, and the level-7 pair becomes a technique choice.
    expect(after.abilities).toContain('mudslide');
    expect(after.abilities).toContain('fissure');
    expect(result.state.pendingChoices).toEqual([
      {
        unitId: after.id,
        level: 10,
        kind: 'ability',
        options: ['seismic_sense', 'boulder'],
      },
    ]);
  });

  it('carries the path into later level-ups', () => {
    const atFive = withPendingGate(gameAt(5), ['earth_shaping', 'metalbending_path']);
    const taken = apply(CONTENT, atFive, {
      type: 'chooseDiscipline',
      unitId: member(atFive).id,
      disciplineId: 'earth_shaping',
    }).state;

    const unit = member(taken);
    const gain = awardXp(
      CONTENT,
      unit,
      xpForLevel(10) - unit.xp,
      CONTENT.characters.get(EARTH),
      CONTENT.disciplines.get('earth_shaping'),
    );

    expect(gain.unit.level).toBe(10);
    expect(gain.unit.abilities).toContain('fissure');
    expect(gain.pendingChoices).toEqual([['seismic_sense', 'boulder']]);
  });

  it('builds a full level 10 ladder for a party slot that names its path', () => {
    const unit = createPartyUnit(CONTENT, CONTENT.characters.get(EARTH)!, 0, 10, undefined, {
      discipline: 'metalbending_path',
      chosen: ['earth_wall'],
    });

    expect(unit.disciplineId).toBe('metalbending_path');
    expect(unit.abilities).toEqual(
      expect.arrayContaining([
        'rock_throw',
        'stone_stance',
        'earth_wall',
        'metal_cable',
        'metal_armor',
        'metalbending',
      ]),
    );
    expect(unit.abilities).not.toContain('mudslide');
  });

  it('gives autoChoose a path, so the simulator never runs half a kit', () => {
    const unit = createPartyUnit(CONTENT, CONTENT.characters.get(EARTH)!, 0, 10, undefined, {
      autoChoose: true,
    });
    expect(unit.disciplineId).toBe('earth_shaping');
    expect(
      combinedKit(CONTENT.characters.get(EARTH), CONTENT.disciplines.get('earth_shaping')),
    ).toHaveLength(7);
    expect(unit.abilities).toContain('fissure');
  });
});

describe('saves across the discipline change', () => {
  it('migrates a format 1 blob rather than rejecting it', () => {
    const state = gameAt(4);
    const legacyUnit = { ...member(state) } as Record<string, unknown>;
    delete legacyUnit.disciplineId;

    const legacy = {
      magic: 'four-nations-tactics',
      format: 1,
      savedAt: 0,
      label: 'Old save',
      summary: 'On the road',
      state: {
        ...state,
        version: 1,
        party: [legacyUnit],
        pendingChoices: [{ unitId: 'p0', level: 3, options: ['flame_arc', 'fire_step'] }],
      },
      session: { players: [{ name: 'Elias', unitId: 'p0' }] },
    };

    const result = deserialize(JSON.stringify(legacy));
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;

    expect(result.blob.format).toBe(2);
    expect(result.blob.state.party[0]?.disciplineId).toBeNull();
    expect(result.blob.state.pendingChoices[0]?.kind).toBe('ability');
  });

  it('leaves a format 2 blob alone', () => {
    const state = gameAt(5);
    const json = serialize(state, {
      label: 'Current',
      summary: 'On the road',
      savedAt: 0,
      session: { players: [] },
    });
    const result = deserialize(json);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.blob.state).toEqual(state);
    expect(migrate(JSON.parse(json))).toEqual(JSON.parse(json));
  });

  /*
   * The case that actually loses a player something: a save taken before the
   * gate existed, on a party that is already past the level it sits at.
   */
  it('re-offers a gate a loaded save is already past', () => {
    const state = gameAt(5);
    expect(member(state).disciplineId).toBeNull();
    expect(state.pendingChoices).toEqual([]);

    const repaired = reconcileDisciplines(CONTENT, state);
    expect(repaired.pendingChoices).toEqual([
      {
        unitId: 'p0',
        level: 5,
        kind: 'discipline',
        options: ['earth_shaping', 'metalbending_path'],
      },
    ]);
  });

  it('does not re-offer a gate to a unit that already took one', () => {
    const state = withPendingGate(gameAt(5), ['earth_shaping', 'metalbending_path']);
    const taken = apply(CONTENT, state, {
      type: 'chooseDiscipline',
      unitId: member(state).id,
      disciplineId: 'earth_shaping',
    }).state;

    expect(reconcileDisciplines(CONTENT, taken)).toBe(taken);
  });

  it('does not re-offer a gate that is already pending', () => {
    const state = withPendingGate(gameAt(5), ['earth_shaping', 'metalbending_path']);
    expect(reconcileDisciplines(CONTENT, state).pendingChoices).toHaveLength(1);
  });

  it('leaves a party below the gate alone', () => {
    const state = gameAt(4);
    expect(reconcileDisciplines(CONTENT, state)).toBe(state);
  });
});
