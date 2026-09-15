import { describe, expect, it } from 'vitest';
import { CONTENT, CONTENT_BUNDLE, STORY_ENTRY } from './index';
import { levelForXp, xpForLevel } from '../core/rules/leveling';
import { xpRoster } from '../core/state/createGame';
import { evaluate } from '../core/story/conditions';
import type { FlagValue, GameState, StoryNode } from '../core/types';

/**
 * Does the party actually arrive at the level each fight is tuned for?
 *
 * Encounters declare an `expectedLevel`, enemies scale to it, and the balance
 * simulator runs the party *at* it — so if the XP economy does not actually get
 * a party there, every balance number is measuring a fight nobody will ever
 * have. The first pass did exactly that: a level-2 party walked into a boss
 * scaled for level 4, and trading Ruon away skipped a whole fight's XP on top.
 *
 * ## Why this is no longer a two-line walk
 *
 * The original version took one global integer and used it at every choice
 * node, with `node.options[pick] ?? node.options[0]` as a fallback. That was
 * fine for one two-option branch and becomes actively misleading the moment a
 * third option exists anywhere: `walkPath(2)` falls through the `??` at every
 * two-option node and silently re-walks the first path. The test keeps passing
 * and stops testing anything.
 *
 * So decisions are now keyed by *node id*, and the paths are enumerated rather
 * than guessed: walk the graph, look at the decision points the walk actually
 * reached, and fan out one alternative at a time. Each walk is arithmetic with
 * no simulation in it, so hundreds of paths cost milliseconds.
 *
 * Defeats are decisions too, capped at one per path. "If you lose fight B, do
 * you still arrive at B+1 at the right level?" is the property worth asserting,
 * and every combination of losses is not — that would be exponential and would
 * tell us nothing extra.
 */

/** A party that can take every gated option, and one that can take almost none. */
const RICH_PARTY = ['kaya', 'nilak', 'bo', 'nima', 'riko'];
const LEAN_PARTY = ['riko'];

/** Ceiling on enumerated paths, so an authoring explosion fails loudly. */
const MAX_PATHS = 256;

interface Step {
  readonly encounterId: string;
  readonly expectedLevel: number;
  readonly levelOnArrival: number;
  readonly xpOnArrival: number;
  readonly lost: boolean;
}

interface DecisionPoint {
  readonly nodeId: string;
  readonly choices: number;
}

interface Walk {
  readonly steps: readonly Step[];
  readonly finalXp: number;
  readonly flags: Readonly<Record<string, FlagValue>>;
  readonly visited: readonly string[];
  readonly decisions: ReadonlyMap<string, number>;
  /** Decision points this walk actually reached, for the enumerator to fan out. */
  readonly reached: readonly DecisionPoint[];
  /** True when the revisit guard cut the walk short — always a bug. */
  readonly truncated: boolean;
  readonly endedAt: string | null;
}

/**
 * A state stand-in for condition evaluation.
 *
 * Conditions read flags, party and `story.visited`; the walk has all three, so
 * it can ask the real `evaluate` whether an option is open rather than
 * reimplementing the rules and drifting from them.
 */
function asState(
  flags: Record<string, FlagValue>,
  party: readonly string[],
  visited: readonly string[],
): GameState {
  return {
    party: party.map((characterId) => ({
      characterId,
      element: CONTENT.characters.get(characterId)?.element ?? 'nonbender',
      hp: 1,
    })),
    flags,
    story: { visited },
  } as unknown as GameState;
}

