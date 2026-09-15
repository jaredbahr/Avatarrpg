/**
 * Headless combat.
 *
 * Runs a whole encounter with the AI driving both sides and reports what
 * happened. Two jobs:
 *
 *  1. **Correctness.** A fight that never terminates, produces NaN HP, or
 *     diverges between two runs of the same seed is a bug that would otherwise
 *     only show up on a Saturday with four kids watching.
 *  2. **Balance.** Win rate per encounter at the level the slice expects, so
 *     tuning is a number rather than a feeling.
 *
 * The party is driven by the same AI as the enemies. That flatters neither
 * side: a real party plays better than this, which is why the target band is
 * 70-85% rather than 50%.
 */

import { RngCursor, seedFromString } from '../rng';
import type { ContentIndex, GameEvent, GameState, Unit } from '../types';
import { apply } from '../state/reducer';
import type { PartySlot } from '../state/createGame';
import { createBattle, createGame } from '../state/createGame';

export type SimOutcome = 'victory' | 'defeat' | 'stalemate';

export interface SimOptions {
  readonly seed: number | string;
  readonly encounterId: string;
  readonly party: readonly PartySlot[];
  /** Level every party member starts at. Defaults to the encounter's tuning. */
  readonly partyLevel?: number;
  /** A fight longer than this is a bug, not a close match. */
  readonly maxRounds?: number;
  /** Retained for the determinism test; off by default to keep memory flat. */
  readonly recordEvents?: boolean;
  /**
   * Force one roster variant instead of letting the seed draw.
   *
   * Not optional for the balance report. Once an encounter has variants, an
   * unpinned run samples whichever one the seed happened to draw and the win
   * rates stop being comparable between runs — which is precisely when a
   * variant that is budget-legal but win-rate-illegal would slip through.
   */
  readonly variantId?: string;
}

export interface SimResult {
  readonly outcome: SimOutcome;
  /** Which roster actually spawned, so a surprising result is diagnosable. */
  readonly variantId: string | null;
  readonly rounds: number;
  readonly turns: number;
  readonly partyDeaths: number;
  readonly enemyDeaths: number;
  readonly partyHpRemaining: number;
  readonly partyHpTotal: number;
  readonly events: readonly GameEvent[];
  /** A compact fingerprint of the run, for the determinism assertion. */
  readonly signature: string;
  readonly anomalies: readonly string[];
}

export const DEFAULT_MAX_ROUNDS = 60;

/** The AI has no party profile, so the sim lends the party one. */
function drivePartyWithAi(state: GameState): GameState {
  if (!state.battle) return state;
  const units: Unit[] = state.battle.units.map((unit) =>
    unit.faction === 'party' ? { ...unit, ai: pickProfile(unit) } : unit,
  );
  return { ...state, battle: { ...state.battle, units } };
}

/**
 * Element-appropriate autopilot, so the simulated party at least plays to
 * type: waterbenders support, earthbenders hold, everyone else advances.
 */
function pickProfile(unit: Unit): Unit['ai'] {
  switch (unit.element) {
    case 'water':
      return 'support';
    case 'earth':
      return 'cautious';
    case 'air':
      return 'cautious';
    default:
      return 'aggressive';
  }
}

export function runCombat(content: ContentIndex, options: SimOptions): SimResult {
  const encounter = content.encounters.get(options.encounterId);
  if (!encounter) throw new Error(`Unknown encounter "${options.encounterId}"`);

  const level = options.partyLevel ?? encounter.expectedLevel;
  const maxRounds = options.maxRounds ?? DEFAULT_MAX_ROUNDS;

  const seeded = createGame(content, {
    seed: options.seed,
    party: options.party.map((slot) => ({ ...slot, level, autoChoose: true })),
    startNode: '',
  });

  const rng = new RngCursor(seeded.rng);
  const battle = createBattle(content, seeded, options.encounterId, rng, {
    variantId: options.variantId,
  });

  let state: GameState = drivePartyWithAi({
    ...seeded,
    screen: 'combat',
    rng: rng.state,
    battle,
  });

  const events: GameEvent[] = [];
  const anomalies: string[] = [];
  let turns = 0;

  while (state.battle && state.battle.phase === 'active') {
    if (state.battle.round > maxRounds) break;

    const turnBudget = state.battle.order.length * (maxRounds + 4);
    const step = apply(content, state, { type: 'runAiTurn' });
    state = step.state;
    turns++;
    if (options.recordEvents) events.push(...step.events);

    // A turn that advances nothing would spin forever; catch it here rather
    // than relying on the round cap to eventually notice.
    if (turns > turnBudget) {
      anomalies.push(`encounter ${options.encounterId}: exceeded the turn budget`);
      break;
    }
  }

  const final = state.battle;
  if (!final) throw new Error('Simulation lost its battle state');

  const outcome: SimOutcome =
    final.phase === 'victory' ? 'victory' : final.phase === 'defeat' ? 'defeat' : 'stalemate';

  const party = final.units.filter((u) => u.faction === 'party');
  const enemies = final.units.filter((u) => u.faction === 'enemy');

  for (const unit of final.units) {
    if (!Number.isFinite(unit.hp)) anomalies.push(`${unit.name} has non-finite HP`);
    if (unit.hp < 0) anomalies.push(`${unit.name} has negative HP (${unit.hp})`);
    if (unit.hp > unit.base.maxHp) {
      anomalies.push(`${unit.name} has ${unit.hp} HP above a max of ${unit.base.maxHp}`);
    }
    if (!Number.isFinite(unit.ap) || unit.ap < 0) anomalies.push(`${unit.name} has bad AP`);
  }
  if (outcome === 'stalemate') {
    anomalies.push(`encounter ${options.encounterId} did not finish within ${maxRounds} rounds`);
  }

  return {
    outcome,
    variantId: final.variantId,
    rounds: final.round,
    turns,
    partyDeaths: party.filter((u) => u.hp <= 0).length,
    enemyDeaths: enemies.filter((u) => u.hp <= 0).length,
    partyHpRemaining: party.reduce((sum, u) => sum + Math.max(0, u.hp), 0),
    partyHpTotal: party.reduce((sum, u) => sum + u.base.maxHp, 0),
    events,
    signature: signatureOf(final.units, final.round, outcome),
    anomalies,
  };
}

/** Order-independent fingerprint: same seed must give the same string. */
function signatureOf(units: readonly Unit[], round: number, outcome: string): string {
  const parts = [...units]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((u) => `${u.id}:${u.hp}@${u.pos.x},${u.pos.y}`);
  return `${outcome}|r${round}|${parts.join('|')}`;
}

/** A balanced six-player party, used as the default sim roster. */
export const STANDARD_PARTY: readonly PartySlot[] = [
  { characterId: 'kaya' },
  { characterId: 'nilak' },
  { characterId: 'bo' },
  { characterId: 'nima' },
  { characterId: 'riko' },
  { characterId: 'sura' },
];

/** The smallest party the game supports, for the hardest balance case. */
export const SOLO_PARTY: readonly PartySlot[] = [{ characterId: 'bo' }];

export function seedFor(label: string, trial: number): number {
  return seedFromString(`${label}#${trial}`);
}
