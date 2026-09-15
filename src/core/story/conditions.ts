/**
 * Asking questions about the current game.
 *
 * Content needs to gate things — a dialogue option only a firebender can take, a
 * bandit squad that only turns up if you robbed them first, a barrel that is only
 * there on the hard route. `Condition` is the only vocabulary it may ask in, and
 * it is plain data, so a condition validates with zod, survives a save, and can be
 * turned back into a sentence.
 *
 * That last part is load-bearing. The dialogue UI shows every option, including
 * the ones you cannot take, because seeing what you are missing is what makes a
 * second playthrough interesting. An option greyed out with no explanation is just
 * a locked door. `describe()` is the explanation, and content can always override
 * it with a better line.
 *
 * ## Nation standing
 *
 * Standing lives in `GameState.flags` under the reserved `standing.` prefix rather
 * than in a field of its own, because flags already serialise, already migrate and
 * already accept numbers. Everything goes through the helpers below so the storage
 * can move later without touching a single piece of content.
 *
 * The sharp edge: **0 is falsy**, and every flag reader that predates this file
 * tests truthiness (`branch` nodes, `conditionalEnemies`). Point one of those at a
 * `standing.` key and neutral standing silently reads as "unset". `validateContent`
 * rejects that outright; here, numbers are only ever compared, never tested for
 * truth.
 */

import type { Condition, ContentIndex, ElementId, FlagValue, GameState } from '../types';

/** Reserved flag prefix. `validateContent` stops content from reaching past it. */
export const STANDING_PREFIX = 'standing.';

/** Bounded so a run of generous choices cannot make a nation permanently adoring. */
export const MIN_STANDING = -5;
export const MAX_STANDING = 5;

/**
 * Guards against a pathologically nested `all`/`any`/`not`. Content is validated,
 * so this should never fire — but a condition that recurses forever would hang a
 * tablet rather than fail a test.
 */
const MAX_DEPTH = 16;

export function standingKey(nation: ElementId): string {
  return `${STANDING_PREFIX}${nation}`;
}

/** How `nation` feels about the party. Neutral, and the default, is 0. */
export function getStanding(
  flags: Readonly<Record<string, FlagValue>>,
  nation: ElementId,
): number {
  const raw = flags[standingKey(nation)];
  return typeof raw === 'number' ? raw : 0;
}

/** Applies signed deltas, clamped. Returns a new flag map; never mutates. */
export function adjustStanding(
  flags: Readonly<Record<string, FlagValue>>,
  deltas: Partial<Record<ElementId, number>>,
): Record<string, FlagValue> {
  const next: Record<string, FlagValue> = { ...flags };
  for (const [nation, delta] of Object.entries(deltas)) {
    if (!delta) continue;
    const key = standingKey(nation as ElementId);
    const current = getStanding(flags, nation as ElementId);
    next[key] = Math.max(MIN_STANDING, Math.min(MAX_STANDING, current + delta));
  }
  return next;
}

/** A word for a standing value, for a toast or a tooltip. */
export function describeStanding(value: number): string {
  if (value <= -4) return 'hostile';
  if (value <= -2) return 'wary';
  if (value < 2) return 'neutral';
  if (value < 4) return 'friendly';
  return 'trusted';
}

/* ------------------------------------------------------------------ */
/* Evaluation                                                          */
/* ------------------------------------------------------------------ */

function asNumber(value: FlagValue | undefined): number | null {
  return typeof value === 'number' ? value : null;
}

function compare(op: 'gte' | 'lte', left: number, right: number): boolean {
  return op === 'gte' ? left >= right : left <= right;
}

function countParty(state: GameState, element?: ElementId, characterId?: string): number {
  let count = 0;
  for (const member of state.party) {
    if (member.hp <= 0) continue;
    if (element && member.element !== element) continue;
    if (characterId && member.characterId !== characterId) continue;
    count++;
  }
  return count;
}

