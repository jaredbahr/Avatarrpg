import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import {
  affectedTiles,
  canUseAbility,
  isValidTarget,
  movePoints,
  resolveAim,
  targetableTiles,
  unitsOnTiles,
} from '../rules/abilities';
import { allowsCasterTarget, pathCost, posKey, reachable, tileAt } from '../rules/grid';
import { combinedKit, grantedUpTo } from '../rules/leveling';
import { canMove, isAlive } from '../rules/stats';
import { BattleDraft } from '../state/battleDraft';
import { createBattle, createGame } from '../state/createGame';
import type { PartySlot } from '../state/createGame';
import { describeEvent } from '../state/log';
import { apply } from '../state/reducer';
import type {
  Ability,
  BattleState,
  Command,
  ContentIndex,
  DisciplineDef,
  GameEvent,
  GameState,
  StepResult,
  Unit,
  Vec2,
} from '../types';
import { defaultDisciplineFor } from './balance';
import { STANDARD_PARTY, runCombat } from './runCombat';

interface Build {
  readonly label: string;
  readonly discipline: DisciplineDef;
  readonly subjectId: string;
  readonly party: readonly PartySlot[];
  readonly abilities: readonly string[];
}

/** Each alternative is a separate legal build, never two exclusive grants. */
function disciplineBuilds(): Build[] {
  return [...CONTENT.disciplines.values()].flatMap((discipline) => {
    const index = STANDARD_PARTY.findIndex(
      (slot) => CONTENT.characters.get(slot.characterId)?.element === discipline.element,
    );
    const subject = STANDARD_PARTY[index];
    if (!subject) throw new Error(`No standard subject for ${discipline.id}`);
    const choices = discipline.kit.reduce<string[][]>(
      (sets, entry) =>
        'choose' in entry ? sets.flatMap((set) => entry.choose.map((id) => [...set, id])) : sets,
      [[]],
    );
    return choices.map((chosen) => ({
      label: `${discipline.id}/${chosen.join('+') || 'granted'}`,
      discipline,
      subjectId: `p${index}`,
      party: STANDARD_PARTY.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, discipline: discipline.id, chosen } : { ...slot },
      ),
      abilities: [...grantedUpTo(discipline.kit, 10), ...chosen],
    }));
  });
}

const ENCOUNTERS = [
  { encounterId: 'enc_forest_road', variantId: 'thugs' },
  { encounterId: 'enc_grumbler' },
] as const;

function activeId(state: GameState): string | undefined {
  return state.battle?.order[state.battle.turnIndex];
}

function safeLog(lines: readonly string[]): void {
  const malformed = lines.filter((line) => typeof line !== 'string' || /undefined|NaN/.test(line));
  expect(malformed).toEqual([]);
}

/** Resolve UI footprint taps before sending the reducer its exact aim cell. */
function legalTargets(
  content: ContentIndex,
  battle: BattleState,
  actor: Unit,
  ability: Ability,
): Vec2[] {
  const unique = new Map<string, Vec2>();
  for (const tap of targetableTiles(content, battle, actor, ability)) {
    const target = resolveAim(content, battle, actor, ability, tap);
    if (isValidTarget(content, battle, actor, ability, target).ok) {
      unique.set(posKey(target), target);
    }
  }
  return [...unique.values()];
}

function atPosition(battle: BattleState, actor: Unit, pos: Vec2): [BattleState, Unit] {
  const standing = { ...actor, pos };
  return [
    { ...battle, units: battle.units.map((unit) => (unit.id === actor.id ? standing : unit)) },
    standing,
  ];
}

function needsOpponent(ability: Ability): boolean {
  return ability.targeting.shape === 'unit' && ability.targeting.allow === 'enemy';
}

interface Witness {
  readonly abilityId: string;
  readonly round: number;
  readonly from: Vec2;
  readonly target: Vec2;
}

