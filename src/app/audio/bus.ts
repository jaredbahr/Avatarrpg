/**
 * The audio bus.
 *
 * One `AudioContext`, two ways into it: a decoded file for the world and the
 * interface, and a rendered voice for bending (`src/content/sounds.ts` says
 * which a key is). Everything else here exists because of three facts about
 * playing sound in a browser:
 *
 * 1. **iOS will not make a sound before a gesture.** A context created on load
 *    starts `suspended` and stays there. So the bus is built on load but
 *    unlocked by the first tap, and every call before that is a no-op rather
 *    than an error — `unlock()` is safe to call on every gesture.
 * 2. **A frame loop cannot schedule a sound.** Web Audio has its own clock and
 *    starting a source at `currentTime + delay` is sample-accurate whatever the
 *    renderer is doing. So a cue is scheduled the moment it is known, and never
 *    polled. Environment mix targets may update per frame; their loops and fades
 *    still run on the audio clock.
 * 3. **Sounds arrive in clumps.** A blast over twenty-five tiles, or any round
 *    at all under reduce motion, delivers many cues at one instant. `COALESCE`
 *    drops a repeat of a key that lands on top of another, so a fight sounds
 *    like a fight rather than a burst.
 *
 * Nothing in `src/core/` knows this exists, nothing reads it back, and with the
 * sound setting off it opens no context at all.
 */

import { CourtyardEnvironment } from './environment';
import type { EnvironmentMix } from './environment';

import type { SoundCue } from '../anim/choreography';
import type { SampleDef, SoundDef, VoiceDef } from '../../content/sounds';
import { resolveSound } from '../../content/sounds';
import { assetUrl } from '../../render/spriteCache';
import { mulberry32 } from '../../render/fx/rng';

/** Two cues of one key closer together than this are one sound. */
const COALESCE_MS = 45;

/** Decoded files kept in memory. Bounded because iOS is strict about audio memory. */
const CACHE_LIMIT = 48;

/** A cue further ahead than this is dropped rather than scheduled. */
const HORIZON_MS = 10_000;

/** How loud everything is before the setting is applied. */
const MASTER = 0.6;

type ContextCtor = typeof AudioContext;

function contextCtor(): ContextCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { AudioContext?: ContextCtor; webkitAudioContext?: ContextCtor };
  return w.AudioContext ?? w.webkitAudioContext;
}

export interface AudioBusOptions {
  /** 0 to 1. Read on every cue, so a slider takes effect immediately. */
  readonly volume: () => number;
}

