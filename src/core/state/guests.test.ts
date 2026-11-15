/**
 * Guest allies (ADR 0116): units that fight on the party's side for one
 * battle and are then gone.
 *
 * The encounter here is a test-only copy of the Forest Road with placeholder
 * guests. No story text: the guests are built from existing kits.
 */

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { sameSide } from '../rules/abilities';
import { guestLevel, isGuest, isTableControlled } from '../rules/guests';
import { battleOutcome } from '../rules/turnOrder';
import { runCombat } from '../sim/runCombat';
import type { Command, ContentIndex, EncounterDef, GameEvent, GameState, Unit } from '../types';
import { createBattle, createGame } from './createGame';
import { apply } from './reducer';

const BASE = CONTENT.encounters.get('enc_forest_road');
if (!BASE) throw new Error('The Forest Road encounter is missing');

/** Placeholder guests: an AI character guest, an AI enemy guest and a table guest. */
function guestEncounter(overrides: Partial<EncounterDef> = {}): EncounterDef {
  return {
    ...BASE!,
    variants: [],
    guests: [
      { characterId: 'sura', pos: { x: 4, y: 5 }, level: { partyOffset: 1 } },
      { enemyId: 'ruon_ally', pos: { x: 5, y: 6 }, level: 2, ai: 'support' },
      { characterId: 'bo', pos: { x: 4, y: 7 }, control: 'table', name: 'Placeholder Guest' },
    ],
    ...overrides,
  };
}

function contentWith(encounter: EncounterDef): ContentIndex {
  return { ...CONTENT, encounters: new Map(CONTENT.encounters).set(encounter.id, encounter) };
}

function battleState(content: ContentIndex, seed = 'guest-ally'): GameState {
  const seeded = createGame(content, {
    seed,
    party: [
      { characterId: 'kaya', level: 2, autoChoose: true },
      { characterId: 'riko', level: 2, autoChoose: true },
    ],
    startNode: 'battle_forest_road',
  });
  const rng = new RngCursor(seeded.rng);
  const battle = createBattle(content, seeded, 'enc_forest_road', rng);
  return { ...seeded, screen: 'combat', rng: rng.state, battle };
}

function guests(state: GameState): Unit[] {
  return state.battle?.units.filter(isGuest) ?? [];
}

function active(state: GameState): Unit | undefined {
  const battle = state.battle;
  return battle?.units.find((unit) => unit.id === battle.order[battle.turnIndex]);
}

/**
 * The command a scripted table would send: people end their turn, the AI plays
 * its own. Enough to walk a fight forward deterministically.
 */
function nextCommand(state: GameState): Command {
  const unit = active(state);
  return unit && isTableControlled(unit)
    ? { type: 'endTurn', unitId: unit.id }
    : { type: 'runAiTurn' };
}

function play(content: ContentIndex, state: GameState, steps: number) {
  const events: GameEvent[] = [];
  let current = state;
  for (let i = 0; i < steps && current.battle?.phase === 'active'; i++) {
    const step = apply(content, current, nextCommand(current));
    events.push(...step.events);
    current = step.state;
  }
  return { state: current, events };
}

describe('guest allies: building the battle', () => {
  const content = contentWith(guestEncounter());
  const state = battleState(content);

  it('places each guest on the party side, temporary, and outside the party', () => {
    const list = guests(state);
    expect(list.map((unit) => unit.characterId ?? unit.enemyId)).toEqual([
      'sura',
      'ruon_ally',
      'bo',
    ]);
    for (const unit of list) {
      expect(unit.faction).toBe('ally');
      expect(unit.temporary).toBe(true);
      expect(unit.id).toMatch(/^a\d+$/);
      expect(state.party.some((member) => member.id === unit.id)).toBe(false);
    }
    expect(state.party).toHaveLength(2);
  });

  it('resolves fixed and party-relative levels, names and control modes', () => {
    const [sura, ruon, bo] = guests(state);
    expect(sura?.level).toBe(3); // the party is level 2, plus one
    expect(ruon?.level).toBe(2);
    expect(sura?.ai).toBe('aggressive');
    expect(ruon?.ai).toBe('support');
    expect(bo?.ai).toBe('none');
    expect(bo?.name).toBe('Placeholder Guest');
    expect(bo && isTableControlled(bo)).toBe(true);
    expect(sura && isTableControlled(sura)).toBe(false);
  });

  it('kits a character guest as a party member of its level would be', () => {
    const sura = guests(state)[0];
    const asMember = createGame(CONTENT, {
      seed: 1,
      party: [{ characterId: 'sura', level: 3, autoChoose: true }],
      startNode: '',
    }).party[0];
    expect(sura?.abilities).toEqual(asMember?.abilities);
    expect(sura?.base).toEqual(asMember?.base);
  });

  it('leaves an encounter without guests exactly as it was', () => {
    const plain = battleState(contentWith({ ...BASE!, guests: [] }));
    const shipped = battleState(CONTENT);
    expect(plain.battle).toEqual(shipped.battle);
  });
});

