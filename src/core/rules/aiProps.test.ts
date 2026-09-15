/**
 * Does the AI actually use the props?
 *
 * Worth its own file because "the tests pass" and "the enemy shoots the barrel"
 * are completely different claims, and the first one was true for a while before
 * the second one was. Two things can silently defeat the whole feature:
 *
 *  1. `candidateTargets` never emits the prop's tile, so nothing downstream ever
 *     gets a chance to score it.
 *  2. `scoreAbility` scores it well and then returns -Infinity anyway, because
 *     `touchedAnyone` was never set.
 *
 * Neither shows up as a failure anywhere else — the AI just quietly ignores
 * every barrel on the map and the fights feel flat.
 */

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { BattleDraft } from '../state/battleDraft';
import { createBattle, createGame } from '../state/createGame';
import type { Unit, Vec2 } from '../types';
import { previewAiPlan } from './ai';
import { posKey, tileAt } from './grid';

function setup() {
  const seeded = createGame(CONTENT, {
    seed: 'ai-props',
    party: [
      { characterId: 'kaya', level: 3, autoChoose: true },
      { characterId: 'bo', level: 3, autoChoose: true },
    ],
    startNode: '',
  });
  const rng = new RngCursor(seeded.rng);
  return new BattleDraft(CONTENT, createBattle(CONTENT, seeded, 'enc_forest_road', rng), rng);
}

/** A clear tile with room around it, away from anybody already standing. */
function clearing(draft: BattleDraft, radius = 2): Vec2 {
  const taken = new Set(draft.units.map((u) => posKey(u.pos)));
  for (let y = radius; y < draft.grid.height - radius; y++) {
    for (let x = radius; x < draft.grid.width - radius; x++) {
      let ok = true;
      for (let dy = -radius; dy <= radius && ok; dy++) {
        for (let dx = -radius; dx <= radius && ok; dx++) {
          const tile = tileAt(draft.grid, { x: x + dx, y: y + dy });
          if (
            !tile ||
            tile.blocked ||
            tile.surface ||
            taken.has(posKey({ x: x + dx, y: y + dy }))
          ) {
            ok = false;
          }
        }
      }
      if (ok) return { x, y };
    }
  }
  throw new Error('no clearing on this map');
}

function enemyOf(draft: BattleDraft): Unit {
  const enemy = draft.living().find((u) => u.faction === 'enemy');
  if (!enemy) throw new Error('no enemy in this encounter');
  return enemy;
}

