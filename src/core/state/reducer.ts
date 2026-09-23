/**
 * The reducer: `apply(content, state, command) -> { state, events }`.
 *
 * This is the only door into the rules. The UI never edits state; it sends a
 * command and plays back the events it gets. That is what makes the simulator,
 * the save format, and deterministic replay all fall out for free.
 *
 * Nothing here mutates the state it is given. Inside a step it works on a
 * `BattleDraft`, which is a copy.
 */

import { RngCursor } from '../rng';
import { evaluate } from '../story/conditions';
import { advancePhase } from '../story/clock';
import { findSettleTile, settle } from '../story/settle';
import { activeTriggers, triggerKey, visibleNpcs } from '../story/world';
import type {
  BattleState,
  Command,
  ContentIndex,
  DayPhase,
  GameEvent,
  GameState,
  Grid,
  MapDef,
  NpcDef,
  PendingChoice,
  StepResult,
  Unit,
  Vec2,
} from '../types';
import { BattleDraft } from './battleDraft';
import { appendLog } from './log';
import { absorbBattleResults, restAfterVictory, reviveParty, xpRoster } from './createGame';
import { canUseAbility, isValidTarget, resolveAbility } from '../rules/abilities';
import { buildGrid, distance, findPath, pathCost, posKey, samePos, tileAt } from '../rules/grid';
import { adoptDiscipline, awardXp, disciplineUnlocked } from '../rules/leveling';
import { advanceTurn, battleOutcome, endedOnTimeLimit } from '../rules/turnOrder';
import { canMove, isAlive } from '../rules/stats';
import { planAiTurn } from '../rules/ai';
import {
  advanceDialogue,
  chooseOption,
  currentNode,
  enterStoryNode,
  exploreNodeFor,
  npcNode,
} from '../story/storyEngine';

/** Convenience: state unchanged, one explanatory message. */
function refuse(state: GameState, text: string): StepResult {
  return { state, events: [{ type: 'message', text }] };
}

/**
 * Formats `result`'s events into the log the same way `handleWait` does,
 * appending onto `base.log`. For explore/dialogue commands only — a
 * battle-turn command's events log through `finish` or
 * `handleResolveBattle` instead, which pass the mid-battle (or
 * just-concluded) roster `describeEvent` needs to resolve unit names; battle
 * is always null on every path that calls this.
 */
function withLog(content: ContentIndex, base: GameState, result: StepResult): StepResult {
  return {
    state: { ...result.state, log: appendLog(content, null, base.log, result.events) },
    events: result.events,
  };
}

function finish(
  content: ContentIndex,
  state: GameState,
  battle: BattleState | null,
  rng: RngCursor,
  events: readonly GameEvent[],
): StepResult {
  return {
    state: {
      ...state,
      rng: rng.state,
      battle,
      log: appendLog(content, battle, state.log, events),
    },
    events,
  };
}

/**
 * Moves the turn pointer on, runs round upkeep when it wraps, and starts the
 * next unit's turn — skipping anyone who is Frozen or Stunned, which can chain
 * through several units in a row.
 */
function advanceToNextTurn(draft: BattleDraft): void {
  for (let guard = 0; guard <= draft.order.length + 1; guard++) {
    const advance = advanceTurn(draft.toBattle());
    draft.turnIndex = advance.turnIndex;

    if (advance.roundAdvanced) {
      draft.round = advance.round;
      draft.expireWalls();
      draft.tickTerrain();
      draft.emit({ type: 'roundStarted', round: draft.round });
    }

    if (!advance.unitId) return;
    if (battleOutcome(draft.toBattle()) !== 'active') return;

    const skipped = draft.beginTurn(advance.unitId);
    const unit = draft.unit(advance.unitId);

    // Upkeep can kill (Burning, standing in fire) — move straight on if so.
    if (!unit || !isAlive(unit)) continue;

    if (skipped) {
      draft.message(`${unit.name} cannot act this turn.`);
      draft.emit({ type: 'turnEnded', unitId: unit.id });
      continue;
    }

    draft.emit({ type: 'turnStarted', unitId: advance.unitId, round: draft.round });
    return;
  }
}

