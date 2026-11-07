import { describe, expect, it, vi } from 'vitest';
import type { Command, ContentIndex, GameEvent, GameState, MapDef } from '../../core/types';
import { CONTENT } from '../../content';
import { RIVERSIDE_ENTRY } from '../../content/maps/riverside';
import { createGame } from '../../core/state/createGame';
import { apply } from '../../core/state/reducer';
import { canUseAbility, knownAbilities, targetableTiles } from '../../core/rules/abilities';
import { App } from '../App';
import { Animator } from '../animator';
import { CombatScene } from './CombatScene';
import { PresentationClock, type CombatSpeed } from './presentationClock';
import { TOPDOWN_PRESENTATION_TIMING } from '../anim/choreography';

interface ReplayResult {
  readonly rate: CombatSpeed;
  readonly skip: boolean;
  readonly commands: readonly Command[];
  readonly events: readonly GameEvent[];
  readonly log: readonly string[];
  readonly rng: GameState['rng'];
  readonly frames: number;
  readonly skips: number;
  readonly enemyGapWallMs: number;
  readonly totalWallMs: number;
  readonly enemyGapWaitShare: number;
  readonly finalPhase: string | undefined;
}

function topdownContent(): ContentIndex {
  const maps = new Map(CONTENT.maps);
  const authored = maps.get('forest_road');
  if (!authored) throw new Error('Missing forest road map.');
  if (!authored.scene) throw new Error('Missing forest road scene.');
  const map: MapDef = {
    ...authored,
    projection: 'topdown',
    scene: {
      ...authored.scene,
      paintExtent: { x: 0, y: 0, width: 20 * 40, height: 12 * 40 },
    },
  };
  maps.set(map.id, map);
  return { ...CONTENT, maps };
}

async function replay(rate: CombatSpeed, skip: boolean): Promise<ReplayResult> {
  let wallNow = 0;
  vi.stubGlobal('performance', { now: () => wallNow });
  const content = topdownContent();
  const fresh = createGame(content, {
    seed: 'issue456-fixed-seed-presentation-replay',
    party: [{ characterId: 'kaya' }, { characterId: 'bo' }, { characterId: 'nima' }],
    startNode: RIVERSIDE_ENTRY,
  });
  const explored = apply(content, fresh, { type: 'enterNode', nodeId: RIVERSIDE_ENTRY }).state;
  const started = apply(content, explored, {
    type: 'startBattle',
    encounterId: 'enc_forest_road',
  }).state;
  if (!started.battle) throw new Error('Fixture battle did not start.');
  // The authored ambush begins outside a level-one Fire Jab's range. This
  // test-only presentation fixture stages the same real reducer roster close
  // enough to land the opening attack without changing any shipped content.
  const initial: GameState = {
    ...started,
    battle: {
      ...started.battle,
      units: started.battle.units.map((unit, index) =>
        unit.faction === 'enemy'
          ? { ...unit, pos: { x: 5 + (index % 2) * 2, y: 3 + Math.floor(index / 2) * 2 } }
          : unit,
      ),
    },
  };

  const app = Object.create(App.prototype) as App;
  const scene = Object.create(CombatScene.prototype) as CombatScene;
  const sceneAnimator = new Animator(content, {
    actionQueue: true,
    motionReduced: () => false,
    timingProfile: TOPDOWN_PRESENTATION_TIMING,
  });
  sceneAnimator.setProjection('topdown');
  Object.assign(scene, {
    app,
    sceneAnimator,
    presentationClock: new PresentationClock(0),
    topdownSoundQueue: [],
    topdownBlowPoints: [],
    topdownBlowEndsAt: 0,
    aiDueAt: null,
    aiDueUnitId: null,
    aiScheduled: false,
    aiTimer: null,
    suspended: false,
    aiHeld: false,
    presentationHeld: false,
    paintingStill: false,
    battleOpening: null,
    frame: 0,
  });
  const commands: Command[] = [];
  const events: GameEvent[] = [];
  const appLike = app as unknown as Record<string, unknown>;
  Object.assign(appLike, {
    state: initial,
    content,
    scene,
    animator: { push: vi.fn(), busy: () => false, finishesAt: 0, clear: vi.fn() },
    audio: { play: vi.fn(), close: vi.fn(), unlock: vi.fn() },
    routeTimer: null,
    cancelRoute: vi.fn(),
    announceImportant: vi.fn(),
    offerLevelUpIfPending: vi.fn(),
    autosaveIfWorthIt: vi.fn(),
    routeToState: () => {
      (scene as unknown as { maybeRunAi: () => void }).maybeRunAi();
    },
  });
  const dispatch = (command: Command): readonly GameEvent[] => {
    commands.push(command);
    const produced = App.prototype.dispatch.call(app, command);
    events.push(...produced);
    return produced;
  };
  appLike.dispatch = dispatch;
  const clock = (scene as unknown as { presentationClock: PresentationClock }).presentationClock;
  clock.setRate(rate, wallNow);
  const sceneMethods = scene as unknown as {
    maybeRunAi: () => void;
    advanceTopdownAi: (now: number) => void;
    skipPresentation: () => void;
  };
  sceneMethods.maybeRunAi();
  let enemyGapWallMs = 0;
  let skips = 0;
  let frames = 0;

  while (frames < 40_000) {
    const state = (app as unknown as { state: GameState }).state;
    const battle = state.battle;
    if (!battle || battle.phase !== 'active') break;
    const active = battle.units.find((unit) => unit.id === battle.order[battle.turnIndex]);
    if (!active) throw new Error('Fixture has no active turn unit.');
    const animator = (scene as unknown as { sceneAnimator: Animator }).sceneAnimator;
    const currentNow = clock.now(wallNow);
    const actorEnd = animator.actorFinishesAt(active.id);
    if (
      active.faction === 'party' &&
      (animator.actionBusy(currentNow) || actorEnd > currentNow)
    ) {
      wallNow += 16;
      frames += 1;
      if (skip && (animator.actionBusy(clock.now(wallNow)) || actorEnd > clock.now(wallNow))) {
        sceneMethods.skipPresentation();
        skips += 1;
      }
      sceneMethods.advanceTopdownAi(clock.now(wallNow));
      await Promise.resolve();
      continue;
    }
    if (active.faction === 'party') {
      const target = battle.units.find((unit) => unit.faction === 'enemy' && unit.hp > 0);
      const attack = target
        ? knownAbilities(content, active).find(
            (ability) =>
              ability.effects.some((effect) => effect.kind === 'damage') &&
              canUseAbility(content, active, ability).ok &&
              targetableTiles(content, battle, active, ability).some(
                (tile) => tile.x === target.pos.x && tile.y === target.pos.y,
              ),
          )
        : undefined;
      if (attack && target)
        dispatch({ type: 'useAbility', unitId: active.id, abilityId: attack.id, target: target.pos });
      else dispatch({ type: 'endTurn', unitId: active.id });
      await Promise.resolve();
    } else {
      wallNow += 16;
      frames += 1;
      let now = clock.now(wallNow);
      const actorDoneAt = animator.actorFinishesAt(active.id);
      if (skip && (animator.actionBusy(now) || actorDoneAt > now)) {
        sceneMethods.skipPresentation();
        skips += 1;
        now = clock.now(wallNow);
      }
      const due = (scene as unknown as { aiDueAt: number | null }).aiDueAt;
      const actionStart = Math.max(animator.actionReadyAt, animator.actorFinishesAt(active.id));
      if (due !== null && now >= actionStart && now < due) enemyGapWallMs += 16;
      sceneMethods.advanceTopdownAi(clock.now(wallNow));
      await Promise.resolve();
      const afterBattle = (app as unknown as { state: GameState }).state.battle;
      if (afterBattle?.phase !== 'active') break;
    }
  }

  const resultState = (app as unknown as { state: GameState }).state;
  const result: ReplayResult = {
    rate,
    skip,
    commands,
    events,
    log: resultState.log,
    rng: resultState.rng,
    frames,
    skips,
    enemyGapWallMs,
    totalWallMs: wallNow,
    enemyGapWaitShare: wallNow > 0 ? enemyGapWallMs / wallNow : 0,
    finalPhase: resultState.battle?.phase,
  };
  vi.unstubAllGlobals();
  return result;
}

