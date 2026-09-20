/**
 * Sound, as data.
 *
 * The same shape as `fx.ts`: a cue names a key, this file says what that key
 * sounds like, and the bus (`src/app/audio/`) renders it. A new ability needs
 * a row here at most, and usually not even that, because a key falls back to
 * its element's family exactly as `resolveFx` does.
 *
 * **Two kinds of sound, and the reason there are two.** Kenney's public-domain
 * packs cover the world and the interface well — footsteps, impacts, splinters,
 * clicks — and those ship as files. They contain nothing that sounds like
 * bending: no fire whoosh, no stone grind, no wind. The nearest free thing is a
 * chiptune "zap", which under a hand-painted lightning arc would be worse than
 * silence. So a bending voice is *described* rather than recorded: shaped noise
 * with a filter sweep and an envelope, rendered in the Web Audio graph. That
 * costs no bytes, tunes by editing a number here, and is the same
 * fallback-then-swap contract the drawn marks and the painter figures use — a
 * recorded voice can replace one later by key, and nothing else changes.
 *
 * Silence is a valid answer. `resolveSound` returns null for a key nothing
 * covers, and the bus plays nothing, which is always better than the wrong
 * sound.
 */

import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

/** Noise colours a voice can be built from. */
export const NOISE_KINDS = ['white', 'brown'] as const;
export type NoiseKind = (typeof NOISE_KINDS)[number];

/** Filter shapes a voice can sweep. */
export const FILTER_KINDS = ['lowpass', 'bandpass', 'highpass'] as const;
export type FilterKind = (typeof FILTER_KINDS)[number];

/**
 * A recorded sound under `public/audio/`. `variants` are files that mean the
 * same thing; the bus picks one per cue from the cue's own seed, so a row of
 * footsteps does not machine-gun one sample.
 */
export const sampleSchema = z.object({
  kind: z.literal('sample'),
  /** Site-relative, resolved through `assetUrl` like every other asset. */
  url: z.string().min(1),
  /** Extra files that mean the same thing, `url` included in the draw. */
  variants: z.array(z.string().min(1)).default([]),
  /** Level, 1 being the file as it is. */
  gain: z.number().min(0).max(4).default(1),
  /** Playback rate, 1 being the file's own pitch. */
  rate: z.number().min(0.25).max(4).default(1),
});

/**
 * A bending voice: noise through a sweeping filter under an envelope. Every
 * duration is milliseconds and every frequency hertz, so a row reads the way
 * an fx recipe does.
 */
export const voiceSchema = z.object({
  kind: z.literal('voice'),
  noise: z.enum(NOISE_KINDS).default('white'),
  filter: z.enum(FILTER_KINDS).default('bandpass'),
  /** The filter's corner at the start and at the end; the sweep between them is the shape. */
  from: z.number().min(20).max(20000),
  to: z.number().min(20).max(20000),
  /** Filter resonance. Higher is narrower and more tonal. */
  q: z.number().min(0.1).max(30).default(1),
  /** Rise to full level. */
  attack: z.number().min(0).max(2000).default(15),
  /** Fall to silence after the attack. The whole voice is attack + decay. */
  decay: z.number().min(10).max(4000).default(260),
  /** Optional body level at 35% of decay; zero preserves the short legacy envelope. */
  body: z.number().min(0).max(0.8).default(0),
  gain: z.number().min(0).max(4).default(1),
  /** A short click at the head, for a crack or a strike landing. */
  crack: z.boolean().default(false),
});

export const soundSchema = z.discriminatedUnion('kind', [
  sampleSchema,
  voiceSchema,
  z.object({ kind: z.literal('layers'), voices: z.array(voiceSchema).min(1).max(3) }),
]);

export type SampleDef = z.infer<typeof sampleSchema>;
export type VoiceDef = z.infer<typeof voiceSchema>;
export type SoundDef = z.infer<typeof soundSchema>;
export type SoundDefInput = z.input<typeof soundSchema>;

/* ------------------------------------------------------------------ */
/* Helpers, so a row below reads as one line                           */
/* ------------------------------------------------------------------ */

const sample = (
  url: string,
  rest: Partial<Omit<SampleDef, 'kind' | 'url'>> = {},
): SoundDefInput => ({
  kind: 'sample',
  url,
  ...rest,
});

const voice = (
  from: number,
  to: number,
  rest: Partial<Omit<VoiceDef, 'kind' | 'from' | 'to'>> = {},
): z.input<typeof voiceSchema> => ({
  kind: 'voice',
  from,
  to,
  ...rest,
});

/* ------------------------------------------------------------------ */
/* The bending voices                                                  */
/* ------------------------------------------------------------------ */