function preferredPolicy(build: Build) {
  const used = new Set<string>();
  const opportunities = new Map<string, Witness>();
  let subjectActivations = 0;
  // Geometry is pure for these immutable inputs. Keep the cache inside each
  // fresh policy so repetitions still reconstruct and execute every battle.
  const targetsByContent = new WeakMap<
    ContentIndex,
    WeakMap<BattleState, WeakMap<Unit, Map<Ability, Vec2[]>>>
  >();
  const targets = (
    content: ContentIndex,
    battle: BattleState,
    actor: Unit,
    ability: Ability,
  ): Vec2[] => {
    let byBattle = targetsByContent.get(content);
    if (!byBattle) targetsByContent.set(content, (byBattle = new WeakMap()));
    let byActor = byBattle.get(battle);
    if (!byActor) byBattle.set(battle, (byActor = new WeakMap()));
    let byAbility = byActor.get(actor);
    if (!byAbility) byActor.set(actor, (byAbility = new Map()));
    let found = byAbility.get(ability);
    if (!found) {
      found = legalTargets(content, battle, actor, ability);
      byAbility.set(ability, found);
    }
    return found;
  };
  const definitions = build.abilities.map((id) => {
    const ability = CONTENT.abilities.get(id);
    if (!ability) throw new Error(`Missing discipline ability ${id}`);
    return ability;
  });

  const pending = () => definitions.filter((ability) => !used.has(ability.id));

  const inspect = (content: ContentIndex, state: GameState): void => {
    safeLog(state.log);
    const battle = state.battle;
    const actor = battle?.units.find((unit) => unit.id === build.subjectId);
    if (!battle || !actor || !isAlive(actor) || activeId(state) !== actor.id) return;
    // Census every pending technique before selecting one. Seeing a legal
    // opportunity and then overlooking it can never become a no-target excuse.
    for (const ability of pending()) {
      if (!canUseAbility(content, actor, ability).ok) continue;
      const target = targets(content, battle, actor, ability)[0];
      if (target) {
        opportunities.set(ability.id, {
          abilityId: ability.id,
          round: battle.round,
          from: actor.pos,
          target,
        });
      }
    }
  };

  const pickTarget = (
    content: ContentIndex,
    battle: BattleState,
    actor: Unit,
    ability: Ability,
  ): Vec2 | undefined => {
    const reserve = pending().filter(needsOpponent).length;
    const enemies = battle.units.filter((unit) => unit.faction === 'enemy' && isAlive(unit));
    const ranked = targets(content, battle, actor, ability).map((target) => {
      const cells = affectedTiles(content, battle.grid, actor, ability, target);
      const affected = unitsOnTiles(battle.units, cells).filter(
        (unit) => unit.id !== actor.id || allowsCasterTarget(ability),
      );
      const friends = affected.filter((unit) => unit.faction !== 'enemy').length;
      const foes = affected.filter((unit) => unit.faction === 'enemy');
      let score = 0;
      if (needsOpponent(ability)) {
        // Prefer a real opponent, with the toughest one first. Props remain
        // legitimate fallback targets under the real unit-targeting rules.
        score = foes.length ? -1000 - (foes[0]?.hp ?? 0) : 0;
      } else if (ability.targeting.shape !== 'unit' && ability.targeting.shape !== 'self') {
        score = friends * 10000 + (foes.length ? -100 + foes.length : 0);
        // Preserve bodies needed by still-unseen unit-targeted techniques.
        if (foes.length && enemies.length - foes.length < reserve) score += 100000;
        if (cells.length === 0) score += 1000;
        if (tileAt(battle.grid, target)?.blocked) score += 20;
      }
      return { target, score };
    });
    ranked.sort((a, b) => a.score - b.score || a.target.y - b.target.y || a.target.x - b.target.x);
    return ranked[0]?.target;
  };

  const drive = (content: ContentIndex, initial: GameState, unitId: string): StepResult => {
    let state = initial;
    const events: GameEvent[] = [];
    inspect(content, state);
    const execute = (command: Command): StepResult => {
      const step = apply(content, state, command);
      state = step.state;
      events.push(...step.events);
      for (const event of step.events) {
        if (event.type === 'abilityUsed' && event.unitId === build.subjectId) {
          if (build.abilities.includes(event.abilityId)) used.add(event.abilityId);
        }
      }
      inspect(content, state);
      return step;
    };
    const continuing = () => state.battle?.phase === 'active' && activeId(state) === unitId;

    // Once every preferred technique has really executed, finish through the
    // equipped level-1 attack. Full-kit party AI forecasting is tested by the
    // parity controls below; repeating it across all builds is not this smoke's
    // purpose. Enemy AI and every real reducer effect remain unchanged.
    const finish = (): StepResult => {
      while (continuing()) {
        const battle = state.battle;
        const actor = battle?.units.find((unit) => unit.id === unitId);
        if (!battle || !actor || !isAlive(actor)) break;
        const kit = actor.characterId ? content.characters.get(actor.characterId)?.kit : undefined;
        const first = kit?.find((entry) => entry.level === 1 && 'ability' in entry);
        const ability =
          first && 'ability' in first ? content.abilities.get(first.ability) : undefined;
        if (!ability || !actor.abilities.includes(ability.id)) {
          throw new Error(`Missing equipped basic attack for ${unitId}`);
        }
        if (!canUseAbility(content, actor, ability).ok) break;
        const enemyTarget = (board: BattleState, standing: Unit): Vec2 | undefined =>
          targets(content, board, standing, ability).find((target) =>
            unitsOnTiles(
              board.units,
              affectedTiles(content, board.grid, standing, ability, target),
            ).some((unit) => unit.faction === 'enemy' && isAlive(unit)),
          );
        const here = enemyTarget(battle, actor);
        if (here) {
          const cast = execute({ type: 'useAbility', unitId, abilityId: ability.id, target: here });
          const after = state.battle?.units.find((unit) => unit.id === unitId);
          if (
            !cast.events.some(
              (event) =>
                event.type === 'abilityUsed' &&
                event.unitId === unitId &&
                event.abilityId === ability.id,
            ) ||
            (continuing() && (!after || !(after.ap < actor.ap)))
          ) {
            throw new Error('Basic finishing cast was refused or consumed no AP');
          }
          continue;
        }
        if (!canMove(content, actor) || movePoints(content, actor) <= 0) break;
        const context = new BattleDraft(content, battle, new RngCursor(state.rng)).moveContext(
          actor,
        );
        const destinations = [...reachable(context, actor.pos, Infinity).values()].sort(
          (a, b) => a.cost - b.cost || a.pos.y - b.pos.y || a.pos.x - b.pos.x,
        );
        const goal = destinations.find((destination) => {
          const [projected, standing] = atPosition(battle, actor, destination.pos);
          return enemyTarget(projected, standing) !== undefined;
        });
        let path: readonly Vec2[] = [];
        for (let length = 1; goal && length <= goal.path.length; length++) {
          const prefix = goal.path.slice(0, length);
          const cost = pathCost(context, actor.pos, prefix);
          if (cost === null || cost > movePoints(content, actor)) break;
          path = prefix;
        }
        if (!path.length) break;
        const walked = execute({ type: 'move', unitId, path });
        const after = state.battle?.units.find((unit) => unit.id === unitId);
        if (
          !walked.events.some((event) => event.type === 'unitMoved' && event.unitId === unitId) ||
          (continuing() && (!after || !(after.move < actor.move)))
        ) {
          throw new Error('Legal finishing path was refused or consumed no movement');
        }
      }
      if (continuing()) execute({ type: 'endTurn', unitId });
      return { state, events };
    };

    if (unitId !== build.subjectId || used.size === definitions.length) {
      if (used.size === definitions.length) return finish();
      execute({ type: 'endTurn', unitId });
      return { state, events };
    }
    subjectActivations++;

    // Every successful iteration consumes an unseen technique. Movement is
    // executed separately and revalidated; no state, AP, status or RNG edits.
    for (let remaining = pending().length; remaining > 0 && continuing(); remaining--) {
      const battle = state.battle;
      const actor = battle?.units.find((unit) => unit.id === unitId);
      if (!battle || !actor || !isAlive(actor)) break;
      const ordered = pending().sort((a, b) => Number(needsOpponent(b)) - Number(needsOpponent(a)));
      // Most preferred casts are already in range. Search movement only when
      // a usable technique has no target from the current position.
      const availableMoves = () => {
        const context = new BattleDraft(content, battle, new RngCursor(state.rng)).moveContext(
          actor,
        );
        return canMove(content, actor)
          ? [...reachable(context, actor.pos, movePoints(content, actor)).values()].sort(
              (a, b) => a.cost - b.cost || a.pos.y - b.pos.y || a.pos.x - b.pos.x,
            )
          : [];
      };
      let moves: ReturnType<typeof availableMoves> | undefined;
      let plan: { ability: Ability; target: Vec2; path: readonly Vec2[] } | undefined;
      for (const ability of ordered) {
        if (!canUseAbility(content, actor, ability).ok) continue;
        const here = pickTarget(content, battle, actor, ability);
        if (here) {
          plan = { ability, target: here, path: [] };
          break;
        }
        for (const move of (moves ??= availableMoves())) {
          if (!move.path.length) continue;
          const [projected, standing] = atPosition(battle, actor, move.pos);
          const target = pickTarget(content, projected, standing, ability);
          if (target) {
            plan = { ability, target, path: move.path };
            break;
          }
        }
        if (plan) break;
      }
      if (!plan) break;
      if (plan.path.length) execute({ type: 'move', unitId, path: plan.path });
      if (!continuing()) break;
      const currentBattle = state.battle;
      const current = currentBattle?.units.find((unit) => unit.id === unitId);
      if (!currentBattle || !current || !canUseAbility(content, current, plan.ability).ok) break;
      const target = isValidTarget(content, currentBattle, current, plan.ability, plan.target).ok
        ? plan.target
        : pickTarget(content, currentBattle, current, plan.ability);
      if (!target) break;
      execute({ type: 'useAbility', unitId, abilityId: plan.ability.id, target });
      if (!used.has(plan.ability.id)) {
        throw new Error(`${build.label}: preferred legal cast ${plan.ability.id} was refused`);
      }
    }

    // If a unit-targeted technique is still too far away, follow the cheapest
    // real path to a casting position, taking only this activation's prefix.
    if (continuing() && pending().some(needsOpponent)) {
      const battle = state.battle;
      const actor = battle?.units.find((unit) => unit.id === unitId);
      if (battle && actor && canMove(content, actor) && movePoints(content, actor) > 0) {
        const context = new BattleDraft(content, battle, new RngCursor(state.rng)).moveContext(
          actor,
        );
        const destinations = [...reachable(context, actor.pos, Infinity).values()].sort(
          (a, b) => a.cost - b.cost || a.pos.y - b.pos.y || a.pos.x - b.pos.x,
        );
        let path: readonly Vec2[] = [];
        for (const ability of pending().filter(needsOpponent)) {
          const goal = destinations.find((destination) => {
            const [projected, standing] = atPosition(battle, actor, destination.pos);
            return targets(content, projected, standing, ability).length > 0;
          });
          if (!goal) continue;
          for (let length = 1; length <= goal.path.length; length++) {
            const prefix = goal.path.slice(0, length);
            const cost = pathCost(context, actor.pos, prefix);
            if (cost === null || cost > movePoints(content, actor)) break;
            path = prefix;
          }
          if (path.length) break;
        }
        if (path.length) execute({ type: 'move', unitId, path });
      }
    }
    if (used.size === definitions.length) return finish();
    if (continuing()) execute({ type: 'endTurn', unitId });
    return { state, events };
  };

  const coverage = () => ({
    used: [...used].sort(),
    missing: pending().map((ability) => ability.id),
    subjectActivations,
    opportunities: [...opportunities.values()].sort((a, b) =>
      a.abilityId.localeCompare(b.abilityId),
    ),
  });
  return { drive, coverage };
}

