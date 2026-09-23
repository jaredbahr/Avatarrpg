/**
 * Resident resolution (ADR 0047 §2): where every resident, and every
 * background role, is right now. Pure and total; placements are never saved,
 * only derived from the clock, flags, `visited` and the conversation pin.
 *
 * Each resident takes its first candidate by rank:
 *   0 the conversation pin (while `screen === 'dialogue'`),
 *   1-5 overrides by tier (`RESIDENT_TIERS`: mission, hazard, presence, care,
 *     appointment), declaration order within a tier,
 *   6 the ordinary `schedule[phase]`.
 * Candidates claim their tile and `reserve` key in global rank order (rank,
 * then resident declaration order), so a pinned speaker always keeps its
 * tile. A resident whose candidate is taken falls back along a chain — its
 * `fallback` slot, then `home`, then `absent` — and every fall back leaves a
 * diagnostic. Fallbacks claim only after every first candidate has, so a
 * displaced resident can never displace someone else in turn. Background
 * roles resolve last, never displace anyone, and are simply omitted when
 * their tile is taken.
 */

import { RESIDENT_TIERS } from '../types';
import type {
  ContentIndex,
  GameState,
  ResidentDef,
  ResidentSlot,
  ResidentSlotValue,
  Vec2,
} from '../types';
import { evaluate } from './conditions';

/** Where a placement came from. 1-5 are the override tiers; see the module doc. */
export const RANK_CONVERSATION = 0;
export const RANK_SCHEDULE = 6;
export const RANK_FALLBACK = 7;
/** Displaced past the fallback slot to its home, or to nowhere. */
export const RANK_DISPLACED = 8;
export const RANK_ROLE = 9;

export interface Placement {
  /** Resident or background-role id. */
  readonly id: string;
  readonly rank: number;
  /** Null when absent. */
  readonly anchor: string | null;
  /** Null at home or absent. */
  readonly slot: ResidentSlot | null;
  /** The slot's activity after its first matching variant; null with no slot. */
  readonly activity: string | null;
  /** Set when the anchor is a map tile. */
  readonly mapId?: string;
  readonly pos?: Vec2;
}

/**
 * A resident that lost its first candidate. `rank` is the candidate that lost
 * (0 or 1, a conversation or a mission, is a hard error in validation);
 * `anchor` is the one it wanted; `to` is where it ended up.
 */
export interface ResidentDiagnostic {
  readonly id: string;
  readonly rank: number;
  readonly anchor: string;
  readonly to: string | null;
}

export interface Resolution {
  /** One per resident in declaration order, then each placed background role. */
  readonly placements: readonly Placement[];
  readonly diagnostics: readonly ResidentDiagnostic[];
}

/** A conversation or mission placement losing its tile: never acceptable in shipped content. */
export function isHardDiagnostic(diagnostic: ResidentDiagnostic): boolean {
  return diagnostic.rank <= 1;
}

interface Candidate {
  readonly resident: ResidentDef;
  readonly rank: number;
  readonly value: ResidentSlotValue;
}

type Spot = Omit<Placement, 'id' | 'rank'>;

const ABSENT: Spot = { anchor: null, slot: null, activity: null };

let memo: readonly [ContentIndex, GameState, Resolution] | undefined;

/**
 * Resolves every resident and background role for `state`. Memoised on the
 * (immutable) state in a one-entry cache: the renderer asks every frame.
 */
export function resolveResidents(content: ContentIndex, state: GameState): Resolution {
  if (memo && memo[0] === content && memo[1] === state) return memo[2];
  const result = resolve(content, state);
  memo = [content, state, result];
  return result;
}

/** The resident an NpcDef on `mapId` is bound to, if any. */
export function npcResident(content: ContentIndex, mapId: string, npcId: string): string | null {
  return content.maps.get(mapId)?.npcs.find((n) => n.id === npcId)?.resident ?? null;
}