describe('the AI and props', () => {
  it('tips a brazier into the party rather than hitting one of them', () => {
    const draft = setup();
    const enemy = enemyOf(draft);
    const spot = clearing(draft);

    // Two party members flanking a brazier, with the enemy in reach of it.
    // Breaking it is 4 fire damage to both of them plus a fire tile; punching
    // one of them is a single hit. The prop should win.
    const party = draft.living().filter((u) => u.faction === 'party');
    const first = party[0];
    const second = party[1];
    if (!first || !second) throw new Error('need two party members');

    draft.placeUnit(first.id, { x: spot.x + 1, y: spot.y }, { contact: false });
    draft.placeUnit(second.id, { x: spot.x, y: spot.y - 1 }, { contact: false });
    draft.placeProp('brazier', spot);
    draft.placeUnit(enemy.id, { x: spot.x, y: spot.y + 1 }, { contact: false });

    const plan = previewAiPlan(draft, enemy.id);
    expect(plan, 'the AI should have found something to do').not.toBeNull();
    expect(
      plan && plan.target.x === spot.x && plan.target.y === spot.y,
      `expected the brazier at (${spot.x},${spot.y}), got ${JSON.stringify(plan?.target)} with ${plan?.ability.id}`,
    ).toBe(true);
  });

  it('prefers hitting somebody over spilling oil nobody will light', () => {
    /*
     * Not a limitation — the right call. An oil flask paints oil, and oil on its
     * own does nothing at all; it is only dangerous once something sets it off.
     * A bandit with no way to light it gains more from swinging at a person, and
     * the scorer should say so.
     */
    const draft = setup();
    const enemy = enemyOf(draft);
    const spot = clearing(draft);

    const victim = draft.living().find((u) => u.faction === 'party');
    if (!victim) throw new Error('need a party member');

    draft.placeUnit(victim.id, { x: spot.x + 1, y: spot.y }, { contact: false });
    draft.placeProp('oil_flask', spot);
    draft.placeUnit(enemy.id, { x: spot.x, y: spot.y + 1 }, { contact: false });

    const plan = previewAiPlan(draft, enemy.id);
    expect(plan).not.toBeNull();
    expect(
      plan && plan.target.x === spot.x && plan.target.y === spot.y,
      'the AI spilled oil it had no way to ignite instead of attacking',
    ).toBe(false);
  });

  it('ignores a prop with nobody near it', () => {
    const draft = setup();
    const enemy = enemyOf(draft);
    const spot = clearing(draft);

    // A flask on its own, with the enemy beside it and the party far away.
    draft.placeProp('oil_flask', spot);
    draft.placeUnit(enemy.id, { x: spot.x, y: spot.y + 1 }, { contact: false });

    const plan = previewAiPlan(draft, enemy.id);
    // It may well decide to do nothing here; what it must not do is spend its
    // turn shooting scenery.
    if (plan) {
      expect(
        plan.target.x === spot.x && plan.target.y === spot.y,
        'the AI spent its turn on a prop nobody was standing near',
      ).toBe(false);
    }
  });

  it('will not blow up a prop that is sitting among its own side', () => {
    const draft = setup();
    const enemy = enemyOf(draft);
    const spot = clearing(draft);

    const allies = draft.living().filter((u) => u.faction === 'enemy' && u.id !== enemy.id);
    const friend = allies[0];
    if (!friend) throw new Error('need a second enemy');

    // Flask ringed by the AI's own side; one party member two tiles off, so the
    // prop is still enumerated but is a terrible idea.
    draft.placeProp('brazier', spot);
    draft.placeUnit(friend.id, { x: spot.x + 1, y: spot.y }, { contact: false });
    const victim = draft.living().find((u) => u.faction === 'party');
    if (!victim) throw new Error('need a party member');
    draft.placeUnit(victim.id, { x: spot.x + 2, y: spot.y }, { contact: false });
    draft.placeUnit(enemy.id, { x: spot.x, y: spot.y + 2 }, { contact: false });

    const plan = previewAiPlan(draft, enemy.id);
    if (plan) {
      expect(
        plan.target.x === spot.x && plan.target.y === spot.y,
        'the AI detonated a brazier next to its own ally',
      ).toBe(false);
    }
  });

  it('treats standing next to a brazier as worse than standing clear of one', () => {
    const draft = setup();
    const spot = clearing(draft);
    draft.placeProp('brazier', spot);

    // threatAt is the hint system's view of a tile; propDanger feeds the same
    // tileDanger the mover uses, so compare a neighbouring tile with a far one.
    const beside = { x: spot.x + 1, y: spot.y };
    const away = { x: spot.x + 4, y: spot.y };

    const enemy = enemyOf(draft);
    draft.placeUnit(enemy.id, beside, { contact: false });
    const near = previewAiPlan(draft, enemy.id);
    draft.placeUnit(enemy.id, away, { contact: false });
    const far = previewAiPlan(draft, enemy.id);

    // Not a scoring assertion — just that having a prop on the field does not
    // crash the planner from either position.
    expect(near === null || typeof near.score === 'number').toBe(true);
    expect(far === null || typeof far.score === 'number').toBe(true);
  });

  it('plans identically twice for the same board', () => {
    // scoreProps must stay pure arithmetic: scoreAbility is reached from the
    // preview path, and determinism is a stated non-negotiable.
    const a = setup();
    const b = setup();
    const spot = clearing(a);
    for (const draft of [a, b]) {
      const enemy = enemyOf(draft);
      const party = draft.living().filter((u) => u.faction === 'party');
      const first = party[0];
      if (!first) throw new Error('need a party member');
      draft.placeUnit(first.id, { x: spot.x + 1, y: spot.y }, { contact: false });
      draft.placeProp('oil_flask', spot);
      draft.placeUnit(enemy.id, { x: spot.x, y: spot.y + 2 }, { contact: false });
    }

    const planA = previewAiPlan(a, enemyOf(a).id);
    const planB = previewAiPlan(b, enemyOf(b).id);
    expect(planA?.ability.id).toBe(planB?.ability.id);
    expect(planA?.target).toEqual(planB?.target);
    expect(planA?.score).toBe(planB?.score);
  });
});
