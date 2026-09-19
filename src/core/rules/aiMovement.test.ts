import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { BattleDraft } from '../state/battleDraft';
import { createBattle, createGame } from '../state/createGame';
import type { GameEvent, Unit } from '../types';
import { planAiTurn } from './ai';

function rootedGrumbler(): { draft: BattleDraft; boss: Unit } {
  const state = createGame(CONTENT, {
    seed: 'rooted-grumbler-movement',
    party: [
      { characterId: 'sura', level: 3 },
      { characterId: 'riko', level: 3 },
    ],
    startNode: '',
  });
  const battle = createBattle(CONTENT, state, 'enc_grumbler', new RngCursor(state.rng));
  const boss = battle.units.find((unit) => unit.enemyId === 'grumbler');
  const sura = battle.units.find((unit) => unit.characterId === 'sura');
  const riko = battle.units.find((unit) => unit.characterId === 'riko');
  if (!boss || !sura || !riko) throw new Error('Missing Driller movement fixture');

  const units: Unit[] = battle.units.map((unit) => {
    if (unit.id === boss.id) {
      return {
        ...unit,
        ap: 5,
        move: 3,
        statuses: [{ id: 'rooted', duration: 1, stacks: 1 }],
        // Debris was the previous action. It is still cooling down on this
        // activation, which leaves Churn legal but Slam out of reach.
        cooldowns: { driller_debris: 1 },
      };
    }
    if (unit.id === sura.id) return { ...unit, pos: { x: 11, y: 5 } };
    if (unit.id === riko.id) return { ...unit, pos: { x: 1, y: 3 } };
    return unit;
  });

  const configuredBoss = units.find((unit) => unit.id === boss.id);
  if (!configuredBoss) throw new Error('Configured Driller was lost');
  const configured = { ...battle, units };
  return {
    draft: new BattleDraft(CONTENT, configured, new RngCursor(0x1234)),
    boss: configuredBoss,
  };
}

function eventsFor(events: readonly GameEvent[], type: GameEvent['type']): GameEvent[] {
  return events.filter((event) => event.type === type);
}

describe('AI movement status gates', () => {
  it('keeps a rooted boss in place while allowing a legal stationary ability', () => {
    const { draft, boss } = rootedGrumbler();

    planAiTurn(draft, boss.id, new RngCursor(0x5678));

    const after = draft.unit(boss.id);
    expect(after?.pos).toEqual({ x: 15, y: 5 });
    expect(after?.move).toBe(3);
    expect(eventsFor(draft.events, 'unitMoved')).toEqual([]);
    expect(
      eventsFor(draft.events, 'abilityUsed').map((event) =>
        event.type === 'abilityUsed' ? event.abilityId : null,
      ),
    ).toContain('driller_churn');
  });

  it('does not reposition a rooted unit when no ability is available', () => {
    const { draft, boss } = rootedGrumbler();
    draft.replace({ ...boss, abilities: [], ap: 0 });

    planAiTurn(draft, boss.id, new RngCursor(0x9abc));

    expect(draft.unit(boss.id)?.pos).toEqual({ x: 15, y: 5 });
    expect(eventsFor(draft.events, 'unitMoved')).toEqual([]);
  });
});