describe('top-down presentation replay', () => {
  it('keeps the real App/scene command and RNG stream identical at every speed and skip setting', async () => {
    const baseline = await replay(1, false);
    const accelerated = await replay(2, false);
    const fastest = await replay(3, false);
    const skipped1 = await replay(1, true);
    const skipped2 = await replay(2, true);
    const skipped3 = await replay(3, true);

    const all = [baseline, accelerated, fastest, skipped1, skipped2, skipped3];
    for (const result of all.slice(1)) {
      expect(result.commands).toEqual(baseline.commands);
      expect(result.events).toEqual(baseline.events);
      expect(result.log).toEqual(baseline.log);
      expect(result.rng).toEqual(baseline.rng);
    }
    expect(baseline.commands.some((command) => command.type === 'runAiTurn')).toBe(true);
    expect(baseline.events.some((event) => event.type === 'abilityUsed')).toBe(true);
    expect(skipped1.skips).toBeGreaterThan(0);
    expect(skipped2.skips).toBeGreaterThan(0);
    expect(skipped3.skips).toBeGreaterThan(0);
    expect(all.every((result) => result.finalPhase !== 'active')).toBe(true);
    expect(all.every((result) => result.enemyGapWallMs > 0)).toBe(true);
    expect(baseline.enemyGapWallMs).toBeGreaterThan(0);
    expect(baseline.enemyGapWaitShare).toBeGreaterThan(0);
    expect(baseline.enemyGapWaitShare).toBeLessThan(1);
    expect(baseline.frames).toBeGreaterThan(0);
    expect(baseline.finalPhase).not.toBe('active');
    for (const result of all)
      console.info(
        `[topdown-replay] rate=${result.rate} skip=${result.skip} totalWallMs=${result.totalWallMs} enemyGapWaitMs=${result.enemyGapWallMs} enemyGapWaitShare=${result.enemyGapWaitShare.toFixed(3)} commands=${result.commands.length} events=${result.events.length} phase=${result.finalPhase}`,
      );
  });
});