/** Seals the battle if one side has fallen. Idempotent. */
function settleOutcome(draft: BattleDraft): void {
  if (draft.phase !== 'active') return;
  const battle = draft.toBattle();
  const outcome = battleOutcome(battle);
  if (outcome === 'active') return;
  if (endedOnTimeLimit(battle)) {
    draft.message('The fight has gone on too long — the party pulls back to regroup.');
  }
  draft.phase = outcome;
  draft.emit({ type: 'battleEnded', outcome });
}

/* ------------------------------------------------------------------ */
/* Command handlers                                                    */
/* ------------------------------------------------------------------ */

function handleMove(
  content: ContentIndex,
  state: GameState,
  unitId: string,
  path: readonly Vec2[],
): StepResult {
  const battle = state.battle;
  if (!battle) return refuse(state, 'No battle in progress.');
  if (battle.phase !== 'active') return refuse(state, 'The fight is over.');
  if (battle.order[battle.turnIndex] !== unitId) return refuse(state, 'Not that unit’s turn.');

  const unit = battle.units.find((u) => u.id === unitId);
  if (!unit || !isAlive(unit)) return refuse(state, 'That unit cannot move.');
  if (!canMove(content, unit)) return refuse(state, `${unit.name} cannot move right now.`);
  if (path.length === 0) return refuse(state, 'Nowhere to go.');

  const rng = new RngCursor(state.rng);
  const draft = new BattleDraft(content, battle, rng);

  const cost = pathCost(draft.moveContext(unit), unit.pos, path);
  if (cost === null) return refuse(state, 'That path is blocked.');
  if (cost > unit.move) return refuse(state, `Needs ${cost} move, has ${unit.move}.`);

  // Walk it a tile at a time so fire, water and mud all get their say.
  const walked: Vec2[] = [];
  for (const step of path) {
    const current = draft.unit(unitId);
    if (!current || !isAlive(current)) break;
    draft.placeUnit(unitId, step);
    walked.push(step);
  }

  const moved = draft.unit(unitId);
  if (moved) draft.replace({ ...moved, move: Math.max(0, moved.move - cost) });
  draft.emit({ type: 'unitMoved', unitId, path: walked, cost });

  settleOutcome(draft);
  return finish(content, state, draft.toBattle(), rng, draft.events);
}

function handleUseAbility(
  content: ContentIndex,
  state: GameState,
  unitId: string,
  abilityId: string,
  target: Vec2,
): StepResult {
  const battle = state.battle;
  if (!battle) return refuse(state, 'No battle in progress.');
  if (battle.phase !== 'active') return refuse(state, 'The fight is over.');
  if (battle.order[battle.turnIndex] !== unitId) return refuse(state, 'Not that unit’s turn.');

  const unit = battle.units.find((u) => u.id === unitId);
  if (!unit) return refuse(state, 'No such unit.');

  const ability = content.abilities.get(abilityId);
  if (!ability) return refuse(state, `Unknown ability "${abilityId}".`);

  const usable = canUseAbility(content, unit, ability);
  if (!usable.ok) return refuse(state, usable.reason);

  const valid = isValidTarget(content, battle, unit, ability, target);
  if (!valid.ok) return refuse(state, valid.reason);

  const rng = new RngCursor(state.rng);
  const draft = new BattleDraft(content, battle, rng);

  draft.spendAp(unitId, ability.apCost);
  draft.setCooldown(unitId, abilityId, ability.cooldown);

  const caster = draft.unit(unitId);
  if (!caster) return refuse(state, 'No such unit.');
  resolveAbility(draft, caster, ability, target, rng);

  settleOutcome(draft);
  return finish(content, state, draft.toBattle(), rng, draft.events);
}

function handleEndTurn(content: ContentIndex, state: GameState, unitId: string): StepResult {
  const battle = state.battle;
  if (!battle) return refuse(state, 'No battle in progress.');
  if (battle.phase !== 'active') return refuse(state, 'The fight is over.');
  if (battle.order[battle.turnIndex] !== unitId) return refuse(state, 'Not that unit’s turn.');

  const rng = new RngCursor(state.rng);
  const draft = new BattleDraft(content, battle, rng);
  draft.endTurn(unitId);
  advanceToNextTurn(draft);
  settleOutcome(draft);
  return finish(content, state, draft.toBattle(), rng, draft.events);
}

