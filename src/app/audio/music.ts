/**
 * Area music (ADR 0108).
 *
 * One looping track at a time, chosen by area (`src/content/music.ts`), crossfaded on a change and
 * never restarted when the next scene is in the same area. It is not on the sound bus's context on
 * purpose: the bus closes its context whenever a game loads or Sound goes Off, and the music must play
 * on through both. So the music has its own context and its own setting.
 *
 * - **Streamed, not decoded.** A loop is a minute or more; decoded to floats it would be tens of MB,
 *   and iOS is strict about audio memory. So each track is an `<audio>` element (loop on), routed
 *   through a gain node, because iOS ignores `HTMLMediaElement.volume` and a crossfade needs a gain.
 * - **Started by a gesture.** Like the bus, nothing makes a sound before the first tap; `unlock()` is
 *   safe on every gesture and opens the context the first time Music is above Off.
 * - **Off is off.** Music at 0 stops the elements and closes the context; the wanted track is kept, so
 *   turning it up again starts the right one.
 *
 * The decisions (what plays, when to fade, what to stop) live in `MusicPlayer` against a small
 * `MusicBackend`, so the tests drive them with a fake backend and fake timers.
 */

import { MAP_MUSIC, MUSIC_TRACKS, TITLE_MUSIC } from '../../content/music';
import type { MusicTrackId } from '../../content/music';
import { assetUrl } from '../../render/spriteCache';

/** Seconds a crossfade takes. */
export const CROSSFADE_SECONDS = 1.5;
/** How far a fight dips the music: about 3 dB. */
export const FIGHT_DUCK = 0.7;
/** A level change from the setting or a duck. */
const LEVEL_SECONDS = 0.4;

/** The parts of the game a track is chosen from. */
export interface MusicContext {
  readonly scene: string;
  readonly mapId?: string | undefined;
  readonly battleMapId?: string | undefined;
}

/**
 * The track an area plays: the title's for the title and party setup, else the battlefield's or the
 * map's. Null means no opinion (an interlude, an unknown map): keep what is playing.
 */
export function musicFor(context: MusicContext): MusicTrackId | null {
  if (context.scene === 'title' || context.scene === 'setup') return TITLE_MUSIC;
  const mapId = context.battleMapId ?? context.mapId;
  return (mapId && MAP_MUSIC[mapId]) || null;
}

/** One playing track. */
export interface MusicVoice {
  /** Ramp this track's own level, 0 to 1. */
  fade(to: number, seconds: number): void;
  stop(): void;
}

/** What the player needs from the audio graph. */
export interface MusicBackend {
  /** Starts a track looping, silent; the player fades it in. */
  start(url: string): MusicVoice;
  /** The overall level: the setting times any duck. */
  level(to: number, seconds: number): void;
  /** Hidden tab: pause every element; visible again: play them on. */
  pause(): void;
  resume(): void;
  close(): void;
}

export class MusicPlayer {
  private backend: MusicBackend | null = null;
  private current: { id: MusicTrackId; voice: MusicVoice } | null = null;
  private retiring = new Map<ReturnType<typeof setTimeout>, MusicVoice>();
  private wanted: MusicTrackId | null = null;
  private ducked = false;
  private hidden = false;

  constructor(
    private volume: () => number,
    private createBackend: () => MusicBackend | null = createElementBackend,
  ) {}

  /** The track that is playing, or would be once unlocked. The e2e spec reads this. */
  get track(): MusicTrackId | null {
    return this.current?.id ?? null;
  }

  /** True while a track is playing out loud (as far as the game can tell). */
  get playing(): boolean {
    return this.backend !== null && this.current !== null && !this.hidden;
  }

  /** Every gesture: opens the context the first time, resumes it after iOS suspends it. */
  unlock(): void {
    if (this.volume() <= 0) return;
    if (!this.backend) {
      this.backend = this.createBackend();
      if (!this.backend) return;
      this.backend.level(this.target(), 0);
    }
    if (!this.hidden) this.backend.resume();
    this.sync();
  }

  /** Called on every scene change with the area's track; the same track never restarts. */
  setTrack(id: MusicTrackId | null): void {
    if (id === null) return;
    this.wanted = id;
    this.sync();
  }

