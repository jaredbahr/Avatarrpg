import { describe, expect, it } from 'vitest';
import { CONTENT, CONTENT_BUNDLE } from './index';
import { levelForXp, xpForLevel } from '../core/rules/leveling';
import { xpRoster } from '../core/state/createGame';
import type { FlagValue, StoryNode } from '../core/types';

/**
 * Does the party actually arrive at the level each fight is tuned for?
 *
 * Encounters declare an `expectedLevel`, enemies scale to it, and the balance
 * simulator runs the party *at* it — so if the XP economy does not actually
 * get a party there, every balance number is measuring a fight nobody will
 * ever have. The first pass did exactly that: a level-2 party walked into a
 * boss scaled for level 4, and trading Ruon away skipped a whole fight's XP
 * on top.
 *
 * This walks the real story graph rather than a hand-written list, so adding a
 * fight or moving a branch is covered automatically.
 */

interface Step {
  readonly encounterId: string;
  readonly expectedLevel: number;
  readonly levelOnArrival: number;
  readonly xpOnArrival: number;
}

interface Walk {
  readonly steps: readonly Step[];
  readonly finalXp: number;
}

/**
 * Follows the story from the entry node to the end, taking `choicePick` at
 * each branch, and totals the XP a baseline-sized party would have earned.
 */
function walkPath(choicePick: number): Walk {
  const steps: Step[] = [];
  const flags: Record<string, FlagValue> = {};
  let xp = 0;
  let nodeId: string | null = 'act1_open';
  const guard = new Set<string>();

  while (nodeId) {
    if (guard.has(nodeId)) break;
    guard.add(nodeId);

    const node: StoryNode | undefined = CONTENT.story.get(nodeId);
    if (!node) break;

    switch (node.kind) {
      case 'dialogue':
      case 'explore':
        nodeId = node.next;
        break;

      case 'flags': {
        Object.assign(flags, node.set);
        if (node.grantXp) xp += node.grantXp;
        nodeId = node.next;
        break;
      }

      case 'branch':
        nodeId = flags[node.flag] ? node.ifSet : node.ifUnset;
        break;

      case 'choice': {
        const option = node.options[choicePick] ?? node.options[0];
        if (!option) return { steps, finalXp: xp };
        Object.assign(flags, option.setFlags ?? {});
        nodeId = option.next;
        break;
      }

      case 'battle': {
        const encounter = CONTENT.encounters.get(node.encounterId);
        if (!encounter) return { steps, finalXp: xp };

        steps.push({
          encounterId: encounter.id,
          expectedLevel: encounter.expectedLevel,
          levelOnArrival: levelForXp(xp),
          xpOnArrival: xp,
        });

        const roster = xpRoster(encounter, flags);
        const total = roster.reduce(
          (sum, placement) => sum + (CONTENT.enemies.get(placement.enemyId)?.xp ?? 0),
          0,
        );
        xp += Math.max(1, Math.round(total / encounter.baselinePartySize));
        nodeId = node.next;
        break;
      }

      case 'end':
        return { steps, finalXp: xp };
    }
  }

  return { steps, finalXp: xp };
}

describe('progression', () => {
  const escort = walkPath(0);
  const trade = walkPath(1);

  it('visits every Act 1 fight on the escort path', () => {
    expect(escort.steps.map((s) => s.encounterId)).toEqual([
      'enc_forest_road',
      'enc_quarry_gate',
      'enc_ambush',
      'enc_grumbler',
    ]);
  });

  it('skips the ambush when Ruon is traded away', () => {
    expect(trade.steps.map((s) => s.encounterId)).toEqual([
      'enc_forest_road',
      'enc_quarry_gate',
      'enc_grumbler',
    ]);
  });

  it.each([
    ['escort', escort],
    ['trade', trade],
  ])('brings the party to each fight at the level it is tuned for (%s)', (_label, walk) => {
    for (const step of walk.steps) {
      expect(
        step.levelOnArrival,
        `${step.encounterId}: arrives at level ${step.levelOnArrival} with ${step.xpOnArrival} XP, tuned for level ${step.expectedLevel}`,
      ).toBe(step.expectedLevel);
    }
  });

  it('leaves neither branch behind the other at the boss', () => {
    const bossXp = (walk: Walk) =>
      walk.steps.find((s) => s.encounterId === 'enc_grumbler')?.xpOnArrival ?? 0;

    const escortXp = bossXp(escort);
    const tradeXp = bossXp(trade);

    // Jin pays for Ruon, and the payment is worth the fight it replaces.
    expect(Math.abs(escortXp - tradeXp), `escort ${escortXp} XP vs trade ${tradeXp} XP`).toBe(0);
  });

  it('ends the act inside the level band the next act expects', () => {
    for (const walk of [escort, trade]) {
      const level = levelForXp(walk.finalXp);
      expect(level).toBeGreaterThanOrEqual(3);
      expect(level).toBeLessThanOrEqual(5);
    }
  });

  it('keeps every enemy XP value positive except the story ally', () => {
    for (const enemy of CONTENT_BUNDLE.enemies) {
      if (enemy.id === 'ruon_ally') {
        expect(enemy.xp).toBe(0);
        continue;
      }
      expect(enemy.xp, enemy.id).toBeGreaterThan(0);
    }
  });

  it('never asks for a level the curve cannot reach in Act 1', () => {
    for (const encounter of CONTENT_BUNDLE.encounters) {
      expect(xpForLevel(encounter.expectedLevel)).toBeLessThanOrEqual(escort.finalXp);
    }
  });
});
