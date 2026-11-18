import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import {
  canUseAbility,
  isValidTarget,
  previewAbility,
  reviveHp,
  targetableTiles,
} from '../rules/abilities';
import { previewAiPlan } from '../rules/ai';
import { activeUnit } from '../rules/turnOrder';
import { deserialize, serialize, stateFromBlob } from '../save/serialize';
import type { GameState, Unit, Vec2 } from '../types';
import { BattleDraft } from './battleDraft';
import { createBattle, createGame } from './createGame';
import { describeEvent } from './log';
import { apply } from './reducer';

const HELP_UP = CONTENT.abilities.get('help_up');
if (!HELP_UP) throw new Error('help_up is not in the content');

const meta = { label: 'Help up', summary: '', savedAt: 0, session: { players: [] } };

function unit(state: GameState, id: string): Unit {
  const found = state.battle?.units.find((u) => u.id === id);
  if (!found) throw new Error(`Missing ${id}`);
  return found;
}

/**
 * Three heroes at the quarry gate. p1 lies downed on the tile beside p0, whose turn it
 * is, and the enemies are a long way off.
 */
function fixture(): { state: GameState; spot: Vec2 } {
  const seeded = createGame(CONTENT, {
    seed: 'help-up',
    startNode: '',
    party: [
      { characterId: 'kaya', level: 2, autoChoose: true },
      { characterId: 'sura', level: 2, autoChoose: true },
      { characterId: 'bo', level: 2, autoChoose: true },
    ],
  });
  const rng = new RngCursor(seeded.rng);
  const battle = createBattle(CONTENT, seeded, 'enc_quarry_gate', rng);
  const helper = battle.units.find((u) => u.id === 'p0');
  if (!helper) throw new Error('no p0');
  const spot = { x: helper.pos.x + 1, y: helper.pos.y };
  const units = battle.units.map((u) => {
    if (u.id === 'p1')
      return {
        ...u,
        hp: 0,
        pos: spot,
        statuses: [{ id: 'burning' as const, duration: 2, stacks: 1 }],
      };
    return u;
  });
  const state: GameState = {
    ...seeded,
    screen: 'combat',
    rng: rng.state,
    battle: { ...battle, units, turnIndex: battle.order.indexOf('p0') },
  };
  expect(activeUnit(state.battle!)?.id).toBe('p0');
  return { state, spot };
}

function help(state: GameState, target: Vec2, unitId = 'p0') {
  return apply(CONTENT, state, { type: 'useAbility', unitId, abilityId: 'help_up', target });
}

