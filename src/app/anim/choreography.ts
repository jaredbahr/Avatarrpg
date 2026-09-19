/**
 * Events to tracks.
 *
 * The reducer says what happened; this decides how it plays: a caster winds
 * up and lunges, something travels, it lands with a flash and a held frame,
 * the ground answers, the number pops. Every duration is a constant here so
 * a change to the feel is one edit, and everything is a pure function of the
 * events, the roster before them and the clock, so a fight replays the same
 * way twice and the tests can ask for exact times.
 *
 * Which element an effect is, and what its particles look like, is content
 * (`src/content/fx.ts`). This file only knows *when*.
 */

import type { ContentIndex, GameEvent, Unit, Vec2 } from '../../core/types';
import { fxPalette, resolveFx, WATERSKIN_DRAW } from '../../content/fx';
import type { EmitterDef, FxRecipe } from '../../content/fx';
import { hashSeed } from '../../render/fx/rng';
import { particleSpan } from '../../render/fx/simulate';
import { smoothPath } from '../../render/geometry/curve';
import { easeInOutSine, easeOutQuad } from './easing';
import { strollTiming } from './stroll';
import type { AnyTrack, ClipName } from './timeline';
import { attackMotion } from './attackMotion';
import { screenDirection, screenMeleeDirection } from './direction';
import type { MeleeDirection } from '../../content/assets/clips';
import type { Projection } from '../../render/projection';
import type { ActorAttachment, EmitterAttachments } from '../../render/view';
import { partyScale } from './actorScale';

/** Base durations in milliseconds, before the motion setting is applied. */
export const TIMING = {
  step: 110,
  combatWalkStep: 280,
  strollStep: 280,
  windUp: 260,
  release: 120,
  recover: 280,
  floater: 900,
  gap: 60,
  recoilOut: 70,
  recoilBack: 140,
  ko: 420,
  shake: 240,
  flash: 90,
  /** Per ring of Chebyshev distance from the target, for area effects. */
  areaStagger: 40,
  travelMin: 100,
  travelMax: 600,
} as const;

/** Distances in tiles. */
const LEAN_BACK = 0.12;
const LUNGE = 0.24;
const MELEE_LUNGE = 0.42;
const RECOIL = 0.18;
const DODGE = 0.2;

export interface ChoreographyInput {
  readonly projection?: Projection;
  readonly content: ContentIndex;
  readonly events: readonly GameEvent[];
  readonly unitsBefore: readonly Unit[];
  /** Where playback starts, on the animator's clock. */
  readonly cursor: number;
  /** 1, or 0.02 under reduce motion. */
  readonly rate: number;
  /** Which push this is, so seeds never repeat across a fight. */
  readonly pushIndex: number;
  /** Followers share the leader's footfalls rather than multiplying the sound. */
  readonly silentSteps?: boolean;
}

/**
 * A sound to play at a moment on the animator's clock.
 *
 * Cues are not tracks. A track is sampled every frame and pruned when it ends;
 * a sound is an instant, and Web Audio schedules an instant far better than a
 * frame loop can — hand it a time and the audio thread hits it whatever the
 * renderer is doing. So the cues travel beside the tracks, the bus schedules
 * them ahead on its own clock, and `busy()` and `finishesAt` keep meaning
 * exactly what they meant (ADR 0004, ADR 0012).
 */
export interface SoundCue {
  /** A key `resolveSound` understands: an fx key, or one of the named cues. */
  readonly key: string;
  /** When, on the animator's clock. */
  readonly at: number;
  /** Picks between a cue's variants, so a row of footsteps does not repeat. */
  readonly seed: number;
}

export interface Choreography {
  readonly tracks: readonly AnyTrack[];
  /** What to play and when. Presentation only; nothing reads it back. */
  readonly sounds: readonly SoundCue[];
  /** Where the next push starts. */
  readonly cursor: number;
}

/** A hit that has been aimed but whose damage events are still to come. */
interface PendingHit {
  readonly at: number;
  readonly hitStop: number;
  readonly flash: number;
  readonly casterId: string;
  readonly pushIds?: readonly string[];
}

const centre = (p: Vec2): Vec2 => ({ x: p.x + 0.5, y: p.y + 0.5 });