describe('guest allies: taking turns', () => {
  const content = contentWith(guestEncounter());

  it('an AI guest acts on its own turn', () => {
    const { events } = play(content, battleState(content), 40);
    const aiGuests = guests(battleState(content))
      .filter((unit) => !isTableControlled(unit))
      .map((unit) => unit.id);
    const acted = events.filter(
      (event) =>
        (event.type === 'unitMoved' || event.type === 'abilityUsed') &&
        aiGuests.includes(event.unitId),
    );
    expect(acted.length).toBeGreaterThan(0);
  });

  it('a table guest waits for people: the AI will not play it, and its own commands work', () => {
    let state = battleState(content);
    const bo = guests(state).find(isTableControlled);
    if (!bo) throw new Error('no table guest');
    for (let i = 0; i < 40 && active(state)?.id !== bo.id; i++) {
      state = apply(content, state, nextCommand(state)).state;
    }
    expect(active(state)?.id).toBe(bo.id);

    const refused = apply(content, state, { type: 'runAiTurn' });
    expect(refused.state).toBe(state);
    expect(refused.events).toEqual([{ type: 'message', text: `${bo.name} is not AI-controlled.` }]);

    const ended = apply(content, state, { type: 'endTurn', unitId: bo.id });
    expect(ended.events.some((e) => e.type === 'turnEnded' && e.unitId === bo.id)).toBe(true);
  });

  it('enemies treat a guest as one of the party, and friends as a friend', () => {
    const state = battleState(content);
    const units = state.battle!.units;
    const enemy = units.find((unit) => unit.faction === 'enemy')!;
    const hero = units.find((unit) => unit.faction === 'party')!;
    for (const guest of guests(state)) {
      expect(sameSide(guest, hero)).toBe(true);
      expect(sameSide(guest, enemy)).toBe(false);
    }
    // And in play: across a few seeds the enemy AI does go for a guest.
    const hit = ['guest-a', 'guest-b', 'guest-c'].some((seed) => {
      const start = battleState(content, seed);
      const ids = new Set(guests(start).map((unit) => unit.id));
      const foes = new Set(
        start.battle!.units.filter((unit) => unit.faction === 'enemy').map((unit) => unit.id),
      );
      return play(content, start, 200).events.some(
        (event) =>
          event.type === 'damaged' &&
          ids.has(event.unitId) &&
          event.sourceId !== null &&
          foes.has(event.sourceId) &&
          event.amount > 0,
      );
    });
    expect(hit).toBe(true);
  });
});