/**
 * Runs one AI unit's entire turn and hands the turn on. The AI plans and acts
 * in the same step because there is nobody to show a preview to.
 */
function handleAiTurn(content: ContentIndex, state: GameState): StepResult {
  const battle = state.battle;
  if (!battle) return refuse(state, 'No battle in progress.');
  if (battle.phase !== 'active') return refuse(state, 'The fight is over.');

  const unitId = battle.order[battle.turnIndex];
  const unit = unitId ? battle.units.find((u) => u.id === unitId) : undefined;
  if (!unit || !isAlive(unit)) {
    const rng = new RngCursor(state.rng);
    const draft = new BattleDraft(content, battle, rng);
    advanceToNextTurn(draft);
    settleOutcome(draft);
    return finish(content, state, draft.toBattle(), rng, draft.events);
  }
  if (unit.ai === 'none') return refuse(state, `${unit.name} is not AI-controlled.`);

  const rng = new RngCursor(state.rng);
  const draft = new BattleDraft(content, battle, rng);
  planAiTurn(draft, unit.id, rng);
  draft.endTurn(unit.id);
  advanceToNextTurn(draft);
  settleOutcome(draft);
  return finish(content, state, draft.toBattle(), rng, draft.events);
}

/**
 * Closes out a finished battle: XP, level-ups, HP carried back to the party,
 * and the story node that follows. Defeat revives the party and routes to the
 * node's `onDefeat`, which loops back to the same fight.
 */
function handleResolveBattle(content: ContentIndex, state: GameState): StepResult {
  const battle = state.battle;
  if (!battle) return refuse(state, 'No battle to resolve.');
  if (battle.phase === 'active') return refuse(state, 'The fight is not over yet.');

  const node = currentNode(content, state);
  const events: GameEvent[] = [];
  const victory = battle.phase === 'victory';

  let party: Unit[];
  const pendingChoices: PendingChoice[] = [...state.pendingChoices];

  if (victory) {
    const encounter = content.encounters.get(battle.encounterId);

    /*
     * XP comes from the roster a *baseline-sized* party would face — the
     * authored enemies plus any flag-gated additions (trade Ruon away and the
     * mercenaries at the quarry floor count) — divided by that baseline, not
     * by how many people actually turned up.
     *
     * This deliberately breaks the usual "split the pot" rule. Rosters scale
     * with the table (see rules/difficulty.ts), so splitting actual XP by
     * actual party size would leave a table of six levelling more slowly than
     * a table of three and arriving at the boss under-levelled. Every table
     * should reach the quarry floor at about level 4.
     */
    const roster = encounter ? xpRoster(encounter, state.flags) : [];
    const authoredXp = roster.reduce(
      (sum, placement) => sum + (content.enemies.get(placement.enemyId)?.xp ?? 0),
      0,
    );
    const baseline = Math.max(1, encounter?.baselinePartySize ?? 3);
    const perMember = Math.max(1, Math.round(authoredXp / baseline));

    const absorbed = absorbBattleResults(state, battle);
    const shares = absorbed.map(() => perMember);

    party = absorbed.map((member, index) => {
      const character = member.characterId ? content.characters.get(member.characterId) : undefined;
      const discipline = member.disciplineId
        ? content.disciplines.get(member.disciplineId)
        : undefined;
      const gain = awardXp(content, member, shares[index] ?? 0, character, discipline);
      if ((shares[index] ?? 0) > 0) {
        events.push({ type: 'xpGained', unitId: member.id, amount: shares[index] ?? 0 });
      }
      if (gain.levelsGained > 0) {
        events.push({
          type: 'leveledUp',
          unitId: member.id,
          level: gain.unit.level,
          unlocked: gain.granted,
        });
        for (const options of gain.pendingChoices) {
          pendingChoices.push({
            unitId: member.id,
            level: gain.unit.level,
            kind: 'ability',
            options,
          });
          events.push({ type: 'levelChoiceOffered', unitId: member.id, options });
        }
        for (const options of gain.pendingSpecializations) {
          pendingChoices.push({
            unitId: member.id,
            level: gain.unit.level,
            kind: 'discipline',
            options,
          });
          events.push({ type: 'disciplineOffered', unitId: member.id, options });
        }
      }
      return gain.unit;
    });

    party = restAfterVictory(party);
  } else {
    party = reviveParty(absorbBattleResults(state, battle));
  }

  const nextNodeId = node?.kind === 'battle' ? (victory ? node.next : node.onDefeat) : null;

  const staged: GameState = {
    ...state,
    party,
    battle: null,
    pendingChoices,
    world: victory
      ? { ...state.world, cleared: [...new Set([...state.world.cleared, battle.encounterId])] }
      : state.world,
  };

  if (!nextNodeId) {
    return {
      state: { ...staged, log: appendLog(content, battle, state.log, events) },
      events,
    };
  }

  const moved = enterStoryNode(content, staged, nextNodeId);
  const allEvents = [...events, ...moved.events];
  return {
    state: { ...moved.state, log: appendLog(content, battle, state.log, allEvents) },
    events: allEvents,
  };
}

