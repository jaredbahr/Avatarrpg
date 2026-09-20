import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import type { GameState } from '../types';
import { MAX_BANKED_TOTAL_AP, startingAp } from '../rules/stats';
import { deserialize, serialize, stateFromBlob } from '../save/serialize';
import { BattleDraft } from './battleDraft';
import { absorbBattleResults, createBattle, createGame, reviveParty } from './createGame';
import { apply } from './reducer';

const meta = { label: 'Support AP', summary: '', savedAt: 0, session: { players: [] } };
function fixture(): GameState {
  const state = createGame(CONTENT, {
    seed: 'ally-ap-proof',
    startNode: '',
    party: [
      { characterId: 'nima', level: 7, discipline: 'air_shaping', autoChoose: true },
      { characterId: 'jinu', level: 7, discipline: 'air_shaping', autoChoose: true },
    ],
  });
  const rng = new RngCursor(state.rng);
  const battle = createBattle(CONTENT, state, 'enc_quarry_gate', rng);
  return { ...state, screen: 'combat', battle, rng: rng.state };
}
function unit(state: GameState, id = 'p1') {
  const found = state.battle?.units.find((u) => u.id === id);
  if (!found) throw new Error('Missing unit');
  return found;
}
function draftFor(state: GameState) {
  if (!state.battle) throw new Error('Missing battle');
  return new BattleDraft(CONTENT, state.battle, new RngCursor(state.rng));
}
function cushion(state: GameState) {
  const result = apply(CONTENT, state, {
    type: 'useAbility',
    unitId: 'p0',
    abilityId: 'air_cushion',
    target: unit(state).pos,
  });
  expect(result.events.some((e) => e.type === 'abilityUsed')).toBe(true);
  return result.state;
}
function roundTrip(state: GameState) {
  const loaded = deserialize(serialize(state, meta));
  if (!loaded.ok) throw new Error('Save failed');
  return stateFromBlob(loaded.blob);
}