function direction(from: Vec2, to: Vec2): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  return len === 0 ? { x: 1, y: 0 } : { x: dx / len, y: dy / len };
}

const scaled = (v: Vec2, k: number): Vec2 => ({ x: v.x * k, y: v.y * k });

function facingFor(dir: Vec2): 1 | -1 | undefined {
  if (dir.x > 0.2) return 1;
  if (dir.x < -0.2) return -1;
  return undefined;
}

const chebyshev = (a: Vec2, b: Vec2): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export function choreograph(input: ChoreographyInput): Choreography {
  const { content, events, unitsBefore, rate, pushIndex } = input;
  const tracks: AnyTrack[] = [];
  const sounds: SoundCue[] = [];
  let cursor = input.cursor;

  const positions = new Map<string, Vec2>();
  const sizes = new Map<string, number>();
  for (const unit of unitsBefore) {
    positions.set(unit.id, unit.pos);
    sizes.set(unit.id, unit.size);
  }
  /** Draw centre of a unit, allowing for the two-tile boss. */
  const unitCentre = (id: string): Vec2 | undefined => {
    const pos = positions.get(id);
    if (!pos) return undefined;
    const size = sizes.get(id) ?? 1;
    return { x: pos.x + size / 2, y: pos.y + 0.5 };
  };

  let pending: PendingHit | null = null;

  const emit = (
    defs: readonly EmitterDef[],
    at: number,
    from: Vec2,
    to: Vec2,
    palette: string,
    eventIndex: number,
    slot: number,
    arc = 0,
    attachments?: EmitterAttachments,
  ): void => {
    // Reduce motion collapses playback to a frame; particles would be a smear.
    if (rate < 1) return;
    defs.forEach((def, i) => {
      const duration = def.kind === 'particles' ? particleSpan(def) : def.duration;
      tracks.push({
        kind: 'emitter',
        def,
        from,
        to,
        seed: hashSeed(pushIndex, eventIndex, slot, i),
        palette,
        arc,
        ...(attachments ? { attachments } : {}),
        start: at,
        duration,
      });
    });
  };

  const effect = (key: string): { recipe: FxRecipe; palette: string } => {
    const recipe = resolveFx(key);
    return { recipe, palette: fxPalette(key, recipe) };
  };

  const pose = (
    unitId: string,
    clip: ClipName,
    start: number,
    duration: number,
    from: Vec2,
    to: Vec2,
    ease: (t: number) => number,
    extra: {
      facing?: 1 | -1;
      scale?: { from: number; to: number };
      alpha?: { from: number; to: number };
      frame?: number;
      meleeDirection?: MeleeDirection;
    } = {},
  ): void => {
    tracks.push({
      kind: 'pose',
      unitId,
      clip,
      start,
      duration,
      offset: { from, to },
      ease,
      ...(extra.facing !== undefined ? { facing: extra.facing } : {}),
      ...(extra.scale ? { scale: extra.scale } : {}),
      ...(extra.alpha ? { alpha: extra.alpha } : {}),
      ...(extra.frame !== undefined ? { frame: extra.frame } : {}),
      ...(extra.meleeDirection ? { meleeDirection: extra.meleeDirection } : {}),
    });
  };

  const floater = (pos: Vec2, text: string, color: string, at: number): void => {
    tracks.push({ kind: 'floater', pos, text, color, start: at, duration: TIMING.floater * rate });
  };

  /**
   * A sound at a moment. Always emitted, even under reduce motion, which
   * collapses the clock and would otherwise turn a fight silent; the bus
   * coalesces cues of one key that land together, which is what keeps a
   * collapsed round — and a blast over twenty-five tiles — from machine-gunning.
   */
  const cue = (key: string, at: number, slot: number, eventIndex: number): void => {
    sounds.push({ key, at, seed: hashSeed(pushIndex, eventIndex, slot, 0) });
  };

  /** A hit's timing: the aimed one if it is still fresh, else now. */
  const landing = (): { at: number; hitStop: number; flash: number } =>
    pending
      ? { at: pending.at, hitStop: pending.hitStop, flash: pending.flash }
      : { at: cursor, hitStop: 0, flash: 0.6 };

  events.forEach((event, eventIndex) => {
    switch (event.type) {
      case 'unitMoved': {
        if (event.path.length === 0) break;
        const from = positions.get(event.unitId) ?? event.path[0];
        if (!from) break;
        const curve = smoothPath(from, event.path);
        const timing = strollTiming(curve.length, TIMING.combatWalkStep);
        // Reduced motion retains its existing abbreviated action lock.
        const duration = (rate < 1 ? TIMING.step * event.path.length : timing.duration) * rate;
        tracks.push({
          kind: 'move',
          unitId: event.unitId,
          curve,
          ease: timing.ease,
          start: cursor,
          duration,
        });
        if (!input.silentSteps)
          for (let d = 0; d < curve.length; d++)
            cue(
              'step',
              cursor + (timing.atDistance(d) / timing.duration) * duration,
              20 + d,
              eventIndex,
            );
        const last = event.path[event.path.length - 1];
        if (last) positions.set(event.unitId, last);
        cursor += duration;
        pending = null;
        break;
      }

      case 'partyWalked': {
        // The village walk: the leader's route from where it stood. The
        // followers are the scene's, pushed onto the same timeline.
        if (event.path.length === 0) break;
        const curve = smoothPath(event.from, event.path);
        const timing = strollTiming(curve.length, TIMING.strollStep);
        const duration = timing.duration * rate;
        tracks.push({
          kind: 'move',
          unitId: event.unitId,
          curve,
          ease: timing.ease,
          start: cursor,
          duration,
        });
        // Only the leader's route is cued: the followers walk the same tiles a
        // beat behind, and four sets of boots on one road is a stampede.
        if (!input.silentSteps)
          for (let d = 0; d < curve.length; d++)
            cue('step', cursor + timing.atDistance(d) * rate, 20 + d, eventIndex);
        const last = event.path[event.path.length - 1];
        if (last) positions.set(event.unitId, last);
        cursor += duration;
        pending = null;
        break;
      }

      case 'abilityUsed': {
        const ability = content.abilities.get(event.abilityId);
        const casterPos = positions.get(event.unitId);
        const caster = unitCentre(event.unitId);
        if (!ability || !casterPos || !caster) {
          cursor += TIMING.gap * rate;
          break;
        }
        const { recipe, palette } = effect(ability.fx);
        const target = centre(event.target);
        const dir = direction(caster, target);
        const self =
          ability.targeting.shape === 'self' ||
          (event.target.x === casterPos.x && event.target.y === casterPos.y);
        const melee = ability.range <= 1 && ability.targeting.shape === 'unit';
        const screenDir = screenDirection(dir, input.projection ?? 'orthographic');
        const meleeDirection = melee ? screenMeleeDirection(screenDir) : undefined;
        const attached = ['fire_jab', 'water_whip', 'air_blast'].includes(ability.id);
        const rock = ability.id === 'rock_throw';
        const strike = ability.id === 'strike';
        const facing = self
          ? undefined
          : attached || rock || strike
            ? screenDir.x < 0
              ? -1
              : 1
            : facingFor(screenDir);

        const motion = attackMotion(ability.fx, melee, self);
        const windUp = TIMING.windUp * motion.windUp * rate;
        const release = TIMING.release * motion.release * rate;
        const recover = TIMING.recover * motion.recover * rate;
        const back = self ? { x: 0, y: -0.06 } : scaled(screenDir, -LEAN_BACK);
        const forward = self
          ? { x: 0, y: 0.04 }
          : scaled(screenDir, melee ? MELEE_LUNGE : LUNGE * motion.reach);
        const clip: ClipName = melee ? 'melee' : 'cast';
        // These directed fundamentals have calibrated cast palms. Earth,
        // area and surface techniques retain their separate ground contract.
        const casterUnit = unitsBefore.find((unit) => unit.id === event.unitId);
        const victim = unitsBefore.find((unit) => {
          if (unit.hp <= 0) return false;
          const pos = positions.get(unit.id) ?? unit.pos;
          return (
            event.target.y === pos.y &&
            event.target.x >= pos.x &&
            event.target.x < pos.x + unit.size
          );
        });
        const snapshot = (
          unit: Unit | undefined,
          socket: ActorAttachment['socket'],
          offset: Vec2 = { x: 0, y: 0 },
          poseScale = 1,
          poseFacing?: 1 | -1,
        ): ActorAttachment | undefined =>
          unit
            ? {
                pos: { ...(positions.get(unit.id) ?? unit.pos) },
                sprite: unit.sprite,
                size: unit.size,
                socket,
                facing: poseFacing ?? (unit.faction === 'enemy' ? -1 : 1),
                scale:
                  unit.faction === 'party' ? partyScale(input.projection, poseScale) : poseScale,
                offset,
              }
            : undefined;
        const torso = attached || rock || strike ? snapshot(victim, 'torso') : undefined;
        const gatherT = motion.gatherEase(0.4);
        const gather = attached
          ? snapshot(
              casterUnit,
              'cast-gather',
              scaled(back, gatherT),
              1 + (motion.compression - 1) * gatherT,
              facing ?? (screenDir.x < 0 ? -1 : 1),
            )
          : undefined;

        // The sheet's poses: wind-up, release, recover for a cast; wind-up and
        // strike for a melee, which returns to its guarded wind-up stance.
        pose(event.unitId, clip, cursor, windUp, { x: 0, y: 0 }, back, motion.gatherEase, {
          ...(facing !== undefined ? { facing } : {}),
          scale: { from: 1, to: motion.compression },
          frame: 0,
          ...(meleeDirection ? { meleeDirection } : {}),
        });
        const releaseAt = cursor + windUp;
        pose(event.unitId, clip, releaseAt, release, back, forward, motion.releaseEase, {
          ...(facing !== undefined ? { facing } : {}),
          scale: { from: motion.compression, to: motion.extension },
          frame: 1,
          ...(meleeDirection ? { meleeDirection } : {}),
        });
        // The element gathers through the wind-up and is out of the hands by the release.
        const gatherSpan = windUp * 0.6;
        const castEmitters = attached
          ? recipe.cast.map((def): EmitterDef =>
              def.kind === 'particles'
                ? {
                    ...def,
                    duration: Math.min(def.duration, gatherSpan),
                    delay: [0, 0],
                    life: [gatherSpan, gatherSpan],
                  }
                : { ...def, duration: Math.min(def.duration, gatherSpan) },
            )
          : recipe.cast;
        emit(
          castEmitters,
          cursor + windUp * 0.4,
          caster,
          target,
          palette,
          eventIndex,
          1,
          0,
          gather ? { from: gather, ...(torso ? { to: torso } : {}) } : undefined,
        );
        // The voice goes with the release, not the wind-up: it is the sound of
        // the element leaving the hands. `ability.fx` resolves through the same
        // family segment the recipe does, so an element sounds like itself
        // without a row per ability.
        // Let the weight transfer lead the element; the sound and projectile
        // leave together once the striking pose has begun its extension.
        const launchAt = releaseAt + release * motion.launch;
        const launchT = motion.releaseEase(motion.launch);
        const hand =
          attached || rock
            ? snapshot(
                casterUnit,
                'cast-release',
                {
                  x: back.x + (forward.x - back.x) * launchT,
                  y: back.y + (forward.y - back.y) * launchT,
                },
                motion.compression + (motion.extension - motion.compression) * launchT,
                facing ?? (screenDir.x < 0 ? -1 : 1),
              )
            : undefined;
        if (ability.id === 'water_whip' && casterUnit?.sprite === 'unit.water.sura' && gather) {
          const source = { ...gather, socket: 'waterskin' as const };
          emit(
            [
              { ...WATERSKIN_DRAW, duration: gatherSpan, life: [gatherSpan, gatherSpan] },
              {
                ...WATERSKIN_DRAW,
                shape: 'stream',
                count: 7,
                duration: gatherSpan,
                delay: [0, gatherSpan * 0.7],
                life: [gatherSpan * 0.3, gatherSpan * 0.3],
                size: [0.06, 0.09],
                color: 'light',
              },
            ],
            cursor + windUp * 0.4,
            caster,
            caster,
            palette,
            eventIndex,
            11,
            0,
            { from: source, to: gather },
          );
        }
        if (rock && hand) {
          const liftStart = cursor + windUp * 0.4;
          const lift = launchAt - liftStart;
          const stones =
            recipe.travel?.emitters.filter(
              (def) => def.kind === 'particles' && def.cel === 'boulder',
            ) ?? [];
          emit(
            stones.map((def) =>
              def.kind === 'particles'
                ? { ...def, duration: lift, life: [lift, lift], delay: [0, 0] }
                : def,
            ),
            liftStart,
            caster,
            caster,
            palette,
            eventIndex,
            12,
            0,
            { from: snapshot(casterUnit, 'ground'), to: hand },
          );
        }
        cue(ability.fx, launchAt, 1, eventIndex);

        let impactAt = releaseAt + release * 0.5;
        let returnAt = releaseAt + release;
        if (recipe.travel && !self) {
          const distance = Math.hypot(target.x - caster.x, target.y - caster.y);
          const flight =
            Math.max(
              TIMING.travelMin,
              Math.min(TIMING.travelMax, (distance / recipe.travel.speed) * 1000),
            ) * rate;
          // Travel emitters are authored for a nominal flight; stretch them to
          // the real one. A particle emitter spawns across the whole flight and
          // a head lives exactly as long as it; a stroke goes out and comes
          // back, so it lasts twice the flight and a whip reaches the target
          // as the hit lands.
          const nominal = Math.max(40, Math.round(flight / rate));
          const stretched = recipe.travel.emitters.map((def): EmitterDef => {
            if (def.kind === 'strokes')
              return {
                ...def,
                duration: nominal * (def.shape === 'gust' || def.shape === 'flame' ? 1 : 2),
              };
            const k = nominal / def.duration;
            return {
              ...def,
              duration: nominal,
              delay: [def.delay[0] * k, def.delay[1] * k],
              ...(def.shape === 'projectile'
                ? { life: [nominal, nominal] as [number, number] }
                : {}),
            };
          });
          emit(
            stretched,
            launchAt,
            caster,
            target,
            palette,
            eventIndex,
            2,
            recipe.travel.arc,
            hand ? { from: hand, ...(torso ? { to: torso } : {}) } : undefined,
          );
          impactAt = launchAt + flight;
          // Water Whip remains tethered on its return. Keep the striking palm
          // out until that stroke has reeled in, rather than idling underneath it.
          if (ability.id === 'water_whip')
            for (const def of stretched)
              if (def.kind === 'strokes' && def.shape === 'whip')
                returnAt = Math.max(returnAt, launchAt + def.duration * rate);
        }

        // Keep the extension through flight and impact. Without this track a
        // long throw snaps to idle before its recovery starts.
        const hitStop = recipe.hitStop * rate;
        const recoverAt = Math.max(returnAt, impactAt + hitStop);
        const holdAt = releaseAt + release;
        if (recoverAt > holdAt)
          pose(event.unitId, clip, holdAt, recoverAt - holdAt, forward, forward, easeInOutSine, {
            ...(facing !== undefined ? { facing } : {}),
            scale: { from: motion.extension, to: motion.extension },
            frame: 1,
            ...(meleeDirection ? { meleeDirection } : {}),
          });
        pose(event.unitId, clip, recoverAt, recover, forward, { x: 0, y: 0 }, easeInOutSine, {
          ...(facing !== undefined ? { facing } : {}),
          scale: { from: motion.extension, to: 1 },
          frame: melee ? 0 : 2,
          ...(meleeDirection ? { meleeDirection } : {}),
        });

        // Contact fragments belong to the body; dust, cracks and rising earth
        // still mark the struck ground. Do not lift the whole material recipe.
        const bodily = (def: EmitterDef) =>
          (!rock && !strike) ||
          (def.kind === 'particles' &&
            (rock ? def.cell === 'shard' : def.cell === 'spark' || def.cell === 'ring'));
        for (const contact of [true, false]) {
          const defs = recipe.impact.filter((def) => bodily(def) === contact);
          emit(
            defs,
            impactAt + hitStop * 0.5,
            target,
            { x: target.x + dir.x, y: target.y + dir.y },
            palette,
            eventIndex,
            contact ? 3 : 13,
            0,
            contact && torso ? { from: torso, translateTogether: true } : undefined,
          );
        }
        if (recipe.area.length > 0) {
          event.tiles.slice(0, 24).forEach((tile, i) => {
            const at =
              impactAt + hitStop * 0.5 + chebyshev(tile, event.target) * TIMING.areaStagger * rate;
            emit(
              recipe.area,
              at,
              centre(tile),
              { x: centre(tile).x + dir.x, y: centre(tile).y + dir.y },
              palette,
              eventIndex,
              100 + i,
            );
          });
        }
        if (recipe.shake > 0 && rate >= 1) {
          tracks.push({
            kind: 'shake',
            amplitude: recipe.shake,
            seed: hashSeed(pushIndex, eventIndex, 7),
            start: impactAt,
            duration: TIMING.shake,
          });
        }

        const pushIds: string[] = [];
        if (ability.id === 'air_blast') {
          for (const next of events.slice(eventIndex + 1)) {
            if (
              next.type === 'unitMoved' ||
              next.type === 'partyWalked' ||
              next.type === 'abilityUsed' ||
              next.type === 'turnEnded' ||
              next.type === 'turnStarted'
            )
              break;
            if (next.type === 'unitPushed') pushIds.push(next.unitId);
          }
        }
        pending = {
          at: impactAt,
          hitStop,
          flash: recipe.flash,
          casterId: event.unitId,
          ...(pushIds.length ? { pushIds } : {}),
        };
        cursor = Math.max(recoverAt + recover, impactAt + hitStop) + TIMING.gap * rate;
        break;
      }

      case 'damaged': {
        const pos = positions.get(event.unitId);
        const hit = landing();
        // The blow landing, under whatever voice threw it. `landing()` is the
        // aimed moment when a projectile is in flight, so the sound arrives
        // with the projectile rather than with the command.
        cue('hit', hit.at, 5, eventIndex);
        if (pos && hit.flash > 0) {
          tracks.push({
            kind: 'flash',
            unitId: event.unitId,
            strength: event.crit ? Math.min(1, hit.flash + 0.3) : hit.flash,
            start: hit.at,
            duration: (TIMING.flash + hit.hitStop) * (rate < 1 ? rate : 1),
          });
        }
        if (pos) {
          const source = pending
            ? unitCentre(pending.casterId)
            : event.sourceId
              ? unitCentre(event.sourceId)
              : undefined;
          const away = source
            ? screenDirection(direction(source, centre(pos)), input.projection ?? 'orthographic')
            : { x: 0, y: -1 };
          const out = scaled(away, RECOIL * (event.crit ? 1.5 : 1));
          const recoilAt = hit.at + hit.hitStop;
          // Hold the struck drawing at contact, then let the body recoil.
          // Waiting until recoil left the victim idling through the hit-stop.
          if (hit.hitStop > 0)
            pose(
              event.unitId,
              'hit',
              hit.at,
              hit.hitStop,
              { x: 0, y: 0 },
              { x: 0, y: 0 },
              easeOutQuad,
              {
                frame: 0,
              },
            );
          if (!pending?.pushIds?.includes(event.unitId)) {
            pose(
              event.unitId,
              'hit',
              recoilAt,
              TIMING.recoilOut * rate,
              { x: 0, y: 0 },
              out,
              easeOutQuad,
              { frame: 0 },
            );
            pose(
              event.unitId,
              'hit',
              recoilAt + TIMING.recoilOut * rate,
              TIMING.recoilBack * rate,
              out,
              { x: 0, y: 0 },
              easeInOutSine,
              { frame: 0 },
            );
          }
          floater(
            pos,
            event.crit ? `${event.amount}!` : String(event.amount),
            event.crit ? '#ffd98a' : '#ff9d8d',
            recoilAt + 30 * rate,
          );
        }
        cursor = Math.max(cursor, hit.at + hit.hitStop) + TIMING.gap * rate;
        break;
      }

      case 'healed': {
        const pos = positions.get(event.unitId);
        const at = landing().at;
        cue('heal', at, 6, eventIndex);
        if (pos) {
          const { recipe, palette } = effect('fx.heal.pulse');
          emit(recipe.impact, at, centre(pos), centre(pos), palette, eventIndex, 4);
          floater(pos, `+${event.amount}`, '#8fe39b', at + 30 * rate);
        }
        cursor = Math.max(cursor, at) + TIMING.gap * rate;
        break;
      }

      case 'attackMissed': {
        const pos = positions.get(event.targetId);
        const attacker = unitCentre(event.unitId);
        const at = landing().at;
        cue('miss', at, 7, eventIndex);
        if (pos) {
          const away = attacker
            ? screenDirection(direction(attacker, centre(pos)), input.projection ?? 'orthographic')
            : { x: 0, y: -1 };
          const out = scaled(away, DODGE);
          pose(
            event.targetId,
            'idle',
            at,
            TIMING.recoilOut * rate,
            { x: 0, y: 0 },
            out,
            easeOutQuad,
          );
          pose(
            event.targetId,
            'idle',
            at + TIMING.recoilOut * rate,
            TIMING.recoilBack * rate,
            out,
            { x: 0, y: 0 },
            easeInOutSine,
          );
          floater(pos, 'miss', '#cfc3ae', at + 30 * rate);
        }
        cursor = Math.max(cursor, at) + TIMING.gap * rate;
        break;
      }

      case 'unitPushed': {
        const from = positions.get(event.unitId);
        if (from) {
          const duration = TIMING.step * 2 * rate;
          const start = pending?.pushIds?.includes(event.unitId)
            ? pending.at + pending.hitStop
            : cursor;
          tracks.push({
            kind: 'move',
            unitId: event.unitId,
            curve: smoothPath(from, [event.to], 0),
            gait: 'slide',
            ease: easeOutQuad,
            start,
            duration,
          });
          pose(event.unitId, 'hit', start, duration, { x: 0, y: 0 }, { x: 0, y: 0 }, easeOutQuad, {
            frame: 0,
          });
          positions.set(event.unitId, event.to);
          cursor = Math.max(cursor, start + duration);
        }
        break;
      }

      case 'unitDied': {
        const pos = positions.get(event.unitId);
        const at = Math.max(cursor, landing().at + landing().hitStop);
        cue('ko', at, 8, eventIndex);
        if (pos) {
          const duration = TIMING.ko * rate;
          pose(event.unitId, 'ko', at, duration, { x: 0, y: 0 }, { x: 0, y: 0.08 }, easeOutQuad, {
            alpha: { from: 1, to: 0.35 },
            frame: 0,
          });
          const { recipe, palette } = effect('fx.ko.fall');
          emit(
            recipe.impact,
            at + duration * 0.4,
            centre(pos),
            centre(pos),
            palette,
            eventIndex,
            5,
          );
          floater(pos, 'down', '#e2584a', at + duration * 0.3);
        }
        cursor = at + TIMING.gap * 2 * rate;
        break;
      }

      case 'statusApplied': {
        const pos = positions.get(event.unitId);
        if (pos) {
          const { recipe, palette } = effect(`fx.status.${event.status}`);
          emit(
            recipe.impact,
            Math.max(cursor, landing().at),
            centre(pos),
            centre(pos),
            palette,
            eventIndex,
            6,
          );
        }
        break;
      }

      case 'surfaceChanged': {
        const key = event.to ? `fx.surface.${event.to}` : 'fx.surface.doused';
        const { recipe, palette } = effect(key);
        emit(
          recipe.impact,
          Math.max(cursor, landing().at),
          centre(event.pos),
          centre(event.pos),
          palette,
          eventIndex,
          8,
        );
        break;
      }

      case 'propDamaged': {
        const { recipe, palette } = effect('fx.prop.hit');
        cue('prop', Math.max(cursor, landing().at), 9, eventIndex);
        emit(
          recipe.impact.slice(0, 1),
          Math.max(cursor, landing().at),
          centre(event.pos),
          centre(event.pos),
          palette,
          eventIndex,
          9,
        );
        break;
      }

      case 'propDestroyed': {
        const { recipe, palette } = effect(`fx.prop.${event.propId}`);
        const at = Math.max(cursor, landing().at);
        cue('propBroke', at, 10, eventIndex);
        emit(recipe.impact, at, centre(event.pos), centre(event.pos), palette, eventIndex, 10);
        if (recipe.shake > 0 && rate >= 1) {
          tracks.push({
            kind: 'shake',
            amplitude: recipe.shake,
            seed: hashSeed(pushIndex, eventIndex, 11),
            start: at,
            duration: TIMING.shake,
          });
        }
        cursor = at + TIMING.gap * rate;
        break;
      }

      case 'turnStarted':
      case 'turnEnded':
      case 'roundStarted':
        pending = null;
        break;

      default:
        break;
    }
  });

  sounds.sort((a, b) => a.at - b.at);
  return { tracks, sounds, cursor };
}