function walkOnce(decisions: ReadonlyMap<string, number>, party: readonly string[]): Walk {
  const steps: Step[] = [];
  const flags: Record<string, FlagValue> = {};
  const visited: string[] = [];
  const reached: DecisionPoint[] = [];
  let xp = 0;
  let losses = 0;
  let nodeId: string | null = STORY_ENTRY;
  let truncated = false;
  let endedAt: string | null = null;

  // Keyed on node *and* loss count, or a defeat branch that rejoins the main
  // line gets cut short by a node the victorious route already passed through.
  const guard = new Set<string>();

  while (nodeId) {
    const key = `${nodeId}#${losses}`;
    if (guard.has(key)) {
      truncated = true;
      break;
    }
    guard.add(key);
    visited.push(nodeId);

    const node: StoryNode | undefined = CONTENT.story.get(nodeId);
    if (!node) {
      truncated = true;
      break;
    }

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
        // Only options this party could actually take are on the table.
        const open = node.options.filter((o) =>
          evaluate(asState(flags, party, visited), o.requires),
        );
        if (open.length === 0) {
          truncated = true;
          nodeId = null;
          break;
        }
        if (open.length > 1) reached.push({ nodeId: node.id, choices: open.length });

        const pick = Math.min(decisions.get(node.id) ?? 0, open.length - 1);
        const option = open[pick];
        if (!option) {
          truncated = true;
          nodeId = null;
          break;
        }
        Object.assign(flags, option.setFlags ?? {});
        nodeId = option.next;
        break;
      }

      case 'battle': {
        const encounter = CONTENT.encounters.get(node.encounterId);
        if (!encounter) {
          truncated = true;
          nodeId = null;
          break;
        }

        // Win or lose is a decision, but only one loss per path.
        const canLose = losses === 0;
        if (canLose) reached.push({ nodeId: node.id, choices: 2 });
        const lose = canLose && (decisions.get(node.id) ?? 0) === 1;

        steps.push({
          encounterId: encounter.id,
          expectedLevel: encounter.expectedLevel,
          levelOnArrival: levelForXp(xp),
          xpOnArrival: xp,
          lost: lose,
        });

        if (lose) {
          // All encounter XP is gated behind victory in the reducer, so a lost
          // fight pays nothing here — the defeat branch has to make it up.
          losses++;
          nodeId = node.onDefeat;
          break;
        }

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
        endedAt = node.id;
        nodeId = null;
        break;
    }
  }

  return { steps, finalXp: xp, flags, visited, decisions, reached, truncated, endedAt };
}

/**
 * Every distinct route through the act, for one party.
 *
 * Breadth-first over decision maps: walk what we have, then for each decision
 * point that walk *reached*, enqueue a copy of the map with that point set to
 * each other value. Terminates because every new map differs from an
 * already-walked one at exactly one reached point.
 */