describe('level-10 discipline smoke through real combat', () => {
  const builds = disciplineBuilds();
  const cases = builds.flatMap((build) =>
    ENCOUNTERS.map((encounter) => ({
      label: `${build.label}/${encounter.encounterId}`,
      build,
      encounter,
    })),
  );

  it('covers every discipline and every legal discipline choice', () => {
    expect(new Set(builds.map((build) => build.discipline.id))).toEqual(
      new Set(CONTENT.disciplines.keys()),
    );
    for (const discipline of CONTENT.disciplines.values()) {
      const expected = discipline.kit.flatMap((entry) =>
        'ability' in entry ? [entry.ability] : 'choose' in entry ? [...entry.choose] : [],
      );
      const covered = builds
        .filter((build) => build.discipline.id === discipline.id)
        .flatMap((build) => build.abilities);
      expect(new Set(covered), discipline.id).toEqual(new Set(expected));
    }
  });

  it.each(cases)('$label', ({ build, encounter }) => {
    const seed = `discipline-smoke-564:${build.label}:${encounter.encounterId}`;
    // This is a level-10 whole-party execution fixture. Exactly one slot is
    // forced onto the subject path; all companions retain their default build.
    // It makes no balance or currently reachable campaign-progression claim.
    const seeded = createGame(CONTENT, {
      seed,
      startNode: '',
      party: build.party.map((slot) => ({ ...slot, level: 10, autoChoose: true })),
    });
    const initial = createBattle(
      CONTENT,
      seeded,
      encounter.encounterId,
      new RngCursor(seeded.rng),
      {
        variantId: 'variantId' in encounter ? encounter.variantId : undefined,
      },
    );
    const subject = initial.units.find((unit) => unit.id === build.subjectId);
    expect(subject?.disciplineId).toBe(build.discipline.id);
    expect(subject?.abilities).toEqual(expect.arrayContaining([...build.abilities]));
    for (const unit of seeded.party) {
      expect(unit.level).toBe(10);
      if (unit.id !== build.subjectId) {
        expect(unit.disciplineId).toBe(defaultDisciplineFor(CONTENT, unit.element));
      }
    }
    const character = subject?.characterId
      ? CONTENT.characters.get(subject.characterId)
      : undefined;
    const fullKit = combinedKit(character, build.discipline);
    expect(subject?.abilities).toEqual(expect.arrayContaining(grantedUpTo(fullKit, 10)));
    for (const entry of fullKit) {
      if ('choose' in entry) {
        expect(entry.choose.filter((id) => subject?.abilities.includes(id))).toHaveLength(1);
      }
    }

    const run = () => {
      const policy = preferredPolicy(build);
      const result = runCombat(CONTENT, {
        ...encounter,
        seed,
        party: build.party,
        partyLevel: 10,
        recordEvents: true,
        partyTurn: policy.drive,
      });
      expect(result.anomalies).toEqual([]);
      expect(result.outcome).not.toBe('stalemate');
      // Format every retained event, including enemy turns, so the bounded
      // state.log cannot hide an earlier malformed line through truncation.
      const lines = result.events.map((event) => describeEvent(CONTENT, initial, event));
      expect(lines.filter((line) => line !== null && typeof line !== 'string')).toEqual([]);
      safeLog(lines.filter((line): line is string => typeof line === 'string'));
      const coverage = policy.coverage();
      // Every technique is actually cast on these boards. No missing-use
      // exemption can turn death, early victory or policy omission into a pass.
      expect(coverage.missing, JSON.stringify(coverage)).toEqual([]);
      expect(coverage.used).toEqual([...build.abilities].sort());
      const actual = new Set(
        result.events.flatMap((event) =>
          event.type === 'abilityUsed' && event.unitId === build.subjectId ? [event.abilityId] : [],
        ),
      );
      for (const id of coverage.used) expect(actual.has(id), id).toBe(true);
      return { result, coverage };
    };
    const first = run();
    expect(first).toEqual(run());
    console.info(
      'discipline-smoke-coverage',
      JSON.stringify({
        build: build.label,
        encounter: encounter.encounterId,
        used: first.coverage.used,
        missing: first.coverage.missing,
        repetitions: 2,
        subjectActivations: first.coverage.subjectActivations,
      }),
    );
  });
});

