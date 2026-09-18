/**
 * Typed tracks on one clock.
 *
 * A track is a thing that happens between `start` and `start + duration`:
 * a unit walking a curve, a pose it strikes, a flash on a hit, an emitter
 * throwing particles, a number floating up, the camera shaking. The
 * choreography lays them out; the animator samples them per frame. Nothing
 * here knows about a canvas, so it runs in Node for the tests.
 */

import type { Vec2 } from '../../core/types';
import type { EmitterDef } from '../../content/fx';
import type { Curve } from '../../render/geometry/curve';
import type { ClipName } from '../../render/view';
import type { Easing } from './easing';

export type { ClipName };

export interface Track {
  readonly start: number;
  readonly duration: number;
}

export interface MoveTrack extends Track {
  readonly kind: 'move';
  readonly unitId: string;
  /** The route, smoothed through the tile centres, sampled by arc length. */
  readonly curve: Curve;
  readonly ease: Easing;
  /** Forced displacement keeps the struck stance instead of walking/turning. */
  readonly gait?: 'slide';
}

export interface PoseTrack extends Track {
  readonly kind: 'pose';
  readonly unitId: string;
  readonly clip: ClipName;
  /** Draw offset in tiles, eased from one to the other over the track. */
  readonly offset: { readonly from: Vec2; readonly to: Vec2 };
  readonly scale?: { readonly from: number; readonly to: number };
  readonly alpha?: { readonly from: number; readonly to: number };
  readonly ease: Easing;
  /** Turn the sprite for the duration, e.g. to face a target. */
  readonly facing?: 1 | -1;
  /** The clip's frame this track shows, when the choreography knows it (a wind-up is frame 0). */
  readonly frame?: number;
}

export interface FlashTrack extends Track {
  readonly kind: 'flash';
  readonly unitId: string;
  /** 0..1 at the start, fading to nothing. */
  readonly strength: number;
}

export interface EmitterTrack extends Track {
  readonly kind: 'emitter';
  readonly def: EmitterDef;
  /** Tile centres. */
  readonly from: Vec2;
  readonly to: Vec2;
  readonly seed: number;
  /** Palette key the colour roles resolve through. */
  readonly palette: string;
  /** Lob height in tiles for a projectile flight. */
  readonly arc: number;
}

export interface FloaterTrack extends Track {
  readonly kind: 'floater';
  readonly pos: Vec2;
  readonly text: string;
  readonly color: string;
}

export interface ShakeTrack extends Track {
  readonly kind: 'shake';
  /** Peak displacement in tiles. */
  readonly amplitude: number;
  readonly seed: number;
}

export type AnyTrack =
  MoveTrack | PoseTrack | FlashTrack | EmitterTrack | FloaterTrack | ShakeTrack;

export type TrackKind = AnyTrack['kind'];
export type TrackOf<K extends TrackKind> = Extract<AnyTrack, { kind: K }>;

export class Timeline {
  private tracks: AnyTrack[] = [];
  private endsAt = 0;

  add(track: AnyTrack): void {
    this.tracks.push(track);
    this.endsAt = Math.max(this.endsAt, track.start + track.duration);
  }

  /** Pushes the end of playback out to at least `at`, for a stall with no track. */
  holdUntil(at: number): void {
    this.endsAt = Math.max(this.endsAt, at);
  }

  get finishesAt(): number {
    return this.endsAt;
  }

  busy(now: number): boolean {
    return now < this.endsAt;
  }

  clear(): void {
    this.tracks = [];
    this.endsAt = 0;
  }

  /** Drops finished tracks. Called once a frame so memory stays flat. */
  prune(now: number): void {
    this.tracks = this.tracks.filter((track) => now <= track.start + track.duration);
  }

  /** Tracks of one kind live at `now`, in the order they were added. */
  active<K extends TrackKind>(now: number, kind: K): TrackOf<K>[] {
    const out: TrackOf<K>[] = [];
    for (const track of this.tracks) {
      if (track.kind !== kind) continue;
      if (now < track.start || now > track.start + track.duration) continue;
      out.push(track as TrackOf<K>);
    }
    return out;
  }

  /** Earliest queued movement for a unit, irrespective of insertion order. */
  nextMove(now: number, unitId: string): MoveTrack | undefined {
    let next: MoveTrack | undefined;
    for (const track of this.tracks) {
      if (track.kind !== 'move' || track.unitId !== unitId || track.start <= now) continue;
      if (!next || track.start < next.start) next = track;
    }
    return next;
  }

  /** 0..1 progress of a track at `now`, clamped. */
  static progress(track: Track, now: number): number {
    const t = (now - track.start) / Math.max(1, track.duration);
    return t < 0 ? 0 : t > 1 ? 1 : t;
  }
}