function enumeratePaths(party: readonly string[]): Walk[] {
  const walks: Walk[] = [];
  const seen = new Set<string>();
  const queue: Map<string, number>[] = [new Map()];

  const keyOf = (m: ReadonlyMap<string, number>) =>
    [...m.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('|');

  while (queue.length > 0 && walks.length < MAX_PATHS) {
    const decisions = queue.shift();
    if (!decisions) break;

    const walk = walkOnce(decisions, party);

    /*
     * Deduplicate on the decisions the walk actually *used*, not on the map it
     * was handed.
     *
     * A map can carry entries for nodes this route never reaches — a pick for a
     * battle that comes after the one you lost, say — and two such maps describe
     * the same journey. Keying on the raw map treats them as different routes
     * and the enumeration explodes combinatorially (it reached 499 before this,
     * against a real path count in the dozens).
     */
    const canonical = new Map<string, number>();
    for (const point of walk.reached) {
      const value = Math.min(decisions.get(point.nodeId) ?? 0, point.choices - 1);
      if (value !== 0) canonical.set(point.nodeId, value);
    }
    const key = keyOf(canonical);
    if (seen.has(key)) continue;
    seen.add(key);

    walks.push({ ...walk, decisions: canonical });

    for (const point of walk.reached) {
      for (let alt = 0; alt < point.choices; alt++) {
        if ((canonical.get(point.nodeId) ?? 0) === alt) continue;
        const next = new Map(canonical);
        if (alt === 0) next.delete(point.nodeId);
        else next.set(point.nodeId, alt);
        if (!seen.has(keyOf(next))) queue.push(next);
      }
    }
  }

  return walks;
}

const RICH = enumeratePaths(RICH_PARTY);
const LEAN = enumeratePaths(LEAN_PARTY);
const ALL = [...RICH, ...LEAN];
const CLEAN = ALL.filter((w) => w.steps.every((s) => !s.lost));

/** Named routes, still pinned by hand: they are what fixes the act's shape. */
const escort = walkOnce(new Map(), RICH_PARTY);
const trade = walkOnce(new Map([['ruon_choice', 1]]), RICH_PARTY);

describe('progression', () => {
  it('enumerates a sane number of routes', () => {
    expect(RICH.length).toBeGreaterThan(1);
    expect(
      ALL.length,
      'path count hit the ceiling; either the graph exploded or the cap needs raising deliberately',
    ).toBeLessThan(MAX_PATHS);
  });

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

  it('brings the party to each fight at the level it is tuned for, on every route', () => {
    for (const walk of ALL) {
      for (const step of walk.steps) {
        expect(
          step.levelOnArrival,
          `route [${[...walk.decisions].map(([k, v]) => `${k}=${v}`).join(', ') || 'defaults'}] ` +
            `arrives at ${step.encounterId} on level ${step.levelOnArrival} with ${step.xpOnArrival} XP, ` +
            `tuned for level ${step.expectedLevel}`,
        ).toBe(step.expectedLevel);
      }
    }
  });

  it('keeps the party on level after a lost fight', () => {
    /*
     * The assertion that makes "defeat bends the story" safe to author. All the
     * XP for a fight is paid on victory, so every defeat branch has to make it
     * up with grantXp — and has to make up the *right* amount. Without this,
     * losing quietly costs a level and the next fight is tuned for somebody
     * else.
     */
    const withLoss = ALL.filter((w) => w.steps.some((s) => s.lost));
    expect(withLoss.length, 'no route in the act loses a fight').toBeGreaterThan(0);

    for (const walk of withLoss) {
      const lostAt = walk.steps.findIndex((s) => s.lost);
      for (const step of walk.steps.slice(lostAt + 1)) {
        expect(
          step.levelOnArrival,
          `after losing ${walk.steps[lostAt]?.encounterId}, arrives at ${step.encounterId} ` +
            `on level ${step.levelOnArrival}, tuned for ${step.expectedLevel}`,
        ).toBe(step.expectedLevel);
      }
    }
  });

  it('pays every clean route the same on arrival at any given fight', () => {
    /*
     * Generalised from "the two branches reach the boss with identical XP".
     * That was the invariant all along; with more than two routes it has to be
     * stated over all of them, or a third option is quietly the cheap one.
     */
    const byEncounter = new Map<string, Map<number, string[]>>();
    for (const walk of CLEAN) {
      const label = [...walk.decisions].map(([k, v]) => `${k}=${v}`).join(', ') || 'defaults';
      for (const step of walk.steps) {
        const bucket = byEncounter.get(step.encounterId) ?? new Map<number, string[]>();
        bucket.set(step.xpOnArrival, [...(bucket.get(step.xpOnArrival) ?? []), label]);
        byEncounter.set(step.encounterId, bucket);
      }
    }

    for (const [encounterId, buckets] of byEncounter) {
      const detail = [...buckets]
        .map(([xp, routes]) => `${xp} XP via ${routes.slice(0, 2).join(' / ')}`)
        .join('  |  ');
      expect(buckets.size, `${encounterId} is reached with different XP: ${detail}`).toBe(1);
    }
  });

  it('never truncates a route', () => {
    for (const walk of ALL) {
      const label = [...walk.decisions].map(([k, v]) => `${k}=${v}`).join(', ') || 'defaults';
      expect(walk.truncated, `route [${label}] did not reach an ending`).toBe(false);
      expect(walk.endedAt, `route [${label}] stopped without an end node`).not.toBeNull();
    }
  });

  it('reaches every story node the validator considers reachable', () => {
    /*
     * Turns "I added a branch and forgot to test it" into a failure. Anything
     * only reachable by tapping an NPC is excluded — the walk follows links,
     * and NPC conversations are entered from the explore map.
     */
    const npcRoots = new Set<string>();
    for (const map of CONTENT_BUNDLE.maps) {
      for (const npc of map.npcs) {
        npcRoots.add(npc.node);
        for (const route of npc.routes ?? []) npcRoots.add(route.node);
      }
    }

    const walked = new Set(ALL.flatMap((w) => w.visited));
    const missed = [...CONTENT.story.keys()].filter((id) => !walked.has(id) && !npcRoots.has(id));

    // NPC conversations loop straight back to the explore node, so their own
    // `next` targets are covered by the roots above.
    const trulyMissed = missed.filter((id) => {
      const node = CONTENT.story.get(id);
      if (!node) return true;
      return ![...npcRoots].some((root) => reachableFrom(root, id));
    });

    expect(trulyMissed, `unreachable from any route: ${trulyMissed.join(', ')}`).toEqual([]);
  });

  it('ends the act inside the level band the next act expects', () => {
    for (const walk of CLEAN) {
      const level = levelForXp(walk.finalXp);
      expect(level, `${walk.finalXp} XP`).toBeGreaterThanOrEqual(3);
      expect(level, `${walk.finalXp} XP`).toBeLessThanOrEqual(5);
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

/** Plain link-following reachability, for the NPC-rooted coverage check. */
function reachableFrom(start: string, target: string): boolean {
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === target) return true;
    const node = current ? CONTENT.story.get(current) : undefined;
    if (!node) continue;
    const next: string[] =
      node.kind === 'choice'
        ? node.options.map((o) => o.next)
        : node.kind === 'battle'
          ? [node.next, node.onDefeat]
          : node.kind === 'branch'
            ? [node.ifSet, node.ifUnset]
            : node.kind === 'end'
              ? []
              : [node.next];
    for (const id of next) {
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push(id);
    }
  }
  return false;
}