function evaluateAt(state: GameState, condition: Condition, depth: number): boolean {
  if (depth > MAX_DEPTH) return false;

  switch (condition.kind) {
    case 'flag': {
      const value = state.flags[condition.key];
      switch (condition.op) {
        case 'set':
          return Boolean(value);
        case 'unset':
          return !value;
        case 'eq':
          return value === condition.value;
        case 'gte':
        case 'lte': {
          const left = asNumber(value);
          const right = asNumber(condition.value);
          if (left === null || right === null) return false;
          return compare(condition.op, left, right);
        }
      }
      return false;
    }

    case 'partyHas':
      return (
        countParty(state, condition.element, condition.characterId) >= Math.max(1, condition.min ?? 1)
      );

    case 'standing':
      return compare(condition.op, getStanding(state.flags, condition.nation), condition.value);

    case 'visited':
      return state.story.visited.includes(condition.nodeId);

    case 'partySize':
      return compare(condition.op, state.party.length, condition.value);

    case 'all':
      return condition.of.every((c) => evaluateAt(state, c, depth + 1));

    case 'any':
      return condition.of.some((c) => evaluateAt(state, c, depth + 1));

    case 'not':
      return !evaluateAt(state, condition.of, depth + 1);
  }
}

/** Is this condition true right now? An absent condition is always true. */
export function evaluate(state: GameState, condition: Condition | undefined): boolean {
  if (!condition) return true;
  return evaluateAt(state, condition, 0);
}

/* ------------------------------------------------------------------ */
/* Description                                                         */
/* ------------------------------------------------------------------ */

/**
 * Bender words, for the common case. `describe` needs these before it has any
 * chance of reading like English, and `ElementDef.name` is a proper noun ("Fire")
 * rather than a word for a person.
 */
const BENDER_WORD: Record<ElementId, string> = {
  fire: 'a firebender',
  water: 'a waterbender',
  earth: 'an earthbender',
  air: 'an airbender',
  nonbender: 'someone who does not bend',
};

const NATION_WORD: Record<ElementId, string> = {
  fire: 'the Fire Nation',
  water: 'the Water Tribes',
  earth: 'the Earth Kingdom',
  air: 'the Air Nomads',
  nonbender: 'people who do not bend',
};

/** `ruon_spared` -> `ruon spared`. A last resort; authors should set `lockedHint`. */
function humanise(key: string): string {
  return key.replace(/^standing\./, '').replace(/[._]/g, ' ');
}

function describeAt(content: ContentIndex, condition: Condition, depth: number): string {
  if (depth > MAX_DEPTH) return 'something complicated';

  switch (condition.kind) {
    case 'flag':
      switch (condition.op) {
        case 'set':
          return `you have ${humanise(condition.key)}`;
        case 'unset':
          return `you have not ${humanise(condition.key)}`;
        case 'eq':
          return `${humanise(condition.key)} is ${String(condition.value)}`;
        case 'gte':
          return `${humanise(condition.key)} is at least ${String(condition.value)}`;
        case 'lte':
          return `${humanise(condition.key)} is at most ${String(condition.value)}`;
      }
      return 'something else';

    case 'partyHas': {
      if (condition.characterId) {
        const character = content.characters.get(condition.characterId);
        return `${character?.name ?? condition.characterId} is with you`;
      }
      const min = Math.max(1, condition.min ?? 1);
      const who = condition.element ? BENDER_WORD[condition.element] : 'somebody';
      if (min === 1) return `you have ${who}`;
      // "a firebender" does not pluralise, so rebuild the phrase for counts.
      const plural = condition.element
        ? `${condition.element === 'nonbender' ? 'people who do not bend' : `${condition.element}benders`}`
        : 'party members';
      return `you have ${min} ${plural}`;
    }

    case 'standing': {
      const nation = NATION_WORD[condition.nation];
      return condition.op === 'gte'
        ? `${nation} thinks well enough of you`
        : `${nation} distrusts you enough`;
    }

    case 'visited':
      return 'you have been there before';

    case 'partySize':
      return condition.op === 'gte'
        ? `there are at least ${condition.value} of you`
        : `there are at most ${condition.value} of you`;

    case 'all':
      return condition.of.map((c) => describeAt(content, c, depth + 1)).join(' and ');

    case 'any':
      return condition.of.map((c) => describeAt(content, c, depth + 1)).join(' or ');

    case 'not':
      return `not (${describeAt(content, condition.of, depth + 1)})`;
  }
}

/**
 * Why an option is unavailable, phrased to finish the sentence "You could do this
 * if…". Content should prefer its own `lockedHint`; this is the fallback that
 * stops a locked option from being a mystery.
 */
export function describe(content: ContentIndex, condition: Condition): string {
  return describeAt(content, condition, 0);
}