/**
 * Explore-map walking. Tapping an NPC opens their node; tapping the exit
 * advances the current explore node; anything else is a step.
 */
function handleWalkTo(content: ContentIndex, state: GameState, pos: Vec2): StepResult {
  if (state.screen !== 'explore') return refuse(state, 'Not exploring right now.');
  const map = content.maps.get(state.location.mapId);
  if (!map) return refuse(state, 'No map loaded.');

  const npc = visibleNpcs(map, state).find((n) => samePos(n.pos, pos));
  if (npc) {
    if (distance(state.location.pos, pos) > 1) {
      // Walk adjacent first rather than teleporting into a conversation.
      const approach = findApproach(content, state, pos);
      if (!approach) return refuse(state, 'You cannot reach them from here.');
      const step = handleWalkTo(content, state, approach);
      if (
        step.state.screen !== 'explore' ||
        step.state.location.mapId !== map.id ||
        !samePos(step.state.location.pos, approach)
      )
        return step;
      const walked = step.state;
      const target = npcNode(content, walked, map.id, npc.id);
      if (!target) return refuse(walked, 'They have nothing to say.');
      const entered = withLog(
        content,
        walked,
        pinIfDialogue(map, npc, enterStoryNode(content, walked, target)),
      );
      return {
        state: entered.state,
        events: [...step.events, ...entered.events],
      };
    }
    const target = npcNode(content, state, map.id, npc.id);
    if (!target) return refuse(state, 'They have nothing to say.');
    return withLog(content, state, pinIfDialogue(map, npc, enterStoryNode(content, state, target)));
  }

  const grid = buildExploreGrid(content, state);
  const tile = tileAt(grid, pos);
  if (!tile || tile.blocked) return refuse(state, 'You cannot walk there.');

  /*
   * Walk, do not teleport. Without a path check, tapping the far side of a
   * building puts the party inside it — the destination tile is walkable, but
   * there is no way to reach it. The budget is generous because explore maps
   * have no move points; it only has to bound the search.
   */
  const route = findPath(
    { grid, blocked: new Set<string>(), surfaces: content.surfaces, size: 1 },
    state.location.pos,
    pos,
    grid.width * grid.height,
  );
  if (!route) return refuse(state, 'There is no way through from here.');

  const triggers = activeTriggers(map, state);
  for (let index = 0; index < route.path.length; index++) {
    const point = route.path[index];
    if (!point) continue;
    const trigger = triggers.find((item) => item.area.some((cell) => samePos(cell, point)));
    if (!trigger) continue;
    const stopped: GameState = {
      ...state,
      location: { ...state.location, pos: point },
      world: {
        ...state.world,
        fired: [...new Set([...state.world.fired, triggerKey(map, trigger)])],
      },
    };
    const entered = withLog(content, stopped, enterStoryNode(content, stopped, trigger.node));
    return {
      state: entered.state,
      events: [...partyWalked(state, route.path.slice(0, index + 1)), ...entered.events],
    };
  }

  const moved: GameState = { ...state, location: { ...state.location, pos } };
  const walk = partyWalked(state, route.path);
  const exit = map.exits?.find((item) => samePos(item.pos, pos));
  if (exit) {
    if (!evaluate(moved, exit.requires))
      return {
        state: moved,
        events: [
          ...walk,
          { type: 'message', text: exit.lockedHint ?? 'This route is not open yet.' },
        ],
      };
    const destination = content.maps.get(exit.toMapId);
    if (!destination || tileAt(buildGrid(destination), exit.toPos)?.blocked !== false)
      return refuse(state, 'This route is unavailable.');
    // Arrive beside the return exit, never on it. Reciprocal routes are explicit.
    return {
      state: {
        ...moved,
        location: { mapId: destination.id, pos: exit.toPos },
        story: { ...moved.story, nodeId: null, lineIndex: 0 },
        world: {
          ...moved.world,
          returnPos: { ...moved.world.returnPos, [map.id]: pos, [destination.id]: exit.toPos },
        },
      },
      events: [...walk, { type: 'screenChanged', screen: 'explore' }],
    };
  }

  if (!map.exits?.length && map.exit && samePos(map.exit.pos, pos)) {
    const node = currentNode(content, moved);
    if (node?.kind === 'explore') {
      const entered = withLog(content, moved, enterStoryNode(content, moved, node.next));
      return { state: entered.state, events: [...walk, ...entered.events] };
    }
  }

  return { state: moved, events: walk };
}