describe('guest allies: the end of the fight', () => {
  const content = contentWith(guestEncounter());

  /** The battle with every enemy down, sealed as a victory. */
  function won(state: GameState): GameState {
    const battle = state.battle!;
    return {
      ...state,
      battle: {
        ...battle,
        phase: 'victory',
        units: battle.units.map((unit) => (unit.faction === 'enemy' ? { ...unit, hp: 0 } : unit)),
      },
    };
  }

  it('pays XP to the party only, and nothing of a guest is carried out of the fight', () => {
    const before = battleState(content);
    const result = apply(content, won(before), { type: 'resolveBattle' });
    const gained = result.events.filter((event) => event.type === 'xpGained');
    expect(gained.map((event) => event.unitId).sort()).toEqual(['p0', 'p1']);
    expect(result.state.battle).toBeNull();
    expect(result.state.party.map((member) => member.id)).toEqual(['p0', 'p1']);
    expect(result.state.party.some(isGuest)).toBe(false);
  });

  it('a fallen guest is not a defeat by default', () => {
    const state = battleState(content);
    const battle = state.battle!;
    const sura = guests(state)[0]!;
    const downed = battle.units.map((unit) => (unit.id === sura.id ? { ...unit, hp: 0 } : unit));
    const encounter = content.encounters.get('enc_forest_road');
    expect(battleOutcome({ ...battle, units: downed }, encounter)).toBe('active');

    // Through the reducer too: the next end of turn settles the outcome.
    const fallen: GameState = { ...state, battle: { ...battle, units: downed } };
    const step = apply(content, fallen, nextCommand(fallen));
    expect(step.state.battle?.phase).toBe('active');
  });

  it('loseIfGuestFalls makes a fallen guest a defeat, said out loud, and the party is revived', () => {
    const strict = contentWith(guestEncounter({ loseIfGuestFalls: true }));
    const state = battleState(strict);
    const battle = state.battle!;
    const sura = guests(state)[0]!;
    const fallen: GameState = {
      ...state,
      battle: {
        ...battle,
        units: battle.units.map((unit) => (unit.id === sura.id ? { ...unit, hp: 0 } : unit)),
      },
    };
    const step = apply(strict, fallen, nextCommand(fallen));
    expect(step.state.battle?.phase).toBe('defeat');
    expect(step.events).toContainEqual({ type: 'battleEnded', outcome: 'defeat' });
    expect(step.events).toContainEqual({
      type: 'message',
      text: `${sura.name} has fallen. This fight is lost.`,
    });

    const resolved = apply(strict, step.state, { type: 'resolveBattle' });
    expect(resolved.state.party.every((member) => member.hp === member.base.maxHp)).toBe(true);
    expect(resolved.state.party.some(isGuest)).toBe(false);
  });

  it('"Try again" rebuilds the guests fresh from the opening board', () => {
    const state = battleState(content);
    const opening = state.battle!;
    const lost: GameState = {
      ...state,
      battle: {
        ...opening,
        phase: 'defeat',
        units: opening.units.map((unit) => (isGuest(unit) ? { ...unit, hp: 0 } : unit)),
      },
    };
    const retried = apply(content, lost, { type: 'retryBattle' }).state;
    expect(guests(retried)).toEqual(guests(state));
  });
});

describe('guest allies: determinism', () => {
  it('the same seed and the same commands give the same events and state', () => {
    const content = contentWith(guestEncounter());
    const a = play(content, battleState(content, 'guest-determinism'), 60);
    const b = play(content, battleState(content, 'guest-determinism'), 60);
    expect(b.events).toEqual(a.events);
    expect(b.state).toEqual(a.state);
  });

  it('the headless simulator plays a guest fight to the end, table guests included', () => {
    const content = contentWith(guestEncounter());
    const result = runCombat(content, {
      encounterId: 'enc_forest_road',
      seed: 'guest-sim',
      party: [{ characterId: 'kaya' }, { characterId: 'riko' }],
    });
    expect(result.outcome).not.toBe('stalemate');
    expect(result.anomalies).toEqual([]);
  });
});

describe('guestLevel', () => {
  const party = [{ level: 2 }, { level: 3 }, { level: 3 }];
  it('defaults to the encounter level, takes a fixed level, and follows the party mean', () => {
    expect(guestLevel(undefined, party, 4)).toBe(4);
    expect(guestLevel(6, party, 4)).toBe(6);
    expect(guestLevel({ partyOffset: 0 }, party, 4)).toBe(3);
    expect(guestLevel({ partyOffset: -1 }, party, 4)).toBe(2);
  });
  it('stays within 1..10', () => {
    expect(guestLevel({ partyOffset: -9 }, party, 4)).toBe(1);
    expect(guestLevel({ partyOffset: 9 }, party, 4)).toBe(10);
    expect(guestLevel({ partyOffset: 1 }, [], 4)).toBe(5);
  });
});