describe('Help up (ADR 0118)', () => {
  it('is a shared action every hero has, costing 2 AP, aimed at a friend who is down', () => {
    expect(HELP_UP.apCost).toBe(2);
    expect(HELP_UP.targeting).toEqual({ shape: 'unit', allow: 'downed' });
    const { state } = fixture();
    for (const id of ['p0', 'p1', 'p2']) {
      expect(canUseAbility(CONTENT, { ...unit(state, id), hp: 1 }, HELP_UP).ok).toBe(true);
    }
    // Enemies never carry it unless their own kit names it.
    const enemy = state.battle?.units.find((u) => u.faction === 'enemy');
    expect(enemy && canUseAbility(CONTENT, enemy, HELP_UP).ok).toBe(false);
  });

  it('offers the downed friend as a target, and previews the health they get back', () => {
    const { state, spot } = fixture();
    const battle = state.battle!;
    const helper = unit(state, 'p0');
    expect(targetableTiles(CONTENT, battle, helper, HELP_UP)).toContainEqual(spot);
    const preview = previewAbility(CONTENT, battle, helper, HELP_UP, spot);
    expect(preview.targets).toHaveLength(1);
    expect(preview.targets[0]).toMatchObject({
      unitId: 'p1',
      friendly: true,
      heal: reviveHp(unit(state, 'p1'), 0.25),
    });
  });

  it('stands them up with a quarter of their health, spends 2 AP and clears their statuses', () => {
    const { state, spot } = fixture();
    const before = unit(state, 'p0');
    const result = help(state, spot);
    const risen = unit(result.state, 'p1');
    expect(risen.hp).toBe(Math.max(1, Math.round(risen.base.maxHp * 0.25)));
    expect(risen.statuses).toEqual([]);
    expect(risen.ap).toBe(0);
    expect(unit(result.state, 'p0').ap).toBe(before.ap - 2);
    expect(result.state.battle?.helpedUp).toEqual(['p1']);
    const revived = result.events.find((e) => e.type === 'unitRevived');
    expect(revived).toEqual({ type: 'unitRevived', unitId: 'p1', helperId: 'p0', hp: risen.hp });
    const line = describeEvent(CONTENT, result.state.battle ?? null, revived!);
    expect(line).toMatch(/Kaya helps Sura up/);
  });

  it('is deterministic: the same board and command give the same result and spend no dice', () => {
    const { state, spot } = fixture();
    const a = help(state, spot);
    const b = help(state, spot);
    expect(a).toEqual(b);
    expect(a.state.rng).toBe(state.rng);
  });

  it('puts them back in the turn order where they were', () => {
    const { state, spot } = fixture();
    const result = help(state, spot);
    let next = result.state;
    const seen: string[] = [];
    for (let i = 0; i < 12 && next.battle?.phase === 'active'; i++) {
      const active = activeUnit(next.battle!);
      if (active) seen.push(active.id);
      next = apply(CONTENT, next, { type: 'endTurn', unitId: active?.id ?? 'p0' }).state;
    }
    expect(seen).toContain('p1');
  });

  it('lets each fighter be helped up once a fight', () => {
    const { state, spot } = fixture();
    const first = help(state, spot).state;
    // Knocked down again, in the same place, with the helper's AP topped up.
    const down: GameState = {
      ...first,
      battle: {
        ...first.battle!,
        units: first.battle!.units.map((u) =>
          u.id === 'p1' ? { ...u, hp: 0 } : u.id === 'p0' ? { ...u, ap: 4 } : u,
        ),
      },
    };
    const check = isValidTarget(CONTENT, down.battle!, unit(down, 'p0'), HELP_UP, spot);
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/already helped up/);
    const again = help(down, spot);
    expect(unit(again.state, 'p1').hp).toBe(0);
  });

  it('refuses a tile that is out of reach, occupied, or holds no one who is down', () => {
    const { state, spot } = fixture();
    const battle = state.battle!;
    const helper = unit(state, 'p0');
    const far = { x: spot.x + 4, y: spot.y };
    expect(isValidTarget(CONTENT, battle, helper, HELP_UP, far).ok).toBe(false);
    expect(isValidTarget(CONTENT, battle, helper, HELP_UP, helper.pos).reason).toMatch(/Nobody/);
    // Somebody standing on them cannot be helped up until they step off.
    const crowded: GameState = {
      ...state,
      battle: {
        ...battle,
        units: battle.units.map((u) => (u.id === 'p2' ? { ...u, pos: spot } : u)),
      },
    };
    expect(
      isValidTarget(CONTENT, crowded.battle!, unit(crowded, 'p0'), HELP_UP, spot).reason,
    ).toMatch(/standing/);
    // A fallen enemy is nobody's to help.
    const enemy = battle.units.find((u) => u.faction === 'enemy')!;
    const foe: GameState = {
      ...state,
      battle: {
        ...battle,
        units: battle.units.map((u) =>
          u.id === enemy.id ? { ...u, hp: 0, pos: { x: spot.x, y: spot.y + 1 } } : u,
        ),
      },
    };
    expect(
      isValidTarget(CONTENT, foe.battle!, unit(foe, 'p0'), HELP_UP, { x: spot.x, y: spot.y + 1 })
        .ok,
    ).toBe(false);
  });

  it('is spent only when the helper has the AP', () => {
    const { state, spot } = fixture();
    const tired: GameState = {
      ...state,
      battle: {
        ...state.battle!,
        units: state.battle!.units.map((u) => (u.id === 'p0' ? { ...u, ap: 1 } : u)),
      },
    };
    expect(canUseAbility(CONTENT, unit(tired, 'p0'), HELP_UP).ok).toBe(false);
    expect(unit(help(tired, spot).state, 'p1').hp).toBe(0);
  });

  it('survives a save and reload mid-fight, helped-up record and all', () => {
    const { state, spot } = fixture();
    const helped = help(state, spot).state;
    const loaded = deserialize(serialize(helped, meta));
    if (!loaded.ok) throw new Error(loaded.error);
    expect(stateFromBlob(loaded.blob)).toEqual(helped);
    expect(stateFromBlob(loaded.blob).battle?.helpedUp).toEqual(['p1']);
    // A fight where nobody was helped carries no key at all.
    const clean = deserialize(serialize(state, meta));
    if (!clean.ok) throw new Error(clean.error);
    expect('helpedUp' in (stateFromBlob(clean.blob).battle ?? {})).toBe(false);
  });

  it('is something the AI knows how to do for a hero it plays', () => {
    const { state, spot } = fixture();
    const battle = state.battle!;
    // Enemies sent far away so nothing out-scores a rescue, and p0 plays itself.
    const calm: GameState = {
      ...state,
      battle: {
        ...battle,
        units: battle.units.map((u) =>
          u.id === 'p0'
            ? { ...u, ai: 'aggressive' as const }
            : u.faction === 'enemy'
              ? { ...u, pos: { x: 19, y: u.pos.y } }
              : u,
        ),
      },
    };
    const draft = new BattleDraft(CONTENT, calm.battle!, new RngCursor(calm.rng));
    const plan = previewAiPlan(draft, 'p0');
    expect(plan?.ability.id).toBe('help_up');
    expect(plan?.target).toEqual(spot);
    // And the plan, played, stands the hero up.
    const played = apply(CONTENT, calm, { type: 'runAiTurn' });
    expect(unit(played.state, 'p1').hp).toBeGreaterThan(0);
  });
});