/**
 * Sets the conversation pin (ADR 0047 §4, B1) when an NpcDef-opened node
 * lands in dialogue. `anchor` is the NPC's own tile, formatted like
 * `posKey` elsewhere in this file — a placeholder for "where this
 * conversation opened" until the real anchor system (W4a) exists.
 */
function pinIfDialogue(map: MapDef, npc: NpcDef, entered: StepResult): StepResult {
  if (entered.state.screen !== 'dialogue') return entered;
  return {
    state: {
      ...entered.state,
      world: {
        ...entered.state.world,
        talk: { npcId: npc.id, mapId: map.id, anchor: posKey(npc.pos) },
      },
    },
    events: entered.events,
  };
}

/**
 * `{ type: 'wait'; until }` (ADR 0047 §1). Refused for every reason the
 * ADR lists; changes only the clock, and only via `advancePhase`.
 */
function handleWait(content: ContentIndex, state: GameState, until: DayPhase): StepResult {
  if (state.screen !== 'explore' || state.battle !== null) {
    return refuse(state, 'Not exploring right now.');
  }
  if (state.story.nodeId) {
    const node = content.story.get(state.story.nodeId);
    if (node && node.kind !== 'explore') {
      return refuse(state, 'You are in the middle of something.');
    }
  }
  if (until === state.world.clock.phase) {
    return refuse(state, 'It is already that time.');
  }

  const map = content.maps.get(state.location.mapId);
  if (!map) return refuse(state, 'No map loaded.');
  const leader = state.party[0];
  if (!leader) return refuse(state, 'There is no one to wait.');

  // In explore the leader's tile is `location.pos`; `party[0].pos` is only set
  // in battle (see `partyWalked` and `app/world/guidance`).
  const leaderPos = state.location.pos;
  const nearRestSpot = (map.restSpots ?? []).some((spot) => distance(leaderPos, spot.pos) <= 1);
  if (!nearRestSpot) {
    return refuse(state, 'You need to be somewhere you can wait — like a bench or a porch.');
  }

  // Checked against the *post-wait* state: a phase change can change which
  // NPCs are visible (`NpcDef.when` may key off the clock), so whether the
  // leader will need resettling — and whether anywhere free exists for
  // `settle()` to put them (it runs after every command, including this
  // one) — is only knowable after `advancePhase`, not before it.
  const advanced = advancePhase(state, until);
  const onNpc = visibleNpcs(map, advanced).some((npc) => samePos(npc.pos, leaderPos));
  if (onNpc) {
    const grid = buildExploreGrid(content, advanced);
    if (!findSettleTile(content, map, grid, advanced, leaderPos)) {
      return refuse(state, 'There is nowhere for the party to stand.');
    }
  }

  const events: GameEvent[] = [
    {
      type: 'phaseChanged',
      from: state.world.clock.phase,
      to: until,
      day: advanced.world.clock.day,
    },
  ];
  return {
    state: { ...advanced, log: appendLog(content, null, state.log, events) },
    events,
  };
}

