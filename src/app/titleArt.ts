/**
 * The title screen's key art: the paintings it rotates through and how each is
 * framed (docs/art/title-key-art.md). Pure data and one pure pick, so the
 * scene stays about the DOM and the choice is testable without one.
 */

export type TitleArtId = 'a' | 'b' | 'c';

export interface TitleArtFile {
  readonly file: string;
  readonly width: number;
  readonly height: number;
}

export interface TitleArtDef {
  readonly id: TitleArtId;
  readonly wide: TitleArtFile;
  readonly portrait: TitleArtFile;
  /** Which side of a landscape screen the plate sits on: the side the painting leaves quiet. */
  readonly side: 'left' | 'right';
  /** `object-position` of the cover-fitted landscape file: keeps the party in frame at 4:3. */
  readonly focus: string;
  /** `object-position` of the portrait crop inside its box. */
  readonly portraitFocus: string;
}

export const TITLE_ART: readonly TitleArtDef[] = [
  {
    // The party crosses the Forest Road toward the quarry at golden hour: the
    // party fills the right, the sun and the dark pines hold the left.
    id: 'a',
    wide: { file: 'title-a-wide.webp', width: 1600, height: 900 },
    portrait: { file: 'title-a-portrait.webp', width: 810, height: 900 },
    side: 'left',
    focus: '100% 50%',
    portraitFocus: '50% 62%',
  },
  {
    // The Ba Dan market at dusk: the party is on the left and a dark building
    // fills the right, so the plate goes there.
    id: 'b',
    wide: { file: 'title-b-wide.webp', width: 1600, height: 900 },
    portrait: { file: 'title-b-portrait.webp', width: 810, height: 900 },
    side: 'right',
    focus: '12% 50%',
    portraitFocus: '50% 62%',
  },
  {
    // The bridge to the quarry gate at dawn: the party is lower right, the
    // quiet sky and trees are on the left.
    id: 'c',
    wide: { file: 'title-c-wide.webp', width: 1600, height: 900 },
    portrait: { file: 'title-c-portrait.webp', width: 700, height: 900 },
    side: 'left',
    focus: '85% 50%',
    portraitFocus: '80% 62%',
  },
];

/** The shortest idle time `?titleArtHold=` may set; a URL cannot start a fast swap loop. */
export const MIN_TITLE_ART_HOLD_MS = 3000;

/**
 * `?titleArtHold=` clamped: exactly 0 stops the rotation, 3000 ms or more is
 * taken as given, anything else (absent, malformed, too short) is `undefined`,
 * which the rotator reads as its default.
 */
export function parseTitleArtHold(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === '') return undefined;
  const ms = Number(raw);
  if (ms === 0) return 0;
  return Number.isFinite(ms) && ms >= MIN_TITLE_ART_HOLD_MS ? ms : undefined;
}

export function titleArtById(id: string | null | undefined): TitleArtDef | undefined {
  return TITLE_ART.find((art) => art.id === id);
}

/**
 * The next painting: random, never the one just shown. `random` is injected
 * (a number in [0, 1)) so a test can walk every outcome.
 */
export function pickTitleArt(previous: string | null, random: () => number): TitleArtDef {
  const pool = TITLE_ART.filter((art) => art.id !== previous);
  const choices = pool.length > 0 ? pool : TITLE_ART;
  const index = Math.min(choices.length - 1, Math.floor(random() * choices.length));
  const chosen = choices[index] ?? TITLE_ART[0];
  if (!chosen) throw new Error('No title art is defined.');
  return chosen;
}