describe('optional whole-activation party driver', () => {
  it.each(ENCOUNTERS)(
    'invokes the driver and preserves ordinary AI exactly: $encounterId',
    (encounter) => {
      const options = {
        ...encounter,
        seed: `discipline-smoke-driver:${encounter.encounterId}`,
        party: STANDARD_PARTY,
        partyLevel: 10,
        recordEvents: true,
        diagnostics: true,
      };
      let calls = 0;
      const actual = runCombat(CONTENT, {
        ...options,
        partyTurn: (content: ContentIndex, state: GameState, unitId: string): StepResult => {
          calls++;
          expect(activeId(state)).toBe(unitId);
          const actor = state.battle?.units.find((unit) => unit.id === unitId);
          expect(actor?.faction).toBe('party');
          expect(actor && isAlive(actor)).toBe(true);
          return apply(content, state, { type: 'runAiTurn' });
        },
      });
      expect(calls).toBeGreaterThan(0);
      expect(actual).toEqual(runCombat(CONTENT, options));
    },
  );

  it('rejects a driver that leaves its activation unfinished', () => {
    expect(() =>
      runCombat(CONTENT, {
        seed: 'discipline-smoke-unfinished-driver',
        encounterId: 'enc_forest_road',
        variantId: 'thugs',
        party: STANDARD_PARTY,
        partyTurn: (_content: ContentIndex, state: GameState): StepResult => ({
          state,
          events: [],
        }),
      }),
    ).toThrow(/activation|party.*turn|driver/i);
  });
});