  /** A fight dips the music a little rather than switching it. */
  setDuck(on: boolean): void {
    if (this.ducked === on) return;
    this.ducked = on;
    this.backend?.level(this.target(), LEVEL_SECONDS);
  }

  /** The Music setting changed. Off gives everything back. */
  volumeChanged(): void {
    if (this.volume() <= 0) this.close();
    else this.backend?.level(this.target(), LEVEL_SECONDS);
  }

  setHidden(hidden: boolean): void {
    if (this.hidden === hidden) return;
    this.hidden = hidden;
    if (hidden) this.backend?.pause();
    else this.backend?.resume();
  }

  close(): void {
    for (const [timer, voice] of this.retiring) {
      clearTimeout(timer);
      voice.stop();
    }
    this.retiring.clear();
    this.current?.voice.stop();
    this.current = null;
    this.backend?.close();
    this.backend = null;
  }

  private target(): number {
    return Math.max(0, Math.min(1, this.volume())) * (this.ducked ? FIGHT_DUCK : 1);
  }

  private sync(): void {
    const backend = this.backend;
    const id = this.wanted;
    if (!backend || id === null || this.current?.id === id) return;
    const outgoing = this.current?.voice;
    if (outgoing) {
      outgoing.fade(0, CROSSFADE_SECONDS);
      const timer = setTimeout(
        () => {
          this.retiring.delete(timer);
          outgoing.stop();
        },
        CROSSFADE_SECONDS * 1000 + 100,
      );
      this.retiring.set(timer, outgoing);
    }
    const voice = backend.start(MUSIC_TRACKS[id]);
    voice.fade(1, CROSSFADE_SECONDS);
    this.current = { id, voice };
    if (this.hidden) backend.pause();
  }
}

type ContextCtor = typeof AudioContext;

/**
 * `<audio>` elements through gain nodes on a context of the music's own.
 *
 * Two elements, made and played inside the first gesture and then reused by alternating, because
 * iOS lets an element play without a tap only once a tap has played it: a crossfade that starts
 * after a walk ends, with no gesture in hand, must reach for an element that is already allowed.
 * A third change inside one crossfade cuts the oldest fade short.
 */
function createElementBackend(): MusicBackend | null {
  const w = window as unknown as { AudioContext?: ContextCtor; webkitAudioContext?: ContextCtor };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  let ctx: AudioContext;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  const master = ctx.createGain();
  master.connect(ctx.destination);
  const ramp = (param: AudioParam, to: number, seconds: number): void => {
    const now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(to, now + seconds);
  };
  // A browser without the codec, or a refused play(), is silence, never an error.
  const play = (element: HTMLAudioElement): void => void element.play().catch(() => undefined);
  const slot = () => {
    const element = new Audio();
    element.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    ctx.createMediaElementSource(element).connect(gain).connect(master);
    // Inside the gesture: this is what allows the element to play later without one.
    play(element);
    return { element, gain, owner: null as object | null };
  };
  type Slot = ReturnType<typeof slot>;
  const slots: readonly [Slot, Slot] = [slot(), slot()];
  let next: 0 | 1 = 0;
  const release = (slot: Slot): void => {
    slot.owner = null;
    slot.element.pause();
    slot.element.removeAttribute('src');
    slot.element.load();
  };
  return {
    start(url) {
      const slot = slots[next];
      next = next === 0 ? 1 : 0;
      if (slot.owner) release(slot);
      const owner = {};
      slot.owner = owner;
      slot.gain.gain.cancelScheduledValues(ctx.currentTime);
      slot.gain.gain.setValueAtTime(0, ctx.currentTime);
      slot.element.src = assetUrl(url);
      play(slot.element);
      return {
        fade: (to, seconds) => {
          if (slot.owner === owner) ramp(slot.gain.gain, to, seconds);
        },
        stop: () => {
          if (slot.owner === owner) release(slot);
        },
      };
    },
    level: (to, seconds) => ramp(master.gain, to, seconds),
    pause() {
      for (const slot of slots) if (slot.owner) slot.element.pause();
      void ctx.suspend().catch(() => undefined);
    },
    resume() {
      if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
      // Also the second chance for a start that was refused: the next tap plays it.
      for (const slot of slots) if (slot.owner && slot.element.paused) play(slot.element);
    },
    close() {
      for (const slot of slots) release(slot);
      void ctx.close().catch(() => undefined);
    },
  };
}