/**
 * The walk as an event, so the party is seen crossing the tiles instead of
 * appearing at the far end. Presentation plays it; nothing in the rules
 * reads it. Standing still (an empty route) is no event.
 */
function partyWalked(state: GameState, path: readonly Vec2[]): GameEvent[] {
  const leader = state.party[0];
  if (!leader || path.length === 0) return [];
  return [{ type: 'partyWalked', unitId: leader.id, from: state.location.pos, path }];
}

/**
 * Explore maps carry no battle, so their grid is derived from the map each
 * time it is needed. Memoised by map definition because the tiles never change outside
 * combat and a 24x16 rebuild on every tap would be pure waste.
 */
const exploreGrids = new WeakMap<MapDef, Grid>();

function buildExploreGrid(content: ContentIndex, state: GameState): Grid {
  const map = content.maps.get(state.location.mapId);
  if (!map) throw new Error(`Unknown map "${state.location.mapId}"`);
  const cached = exploreGrids.get(map);
  if (cached) return cached;
  const built = buildGrid(map);
  exploreGrids.set(map, built);
  return built;
}

/** Nearest walkable tile adjacent to `target`, for approaching an NPC. */
function findApproach(content: ContentIndex, state: GameState, target: Vec2): Vec2 | null {
  const grid = buildExploreGrid(content, state);
  const occupied = new Set<string>([posKey(target)]);
  let best: Vec2 | null = null;
  let bestDistance = Infinity;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const candidate = { x: target.x + dx, y: target.y + dy };
      if (occupied.has(posKey(candidate))) continue;
      const tile = tileAt(grid, candidate);
      if (!tile || tile.blocked) continue;
      const path = findPath(
        { grid, blocked: occupied, surfaces: content.surfaces, size: 1 },
        state.location.pos,
        candidate,
        grid.width * grid.height,
      );
      if (!path) continue;
      const d = path.path.length;
      if (d < bestDistance) {
        bestDistance = d;
        best = candidate;
      }
    }
  }
  return best;
}

function handleChooseLevelUp(
  content: ContentIndex,
  state: GameState,
  unitId: string,
  abilityId: string,
): StepResult {
  const index = state.pendingChoices.findIndex(
    (c) => c.unitId === unitId && c.kind === 'ability' && c.options.includes(abilityId),
  );
  if (index === -1) return refuse(state, 'No level-up choice is waiting for that unit.');

  const party = state.party.map((member) =>
    member.id === unitId
      ? { ...member, abilities: [...new Set([...member.abilities, abilityId])] }
      : member,
  );

  const pendingChoices = state.pendingChoices.filter((_, i) => i !== index);
  const ability = content.abilities.get(abilityId);
  const events: GameEvent[] = [
    {
      type: 'message',
      text: `${state.party.find((u) => u.id === unitId)?.name ?? unitId} learns ${ability?.name ?? abilityId}.`,
    },
  ];

  return {
    state: { ...state, party, pendingChoices, log: appendLog(content, null, state.log, events) },
    events,
  };
}

/**
 * Commits a unit to a discipline.
 *
 * The pending choice lists every path the element has, locked ones included,
 * so the dialog can show what is out there — which means this is the place the
 * flag actually gets checked. A locked pick is refused rather than silently
 * substituted: the player is looking at the card, and quietly giving them a
 * different path would be worse than saying no.
 */