export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  private noise = new Map<string, AudioBuffer>();
  /** The last time each key was scheduled, on the context clock, for coalescing. */
  private lastPlayed = new Map<string, number>();
  private failed = false;
  private environment: CourtyardEnvironment | null = null;
  /**
   * Two counters the end-to-end spec reads, because "did a sound happen" is
   * not a question a browser will answer. `cuesSeen` proves the wiring from
   * the choreography through the animator to here; `scheduled` proves a cue
   * reached Web Audio. Neither proves it was audible — that is the owner's
   * call on the device, and the ADR says so.
   */
  cuesSeen = 0;
  scheduled = 0;

  constructor(private options: AudioBusOptions) {}

  /**
   * Opens the context, or resumes a suspended one. Safe and cheap to call on
   * every gesture, which is what the app does: iOS suspends again when the
   * page goes to the background, so "unlocked once" is not a state worth
   * trusting.
   */
  unlock(): void {
    if (this.failed) return;
    if (this.options.volume() <= 0) return;
    if (!this.ctx) {
      const Ctor = contextCtor();
      if (!Ctor) {
        this.failed = true;
        return;
      }
      try {
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = MASTER;
        this.master.connect(this.ctx.destination);
      } catch (reason) {
        this.failed = true;
        console.warn('Audio is unavailable; the game plays silent.', reason);
        return;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
  }

  /** True once there is a running context. The e2e spec asserts on this. */
  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Called by exploration with a map-derived mix; never unlocks audio itself. */
  updateEnvironment(mix: EnvironmentMix): void {
    if (!mix.courtyard) {
      this.clearEnvironment();
      return;
    }
    if (!this.ctx || !this.master || this.ctx.state !== 'running') return;
    const volume = this.options.volume();
    if (!this.environment && volume > 0)
      this.environment = new CourtyardEnvironment(this.ctx, this.master);
    this.environment?.update(mix, volume);
  }

  /** Scene exit / hidden tab: fade and retire all environmental sources. */
  clearEnvironment(): void {
    this.environment?.stop();
    this.environment = null;
  }

  /** Stops everything and gives the context back. */
  close(): void {
    this.clearEnvironment();
    const ctx = this.ctx;
    const master = this.master;
    this.ctx = null;
    this.master = null;
    this.buffers.clear();
    this.loading.clear();
    this.noise.clear();
    this.lastPlayed.clear();
    if (ctx && master && ctx.state === 'running') {
      // Retire ownership immediately, but release the output before closing so
      // Off never cuts a non-zero waveform. A new context cannot revive this one.
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.032);
      setTimeout(() => void ctx.close().catch(() => undefined), 40);
    } else if (ctx) void ctx.close().catch(() => undefined);
  }

  /**
   * Schedules a push's cues. `now` is the animator's clock reading at the
   * moment of the push, so `cue.at - now` is how far ahead each one is.
   */
  play(cues: readonly SoundCue[], now: number): void {
    this.cuesSeen += cues.length;
    if (!this.ctx || !this.master) return;
    if (this.ctx.state !== 'running') return;
    const volume = this.options.volume();
    if (volume <= 0) return;
    const base = this.ctx.currentTime;
    for (const cue of cues) {
      const delay = cue.at - now;
      if (delay < 0 || delay > HORIZON_MS) continue;
      const when = base + delay / 1000;
      const last = this.lastPlayed.get(cue.key);
      if (last !== undefined && when - last < COALESCE_MS / 1000) continue;
      this.lastPlayed.set(cue.key, when);
      const def = resolveSound(cue.key);
      if (!def) continue;
      this.schedule(def, when, volume, cue.seed);
    }
  }

  /** One sound, at a time on the context clock. */
  private schedule(def: SoundDef, when: number, volume: number, seed: number): void {
    this.scheduled += 1;
    if (def.kind === 'voice') this.playVoice(def, when, volume);
    else if (def.kind === 'layers') {
      for (const voice of def.voices) this.playVoice(voice, when, volume);
    } else this.playSample(def, when, volume, seed);
  }

  /* ---------------------------------------------------------------- */
  /* Recorded sounds                                                   */
  /* ---------------------------------------------------------------- */

  private playSample(def: SampleDef, when: number, volume: number, seed: number): void {
    const choices = [def.url, ...def.variants];
    const pick = choices[Math.floor(mulberry32(seed)() * choices.length)] ?? def.url;
    const buffer = this.buffers.get(pick);
    if (buffer) {
      this.startBuffer(buffer, when, def.gain * volume, def.rate);
      return;
    }
    // Keep the cue's deadline while decoding. Closing the bus cancels pending
    // cues even if another gesture opens a new context before decoding finishes.
    const ctx = this.ctx;
    void this.load(pick).then((loaded) => {
      if (!loaded || !ctx || this.ctx !== ctx || ctx.state !== 'running') return;
      const currentVolume = this.options.volume();
      if (currentVolume <= 0) return;
      this.startBuffer(loaded, when, def.gain * currentVolume, def.rate);
    });
  }

  private startBuffer(buffer: AudioBuffer, when: number, gain: number, rate: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const amp = ctx.createGain();
    amp.gain.value = gain;
    source.connect(amp);
    amp.connect(master);
    source.start(Math.max(when, ctx.currentTime));
  }

  private load(url: string): Promise<AudioBuffer | null> {
    const inFlight = this.loading.get(url);
    if (inFlight) return inFlight;
    const ctx = this.ctx;
    if (!ctx) return Promise.resolve(null);
    const promise = fetch(assetUrl(url))
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} for ${url}`);
        return response.arrayBuffer();
      })
      .then((bytes) => ctx.decodeAudioData(bytes))
      .then((buffer) => {
        if (this.ctx !== ctx) return null;
        // A plain insertion-order bound: the oldest entry goes when full.
        if (this.buffers.size >= CACHE_LIMIT) {
          const oldest = this.buffers.keys().next();
          if (!oldest.done) this.buffers.delete(oldest.value);
        }
        this.buffers.set(url, buffer);
        return buffer;
      })
      .catch((reason: unknown) => {
        console.warn(`The sound ${url} did not load; that cue is silent.`, reason);
        return null;
      })
      .finally(() => {
        if (this.loading.get(url) === promise) this.loading.delete(url);
      });
    this.loading.set(url, promise);
    return promise;
  }

  /* ---------------------------------------------------------------- */
  /* Bending voices                                                    */
  /* ---------------------------------------------------------------- */

  /**
   * A voice is noise through a sweeping filter under an envelope. One second
   * of noise per colour is generated once and looped; the filter sweep and the
   * envelope are what make a fire blast sound unlike a stone.
   */
  private noiseBuffer(kind: VoiceDef['noise']): AudioBuffer | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const cached = this.noise.get(kind);
    if (cached) return cached;
    const length = Math.floor(ctx.sampleRate);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Seeded, not `Math.random`: presentation randomness in this codebase is
    // always `mulberry32` so a replay is a replay (CLAUDE.md, non-negotiable 2).
    // The seed is fixed per colour, so every device hears the same noise floor.
    const rand = mulberry32(kind === 'brown' ? 0x62726f77 : 0x77686974);
    if (kind === 'brown') {
      // Integrated white noise, scaled back to roughly unit peak: much more
      // weight at the bottom, which is what earth and water are made of.
      let last = 0;
      for (let i = 0; i < length; i++) {
        const white = rand() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
    } else {
      for (let i = 0; i < length; i++) data[i] = rand() * 2 - 1;
    }
    this.noise.set(kind, buffer);
    return buffer;
  }

  private playVoice(def: VoiceDef, when: number, volume: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const buffer = this.noiseBuffer(def.noise);
    if (!buffer) return;

    const attack = def.attack / 1000;
    const decay = def.decay / 1000;
    const end = when + attack + decay;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = def.filter;
    filter.Q.value = def.q;
    filter.frequency.setValueAtTime(def.from, when);
    // Exponential, because pitch is heard that way: a linear sweep from 2600 to
    // 320 spends most of its time up high and reads as a hiss, not a whoosh.
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, def.to), end);

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, when);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, def.gain * volume), when + attack);
    if (def.body > 0) {
      amp.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, def.gain * volume * def.body),
        when + attack + decay * 0.35,
      );
    }
    amp.gain.exponentialRampToValueAtTime(0.0001, end);

    source.connect(filter);
    filter.connect(amp);
    amp.connect(master);
    source.start(when);
    source.stop(end + 0.02);

    if (def.crack) this.playCrack(when, def.gain * volume);
  }

  /**
   * The transient at the head of a strike: a few milliseconds of wide noise.
   * It is what makes stone land and lightning break instead of fading in.
   */
  private playCrack(when: number, gain: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const buffer = this.noiseBuffer('white');
    if (!buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain * 0.8, when);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + 0.03);
    source.connect(amp);
    amp.connect(master);
    source.start(when);
    source.stop(when + 0.05);
  }
}