function resolve(content: ContentIndex, state: GameState): Resolution {
  const { phase } = state.world.clock;
  const talk = state.screen === 'dialogue' ? state.world.talk : null;
  const pinned = talk ? npcResident(content, talk.mapId, talk.npcId) : null;
  const claimed = new Set<string>();

  /** Claims a slot's (or home's) tile and reserve key; null when taken or the anchor is unknown. */
  const claim = (slot: ResidentSlot | null, home?: string): Spot | null => {
    const anchorId = slot ? slot.anchor : (home ?? '');
    const site = content.anchors.get(anchorId)?.site;
    if (!site) return null;
    const activity = slot
      ? (slot.variants?.find((v) => evaluate(state, v.when))?.activity ?? slot.activity)
      : null;
    const spot: Spot = { anchor: anchorId, slot, activity };
    if (site.kind === 'private') return spot;
    const tile = `${site.mapId}:${site.pos.x},${site.pos.y}`;
    // With no shared reserve key, the tile is its own.
    const reserve = `@${site.reserve ?? tile}`;
    if (claimed.has(tile) || claimed.has(reserve)) return null;
    claimed.add(tile).add(reserve);
    return { ...spot, mapId: site.mapId, pos: site.pos };
  };
  const take = (value: ResidentSlotValue, resident: ResidentDef): Spot | null =>
    value === 'absent' ? ABSENT : claim(value === 'home' ? null : value, resident.home);

  const residents = [...content.residents.values()];
  // Array sort is stable, so equal ranks keep declaration order.
  const ranked = residents
    .map((resident) => firstCandidate(resident, state, pinned, talk))
    .sort((a, b) => a.rank - b.rank);

  const placed = new Map<string, Placement>();
  const displaced: Candidate[] = [];
  for (const { resident, rank, value } of ranked) {
    const spot = take(value, resident);
    if (spot) placed.set(resident.id, { ...spot, id: resident.id, rank });
    else displaced.push({ resident, rank, value });
  }

  const diagnostics: ResidentDiagnostic[] = [];
  for (const { resident, rank, value } of displaced) {
    const fallback = claim(resident.fallback);
    const spot = fallback ?? take('home', resident) ?? ABSENT;
    placed.set(resident.id, {
      ...spot,
      id: resident.id,
      rank: fallback ? RANK_FALLBACK : RANK_DISPLACED,
    });
    diagnostics.push({
      id: resident.id,
      rank,
      anchor: typeof value === 'object' ? value.anchor : resident.home,
      to: spot.anchor,
    });
  }

  const placements = residents.map((resident) => placed.get(resident.id) as Placement);
  for (const role of content.backgroundRoles.values()) {
    let slot = role.slots[phase];
    const company = role.accompanies;
    if (!slot && company) {
      const anchor = placed.get(company.resident)?.anchor;
      if (anchor && company.anchors.includes(anchor)) slot = company.slot;
    }
    const spot = slot && claim(slot);
    if (spot) placements.push({ ...spot, id: role.id, rank: RANK_ROLE });
  }

  return { placements, diagnostics };
}

function firstCandidate(
  resident: ResidentDef,
  state: GameState,
  pinned: string | null,
  talk: GameState['world']['talk'],
): Candidate {
  const phase = state.world.clock.phase;
  let best: Candidate = { resident, rank: RANK_SCHEDULE, value: resident.schedule[phase] };
  const values: ResidentSlotValue[] = [best.value, resident.fallback];
  for (const override of resident.overrides ?? []) {
    const value = override.slots[phase] ?? override.all;
    if (!value) continue;
    values.push(value);
    const rank = RESIDENT_TIERS.indexOf(override.tier) + 1;
    if (rank < best.rank && evaluate(state, override.when)) best = { resident, rank, value };
  }
  if (!talk || pinned !== resident.id) return best;
  // The pin holds the speaker where the conversation opened. The phase can't
  // change mid-conversation (§4), so the slot that stood there is one of this
  // phase's: keep it, and any service it carries, even if the hold that
  // placed it has since lifted. Build a bare one if content has none.
  const own = values.find(
    (v): v is ResidentSlot =>
      typeof v === 'object' && v.anchor === talk.anchor && v.npc === talk.npcId,
  );
  const slot: ResidentSlot = own
    ? { ...own, interrupt: 'talk' }
    : { anchor: talk.anchor, activity: 'talk', npc: talk.npcId, interrupt: 'talk' };
  return { resident, rank: RANK_CONVERSATION, value: slot };
}
