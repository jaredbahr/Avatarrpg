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
import { fxPalette, resolveFx } from '../../content/fx';
import type { EmitterDef, FxRecipe } from '../../content/fx';
import { hashSeed } from '../../render/fx/rng';
import { particleSpan } from '../../render/fx/simulate';
import { smoothPath } from '../../render/geometry/curve';
import { easeInCubic, easeInOutCubic, easeInOutSine, easeOutQuad, stroll } from './easing';
import type { AnyTrack, ClipName } from './timeline';

/** Base durations in milliseconds, before the motion setting is applied. */
export const TIMING = {
  step: 110,
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

  /** One footstep a tile along a walk that starts at `at`. */
  const footsteps = (
    at: number,
    tiles: number,
    eventIndex: number,
    step: number = TIMING.step,
  ): void => {
    if (input.silentSteps) return;
    for (let i = 0; i < tiles; i++) cue('step', at + step * rate * i, 20 + i, eventIndex);
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
        const duration = TIMING.step * event.path.length * rate;
        if (from) {
          tracks.push({
            kind: 'move',
            unitId: event.unitId,
            curve: smoothPath(from, event.path),
            ease: easeInOutCubic,
            start: cursor,
            duration,
          });
        }
        footsteps(cursor, event.path.length, eventIndex);
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
        const duration = TIMING.strollStep * event.path.length * rate;
        tracks.push({
          kind: 'move',
          unitId: event.unitId,
          curve: smoothPath(event.from, event.path),
          ease: stroll,
          start: cursor,
          duration,
        });
        // Only the leader's route is cued: the followers walk the same tiles a
        // beat behind, and four sets of boots on one road is a stampede.
        footsteps(cursor, event.path.length, eventIndex, TIMING.strollStep);
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
        const facing = self ? undefined : facingFor(dir);

        const windUp = TIMING.windUp * rate;
        const release = TIMING.release * rate;
        const recover = TIMING.recover * rate;
        const back = self ? { x: 0, y: -0.06 } : scaled(dir, -LEAN_BACK);
        const forward = self ? { x: 0, y: 0.04 } : scaled(dir, melee ? MELEE_LUNGE : LUNGE);
        const clip: ClipName = melee ? 'melee' : 'cast';

        // The sheet's poses: wind-up, release, recover for a cast; wind-up and
        // strike for a melee, which returns to its guarded wind-up stance.
        pose(event.unitId, clip, cursor, windUp, { x: 0, y: 0 }, back, easeInCubic, {
          ...(facing !== undefined ? { facing } : {}),
          scale: { from: 1, to: 0.985 },
          frame: 0,
        });
        const releaseAt = cursor + windUp;
        pose(event.unitId, clip, releaseAt, release, back, forward, easeOutQuad, {
          ...(facing !== undefined ? { facing } : {}),
          scale: { from: 0.985, to: 1.015 },
          frame: 1,
        });
        // The element gathers through the wind-up and is out of the hands by the release.
        emit(recipe.cast, cursor + windUp * 0.4, caster, target, palette, eventIndex, 1);
        // The voice goes with the release, not the wind-up: it is the sound of
        // the element leaving the hands. `ability.fx` resolves through the same
        // family segment the recipe does, so an element sounds like itself
        // without a row per ability.
        cue(ability.fx, releaseAt, 1, eventIndex);

        let impactAt = releaseAt + release * 0.5;
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
            if (def.kind === 'strokes') return { ...def, duration: nominal * 2 };
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
          emit(stretched, releaseAt, caster, target, palette, eventIndex, 2, recipe.travel.arc);
          impactAt = releaseAt + flight;
        }

        // Keep the extension through flight and impact. Without this track a
        // long throw snaps to idle before its recovery starts.
        const hitStop = recipe.hitStop * rate;
        const recoverAt = Math.max(releaseAt + release, impactAt + hitStop);
        const holdAt = releaseAt + release;
        if (recoverAt > holdAt)
          pose(event.unitId, clip, holdAt, recoverAt - holdAt, forward, forward, easeInOutSine, {
            ...(facing !== undefined ? { facing } : {}),
            scale: { from: 1.015, to: 1.015 },
            frame: 1,
          });
        pose(event.unitId, clip, recoverAt, recover, forward, { x: 0, y: 0 }, easeInOutSine, {
          ...(facing !== undefined ? { facing } : {}),
          scale: { from: 1.015, to: 1 },
          frame: melee ? 0 : 2,
        });

        emit(
          recipe.impact,
          impactAt + hitStop * 0.5,
          target,
          { x: target.x + dir.x, y: target.y + dir.y },
          palette,
          eventIndex,
          3,
        );
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

        pending = { at: impactAt, hitStop, flash: recipe.flash, casterId: event.unitId };
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
          const away = source ? direction(source, centre(pos)) : { x: 0, y: -1 };
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
          const away = attacker ? direction(attacker, centre(pos)) : { x: 0, y: -1 };
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
          tracks.push({
            kind: 'move',
            unitId: event.unitId,
            curve: smoothPath(from, [event.to], 0),
            ease: easeOutQuad,
            start: cursor,
            duration,
          });
          pose(event.unitId, 'hit', cursor, duration, { x: 0, y: 0 }, { x: 0, y: 0 }, easeOutQuad, {
            frame: 0,
          });
          positions.set(event.unitId, event.to);
          cursor += duration;
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
