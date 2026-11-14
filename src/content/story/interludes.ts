/**
 * A placeholder still drawn by the stylesheet (`.interlude-card-<card>`), for a
 * scene whose painting is still on the art list. It carries the same alt text a
 * painting would, so a screen reader hears the shot either way.
 */
export const INTERLUDE_CARDS = ['rain', 'flood', 'alarm', 'valve', 'ripple', 'black'] as const;
export type InterludeCard = (typeof INTERLUDE_CARDS)[number];

/** Presentation only. Story text, choices and outcomes remain in the story graph. */
export const INTERLUDE_ART = {
  village: {
    file: 'ba-dan.webp',
    alt: 'An empty stone cart waits on the quiet road through Ba Dan.',
    focus: '52% 54%',
    portraitFocus: '58% 50%',
  },
  mira: {
    file: 'mira.webp',
    alt: 'Elder Mira waits beside the village table, with bowls laid out beneath an awning.',
    focus: '48% 45%',
    portraitFocus: '54% 42%',
  },
  gate: {
    file: 'quarry-gate.webp',
    alt: 'Guards stand above the closed timber gate of the limestone quarry.',
    focus: '50% 36%',
    portraitFocus: '57% 34%',
  },
  road: {
    file: 'east-road.webp',
    alt: 'Rainwater fills the wheel ruts of a winding road through pine woods.',
    focus: '50% 48%',
    portraitFocus: '55% 44%',
  },
  quarry: {
    file: 'quarry.webp',
    alt: 'A huge tracked drill machine sits beneath the ledges of an immense stone quarry.',
    focus: '54% 38%',
    portraitFocus: '63% 34%',
  },
  bay: {
    file: 'bay.webp',
    alt: 'Lamps shine from an old outpost on the far side of the bay at dusk.',
    focus: '52% 48%',
    portraitFocus: '58% 44%',
  },
  rescue: {
    file: 'rescue.webp',
    alt: 'Workers emerge from the quarry galleries and take the path home past the broken driller.',
    focus: '42% 40%',
    portraitFocus: '32% 36%',
  },
  /*
   * The prologue's storm (C-28): placeholder cards until the art batch paints
   * them. No faces, nothing legible; the hand at the valve is the one figure.
   */
  storm_roof: {
    card: 'rain',
    alt: 'Placeholder: rain streaks across a dark iron roof, high overhead.',
  },
  storm_flood: {
    card: 'flood',
    alt: 'Placeholder: dark water rising under a steel door, lit by a swinging lantern.',
  },
  storm_turbine: {
    card: 'alarm',
    alt: 'Placeholder: a turbine housing in the dark, shaking.',
  },
  storm_gallery: {
    card: 'alarm',
    alt: 'Placeholder: red warning lamps flashing down a flooded gallery.',
  },
  storm_valve: {
    card: 'valve',
    alt: 'Placeholder: a hand on a large iron valve wheel, half in shadow.',
  },
  storm_ripple: {
    card: 'ripple',
    alt: 'Placeholder: two rings spreading on dark water from a single drop.',
  },
  storm_black: {
    card: 'black',
    alt: 'Black. Only rain.',
  },
} as const;

export type InterludeStill = (typeof INTERLUDE_ART)[keyof typeof INTERLUDE_ART];

/** The shots that still need a painting: every card, listed for the art batch. */
export function isCardStill(
  art: InterludeStill,
): art is Extract<InterludeStill, { readonly card: InterludeCard }> {
  return 'card' in art;
}

export type InterludeArt = keyof typeof INTERLUDE_ART;

export interface InterludeDef {
  readonly title: string;
  /** One still per existing line; an ending has an additional teaser frame. */
  readonly shots: readonly InterludeArt[];
}

export const INTERLUDES: Readonly<Record<string, InterludeDef>> = {
  prologue_storm: {
    title: 'Inside the Storm',
    shots: [
      'storm_roof',
      'storm_flood',
      'storm_turbine',
      'storm_gallery',
      'storm_valve',
      'storm_valve',
      'storm_ripple',
      'storm_black',
      'mira',
    ],
  },
  act1_open: { title: 'The Empty Road', shots: ['village', 'village', 'mira'] },
  road_depart: { title: 'Into the Pines', shots: ['road', 'road'] },
  quarry_descent: { title: 'The Bottom of the Quarry', shots: ['quarry', 'quarry', 'quarry'] },
  act1_epilogue: { title: 'A Road Home', shots: ['rescue', 'rescue', 'rescue', 'rescue'] },
  act1_epilogue_lost: {
    title: 'The Table Stays Open',
    shots: ['village', 'mira', 'gate', 'quarry', 'bay'],
  },
};

/** A reading pause, not a cinematic deadline. Manual progression is always available. */
export function interludeHoldMs(text: string): number {
  return Math.max(6000, Math.ceil(text.trim().split(/\s+/).length / 2.5) * 1000 + 1500);
}