/**
 * One voice per element, keyed exactly as `FX_FAMILIES` is, so an fx key
 * resolves to a sound through the same middle segment. These are the tuning
 * knobs for how bending sounds; they are meant to be edited by ear.
 */
export const SOUND_FAMILIES: Readonly<Record<string, SoundDefInput>> = {
  // A rush of air catching, falling away as the flame lets go.
  fire: voice(2600, 320, { noise: 'white', q: 1.1, attack: 18, decay: 420, gain: 0.9 }),
  // Lower and rounder, bending down the way a body of water moves.
  water: voice(1500, 240, { noise: 'brown', q: 2.2, attack: 30, decay: 380, gain: 0.85 }),
  // Brittle and high: the sound lives at the top where ice cracks.
  ice: voice(5200, 1800, {
    noise: 'white',
    filter: 'highpass',
    q: 3,
    attack: 6,
    decay: 300,
    crack: true,
  }),
  // Weight. Nearly all of it under the voice, with a strike at the head.
  earth: voice(420, 90, {
    noise: 'brown',
    filter: 'lowpass',
    q: 1.4,
    attack: 4,
    decay: 520,
    gain: 1.1,
    crack: true,
  }),
  // Wide and breathy, rising then gone.
  air: voice(900, 3200, { noise: 'white', q: 0.8, attack: 60, decay: 340, gain: 0.75 }),
  // Almost no attack, a crack, and a short bright tail.
  lightning: voice(7000, 2200, {
    noise: 'white',
    q: 4,
    attack: 2,
    decay: 240,
    gain: 0.95,
    crack: true,
  }),
  // A chi strike: no element, just the snap of the blow.
  non: voice(1800, 600, { noise: 'white', q: 2.5, attack: 4, decay: 150, gain: 0.7, crack: true }),
  // Enemy techniques read as effort, not element.
  enemy: voice(1200, 400, { noise: 'brown', q: 1.6, attack: 10, decay: 220, gain: 0.7 }),
  // Rising and soft: the one voice that goes up and stays.
  heal: voice(600, 2400, { noise: 'white', q: 5, attack: 80, decay: 520, gain: 0.5 }),
  // A shell closing.
  shield: voice(900, 300, { noise: 'brown', q: 3.5, attack: 12, decay: 340, gain: 0.6 }),
};

/* ------------------------------------------------------------------ */
/* Named cues                                                          */
/* ------------------------------------------------------------------ */

/**
 * Named techniques override the family when the material matters more than
 * the faction. World and interface recordings are Kenney's, public domain,
 * credited in `src/content/credits.ts`; weapon voices are original recipes.
 */
