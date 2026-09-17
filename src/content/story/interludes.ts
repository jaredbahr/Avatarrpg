/** Presentation only. Story text, choices and outcomes remain in the story graph. */
export const INTERLUDE_ART = {
  village: {
    file: 'ba-dan.webp',
    alt: 'An empty stone cart waits on the quiet road through Ba Dan.',
  },
  mira: {
    file: 'mira.webp',
    alt: 'Elder Mira waits beside the village table, with bowls laid out beneath an awning.',
  },
  gate: {
    file: 'quarry-gate.webp',
    alt: 'Guards stand above the closed timber gate of the limestone quarry.',
  },
  road: {
    file: 'east-road.webp',
    alt: 'Rainwater fills the wheel ruts of a winding road through pine woods.',
  },
  quarry: {
    file: 'quarry.webp',
    alt: 'A huge tracked drill machine sits beneath the ledges of an immense stone quarry.',
  },
  bay: {
    file: 'bay.webp',
    alt: 'Lamps shine from an old outpost on the far side of the bay at dusk.',
  },
  rescue: {
    file: 'rescue.webp',
    alt: 'Workers emerge from the quarry galleries and take the path home past the broken driller.',
  },
} as const;

export type InterludeArt = keyof typeof INTERLUDE_ART;

export interface InterludeDef {
  readonly title: string;
  /** One still per existing line; an ending has an additional teaser frame. */
  readonly shots: readonly InterludeArt[];
}

export const INTERLUDES: Readonly<Record<string, InterludeDef>> = {
  act1_open: { title: 'The Empty Road', shots: ['village', 'village', 'mira'] },
  road_depart: { title: 'Into the Pines', shots: ['village', 'road'] },
  quarry_descent: { title: 'The Bottom of the Quarry', shots: ['quarry', 'quarry', 'quarry'] },
  act1_epilogue: { title: 'A Road Home', shots: ['rescue', 'mira', 'rescue', 'rescue', 'bay'] },
  act1_epilogue_lost: {
    title: 'The Table Stays Open',
    shots: ['village', 'mira', 'gate', 'quarry', 'bay'],
  },
};

/** A reading pause, not a cinematic deadline. Manual progression is always available. */
export function interludeHoldMs(text: string): number {
  return Math.max(6000, Math.ceil(text.trim().split(/\s+/).length / 2.5) * 1000 + 1500);
}