function handleChooseDiscipline(
  content: ContentIndex,
  state: GameState,
  unitId: string,
  disciplineId: string,
): StepResult {
  const index = state.pendingChoices.findIndex(
    (c) => c.unitId === unitId && c.kind === 'discipline' && c.options.includes(disciplineId),
  );
  if (index === -1) return refuse(state, 'No path is waiting for that unit to choose.');

  const discipline = content.disciplines.get(disciplineId);
  if (!discipline) return refuse(state, 'That path does not exist.');
  if (!disciplineUnlocked(discipline, state.flags)) {
    return refuse(state, `${discipline.name} is not open yet. ${discipline.lockedHint}`);
  }

  const member = state.party.find((u) => u.id === unitId);
  if (!member) return refuse(state, 'That unit is not in the party.');

  const character = member.characterId ? content.characters.get(member.characterId) : undefined;
  const adoption = adoptDiscipline(content, member, character, discipline);

  const pendingChoices = state.pendingChoices.filter((_, i) => i !== index);
  const events: GameEvent[] = [
    {
      type: 'disciplineChosen',
      unitId,
      disciplineId,
      unlocked: adoption.granted,
    },
  ];

  // A path may owe a technique choice at a level already reached.
  for (const options of adoption.pendingChoices) {
    pendingChoices.push({ unitId, level: member.level, kind: 'ability', options });
    events.push({ type: 'levelChoiceOffered', unitId, options });
  }

  const party = state.party.map((u) => (u.id === unitId ? adoption.unit : u));

  return {
    state: { ...state, party, pendingChoices, log: appendLog(content, null, state.log, events) },
    events,
  };
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

function applyCommand(content: ContentIndex, state: GameState, command: Command): StepResult {
  switch (command.type) {
    case 'enterNode':
      return withLog(content, state, enterStoryNode(content, state, command.nodeId));

    case 'advanceDialogue': {
      const node = currentNode(content, state);
      if (node?.kind === 'dialogue')
        return withLog(content, state, advanceDialogue(content, state));
      // Leaving a conversation that ends nowhere returns to the explore map.
      const fallback = exploreNodeFor(content, state.location.mapId);
      if (fallback) return withLog(content, state, enterStoryNode(content, state, fallback));
      return { state, events: [] };
    }

    case 'chooseOption':
      return withLog(content, state, chooseOption(content, state, command.optionIndex));

    case 'walkTo':
      return handleWalkTo(content, state, command.pos);

    case 'startBattle': {
      const node = [...content.story.values()].find(
        (n) => n.kind === 'battle' && n.encounterId === command.encounterId,
      );
      if (!node) return refuse(state, `No story node runs encounter "${command.encounterId}".`);
      return withLog(content, state, enterStoryNode(content, state, node.id));
    }

    case 'move':
      return handleMove(content, state, command.unitId, command.path);

    case 'useAbility':
      return handleUseAbility(content, state, command.unitId, command.abilityId, command.target);

    case 'endTurn':
      return handleEndTurn(content, state, command.unitId);

    case 'runAiTurn':
      return handleAiTurn(content, state);

    case 'resolveBattle':
      return handleResolveBattle(content, state);

    case 'chooseLevelUp':
      return handleChooseLevelUp(content, state, command.unitId, command.abilityId);

    case 'chooseDiscipline':
      return handleChooseDiscipline(content, state, command.unitId, command.disciplineId);

    case 'setFlags': {
      const events: GameEvent[] = Object.entries(command.flags).map(([key, value]) => ({
        type: 'flagSet' as const,
        key,
        value,
      }));
      return { state: { ...state, flags: { ...state.flags, ...command.flags } }, events };
    }

    case 'wait':
      return handleWait(content, state, command.until);
  }
}

/**
 * The one door into the rules. Every command runs through `settle`
 * afterward (ADR 0047 §5, B2): it clears a conversation pin the result no
 * longer supports, and — in explore only — steps the leader off a
 * visible NPC tile. `settle`'s events are appended after the command's
 * own.
 */
export function apply(content: ContentIndex, state: GameState, command: Command): StepResult {
  const result = applyCommand(content, state, command);
  const settled = settle(content, state, result.state);
  return { state: settled.state, events: [...result.events, ...settled.events] };
}

/** Applies a list of commands in order. Used by the simulator and by tests. */
export function applyAll(
  content: ContentIndex,
  state: GameState,
  commands: readonly Command[],
): StepResult {
  let current = state;
  const events: GameEvent[] = [];
  for (const command of commands) {
    const result = apply(content, current, command);
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
}