export const SOUND_CUES: Readonly<Record<string, SoundDefInput>> = {
  /* Slice materials: release only; hit/miss remains a separate cue. -- */
  // A compact ignition and a lower flame body, rather than a full blast hiss.
  'fx.fire.jab': {
    kind: 'layers',
    voices: [
      voice(2300, 650, { attack: 8, decay: 110, gain: 0.3, q: 0.7 }),
      voice(700, 260, {
        noise: 'brown',
        filter: 'lowpass',
        attack: 18,
        decay: 270,
        body: 0.45,
        gain: 0.65,
        q: 0.8,
      }),
    ],
  },
  // Low weight plus audible stone grit; no crack that would imply a landed hit.
  'fx.earth.rock': {
    kind: 'layers',
    voices: [
      voice(460, 130, {
        noise: 'brown',
        filter: 'lowpass',
        attack: 12,
        decay: 360,
        body: 0.5,
        gain: 0.7,
        q: 0.9,
      }),
      voice(1900, 620, { attack: 9, decay: 210, body: 0.25, gain: 0.18, q: 0.7 }),
    ],
  },
  /* Weapons and machinery ------------------------------------------- */
  // These play at release. A club's swish must not claim a hit before the
  // separately scheduled hit/miss cue; only the crossbow's mechanism cracks.
  'fx.enemy.club': voice(780, 190, {
    noise: 'white',
    q: 0.7,
    attack: 28,
    decay: 190,
    gain: 0.55,
  }),
  'fx.enemy.sling': voice(3200, 850, {
    noise: 'white',
    q: 1.4,
    attack: 10,
    decay: 135,
    gain: 0.38,
  }),
  'fx.enemy.rush': voice(360, 1150, {
    noise: 'brown',
    q: 0.7,
    attack: 65,
    decay: 260,
    gain: 0.7,
  }),
  'fx.enemy.oil': voice(1100, 210, {
    noise: 'brown',
    q: 2.6,
    attack: 25,
    decay: 240,
    gain: 0.6,
  }),
  // A burning torch keeps the fire material even though its key says enemy.
  'fx.enemy.torch': voice(2300, 380, {
    noise: 'white',
    q: 1.1,
    attack: 18,
    decay: 310,
    gain: 0.65,
  }),
  'fx.enemy.blade': voice(4200, 950, {
    noise: 'white',
    q: 1.8,
    attack: 8,
    decay: 165,
    gain: 0.4,
  }),
  'fx.enemy.crossbow': voice(2600, 650, {
    noise: 'white',
    q: 2.4,
    attack: 2,
    decay: 115,
    gain: 0.4,
    crack: true,
  }),
  'fx.enemy.slam': voice(320, 65, {
    noise: 'brown',
    filter: 'lowpass',
    q: 1.8,
    attack: 14,
    decay: 650,
    gain: 1,
  }),
  'fx.enemy.spray': voice(1800, 800, {
    noise: 'white',
    q: 0.6,
    attack: 45,
    decay: 460,
    gain: 0.45,
  }),
  'fx.enemy.debris': voice(650, 120, {
    noise: 'brown',
    filter: 'lowpass',
    q: 1.4,
    attack: 20,
    decay: 430,
    gain: 0.9,
  }),
  'fx.enemy.churn': voice(160, 480, {
    noise: 'brown',
    filter: 'lowpass',
    q: 2.2,
    attack: 85,
    decay: 700,
    gain: 0.85,
  }),
  'fx.enemy.sabre': voice(3400, 700, {
    noise: 'white',
    q: 1.6,
    attack: 12,
    decay: 210,
    gain: 0.45,
  }),
  // A restrained rising support cue, not synthetic speech or a weapon hit.
  'fx.enemy.order': voice(480, 1400, {
    noise: 'brown',
    q: 3,
    attack: 35,
    decay: 210,
    gain: 0.4,
  }),

  /* The world ------------------------------------------------------- */
  // A tile of walking. Four variants so a six-tile walk does not repeat.
  step: sample('audio/step-a.ogg', {
    variants: ['audio/step-b.ogg', 'audio/step-c.ogg', 'audio/step-d.ogg'],
    gain: 0.45,
  }),
  // Damage landing on a body, under whatever voice threw it.
  hit: sample('audio/hit-a.ogg', { variants: ['audio/hit-b.ogg'], gain: 0.8 }),
  // A blow that connects with nothing.
  miss: voice(2200, 700, { noise: 'white', q: 0.9, attack: 20, decay: 180, gain: 0.35 }),
  // Going down.
  ko: sample('audio/ko.ogg', { gain: 0.9, rate: 0.9 }),
  // A prop taking a hit, and a prop coming apart.
  prop: sample('audio/prop-a.ogg', { variants: ['audio/prop-b.ogg'], gain: 0.7 }),
  propBroke: sample('audio/prop-break.ogg', { gain: 0.85 }),

  /* The interface --------------------------------------------------- */
  // Every control goes through `button()`, which asks for one of these two:
  // a primary button commits, everything else taps. Nothing else is listed,
  // because a row here with no caller is a file shipped for nothing.
  tap: sample('audio/ui-tap.ogg', { gain: 0.5 }),
  confirm: sample('audio/ui-confirm.ogg', { gain: 0.6 }),
};

/* ------------------------------------------------------------------ */
/* Resolution                                                          */
/* ------------------------------------------------------------------ */

/** The family a key belongs to, from its middle segment: `fx.fire.jab` -> `fire`. */
export function soundFamily(key: string): string {
  return key.split('.')[1] ?? key;
}

/**
 * What a key sounds like: its own cue, else its element's voice, else nothing.
 * An fx key (`fx.fire.blast`) therefore gets fire's voice without a row, and
 * an unkeyed cue is silent rather than wrong.
 */
export function resolveSound(key: string): SoundDef | null {
  const own = SOUND_CUES[key];
  if (own) return soundSchema.parse(own);
  const family = SOUND_FAMILIES[soundFamily(key)];
  return family ? soundSchema.parse(family) : null;
}

/** Every file the sound table names, for the asset check and the credits. */
export function soundFiles(): string[] {
  const urls = new Set<string>();
  for (const input of Object.values(SOUND_CUES)) {
    const def = soundSchema.parse(input);
    if (def.kind !== 'sample') continue;
    urls.add(def.url);
    for (const variant of def.variants) urls.add(variant);
  }
  return [...urls].sort();
}

/** Every sound, for validation: the named cues and the families. */
export const ALL_SOUNDS: readonly { readonly key: string; readonly def: SoundDefInput }[] = [
  ...Object.entries(SOUND_CUES).map(([key, def]) => ({ key, def })),
  ...Object.entries(SOUND_FAMILIES).map(([key, def]) => ({ key: `family:${key}`, def })),
];