describe('support AP', () => {
  it('preserves a legal Air Cushion bonus through save/reload and the recipient activation', () => {
    const cast = cushion(fixture());
    expect(unit(cast)).toMatchObject({ ap: 4, pendingAp: 1 });
    expect(roundTrip(cast)).toEqual(cast);
    for (const state of [cast, roundTrip(cast)]) {
      const next = apply(CONTENT, state, { type: 'endTurn', unitId: 'p0' }).state;
      expect(next.battle?.order[next.battle.turnIndex]).toBe('p1');
      expect(unit(next)).toMatchObject({ ap: 5, pendingAp: 0 });
    }
  });

  it('also preserves support given after the recipient already acted', () => {
    let state = fixture();
    state = apply(CONTENT, state, { type: 'endTurn', unitId: 'p0' }).state;
    state = apply(CONTENT, state, { type: 'endTurn', unitId: 'p1' }).state;
    for (let turn = 0; turn < 8 && state.battle?.order[state.battle.turnIndex] !== 'p0'; turn++) {
      state = apply(CONTENT, state, { type: 'runAiTurn' }).state;
    }
    expect(unit(state)).toMatchObject({ ap: 0, bankedAp: 1 });
    const cast = cushion(state);
    expect(unit(cast)).toMatchObject({ ap: 0, pendingAp: 1, bankedAp: 1 });
    const next = apply(CONTENT, cast, { type: 'endTurn', unitId: 'p0' }).state;
    expect(unit(next)).toMatchObject({ ap: 6, pendingAp: 0, bankedAp: 0 });
  });

  it('stacks pending grants without changing current AP and caps the eventual refill', () => {
    const state = fixture(),
      draft = draftFor(state);
    draft.replace({ ...unit(state), bankedAp: 1 });
    draft.grantAp('p1', 2);
    draft.grantAp('p1', 9);
    const pending = draft.unit('p1');
    expect(pending).toMatchObject({ ap: 4, bankedAp: 1, pendingAp: MAX_BANKED_TOTAL_AP });
    if (!pending) throw new Error('Missing unit');
    expect(startingAp(CONTENT, pending)).toBe(MAX_BANKED_TOTAL_AP);
    draft.beginTurn('p1');
    expect(draft.unit('p1')).toMatchObject({ ap: MAX_BANKED_TOTAL_AP, bankedAp: 0, pendingAp: 0 });
  });

  it.each(['frozen', 'stunned'] as const)(
    'consumes pending AP on a skipped %s activation',
    (id) => {
      const state = fixture(),
        draft = draftFor(state);
      draft.replace({
        ...unit(state),
        bankedAp: 1,
        pendingAp: 2,
        statuses: [{ id, duration: 1, stacks: 1 }],
      });
      expect(draft.beginTurn('p1')).toBe(true);
      expect(draft.unit('p1')).toMatchObject({ ap: 0, bankedAp: 0, pendingAp: 0 });
      draft.beginTurn('p1');
      expect(draft.unit('p1')?.ap).toBe(4);
    },
  );

  it('keeps active-unit refunds immediately spendable under the shared cap', () => {
    const state = fixture(),
      draft = draftFor(state);
    draft.spendAp('p0', 3);
    draft.grantAp('p0', 1);
    expect(draft.unit('p0')).toMatchObject({ ap: 2, pendingAp: 0 });
    draft.grantAp('p0', 20);
    expect(draft.unit('p0')?.ap).toBe(MAX_BANKED_TOTAL_AP);
  });

  it('retains the real Pressure Points self-refund after paying its cost', () => {
    const state = createGame(CONTENT, {
      seed: 'pressure-refund',
      startNode: '',
      party: [{ characterId: 'riko', level: 10, discipline: 'field_craft', autoChoose: true }],
    });
    const rng = new RngCursor(state.rng);
    const battle = createBattle(CONTENT, state, 'enc_quarry_gate', rng);
    const adjacent = {
      ...battle,
      units: battle.units.map((u) => (u.faction === 'enemy' ? { ...u, pos: { x: 2, y: 3 } } : u)),
    };
    const result = apply(
      CONTENT,
      { ...state, screen: 'combat', battle: adjacent, rng: rng.state },
      { type: 'useAbility', unitId: 'p0', abilityId: 'pressure_points', target: { x: 2, y: 3 } },
    );
    expect(result.events.some((e) => e.type === 'abilityUsed')).toBe(true);
    expect(unit(result.state, 'p0')).toMatchObject({ ap: 3, pendingAp: 0 });
  });

  it('loads older v3 party and battle units with zero pending AP', () => {
    const raw = JSON.parse(serialize(fixture(), meta)) as {
      state: { party: { pendingAp?: number }[]; battle: { units: { pendingAp?: number }[] } };
    };
    for (const u of [...raw.state.party, ...raw.state.battle.units]) delete u.pendingAp;
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const state = stateFromBlob(loaded.blob);
    expect([...state.party, ...(state.battle?.units ?? [])].every((u) => u.pendingAp === 0)).toBe(
      true,
    );
  });

  it('clears support bonuses at battle creation, resolution and revival', () => {
    const state = fixture();
    const party = state.party.map((u) => ({ ...u, pendingAp: 2 }));
    const seeded = { ...state, party };
    const battle = createBattle(CONTENT, seeded, 'enc_quarry_gate', new RngCursor(state.rng));
    expect(battle.units.every((u) => u.pendingAp === 0)).toBe(true);
    const withBonuses = { ...battle, units: battle.units.map((u) => ({ ...u, pendingAp: 2 })) };
    expect(absorbBattleResults(seeded, withBonuses).every((u) => u.pendingAp === 0)).toBe(true);
    expect(reviveParty(party).every((u) => u.pendingAp === 0)).toBe(true);
  });
});
