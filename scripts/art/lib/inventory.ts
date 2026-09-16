/**
 * Guessing what a generated file is from its name and its shape, so a folder
 * of loosely named pictures can be sorted into the keys the game knows
 * before anything is processed. Pure, so the mapping is tested without a
 * folder.
 */

import type { ClipName } from '../../../src/content/assets/clips';

export interface Catalogue {
  /** Portrait names: the manifest keys minus `portrait.`. */
  readonly portraits: readonly string[];
  /** Unit sprite keys with their last segment as the name (`unit.fire.kaya` -> `kaya`). */
  readonly units: readonly { key: string; name: string }[];
  /** Map ids with the words a person would name them by. */
  readonly maps: readonly { id: string; words: readonly string[] }[];
}

export type Guess =
  | { kind: 'portrait'; key: string; name: string }
  | { kind: 'frame'; unit: string; clip: ClipName; index: number }
  | { kind: 'reference'; unit: string }
  | { kind: 'map'; id: string }
  | { kind: 'unknown' };

export interface Inventory {
  readonly guess: Guess;
  readonly confidence: 'sure' | 'guess' | 'none';
  /** What is wrong with it for its guessed use, or `ok`. */
  readonly verdict: string;
  /** The command that takes it in, or what to ask for. */
  readonly next: string;
}

/** Words a generator or a person might put in a frame's name, to the clip they mean. */
const CLIP_WORDS: Readonly<Record<string, ClipName>> = {
  idle: 'idle',
  breath: 'idle',
  stand: 'idle',
  walk: 'walk',
  stride: 'walk',
  step: 'walk',
  run: 'walk',
  cast: 'cast',
  windup: 'cast',
  wind: 'cast',
  release: 'cast',
  recover: 'cast',
  bend: 'cast',
  melee: 'melee',
  swing: 'melee',
  lunge: 'melee',
  strike: 'melee',
  punch: 'melee',
  hit: 'hit',
  flinch: 'hit',
  hurt: 'hit',
  ko: 'ko',
  down: 'ko',
  fallen: 'ko',
  fall: 'ko',
  faint: 'ko',
};

/** Lower-case words, split on anything that is not a letter or a digit and between letters and digits. */
export function tokens(name: string): string[] {
  return name
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

const isSquare = (w: number, h: number): boolean => Math.abs(w / h - 1) < 0.02;
const isFrame = (w: number, h: number): boolean => Math.abs(w / h - 2 / 3) < 0.1;
const isLandscape = (w: number, h: number): boolean => w / h > 1.35;

/** Whether the words name a catalogue entry: every word of the entry, or the joined form. */
function names(words: readonly string[], target: readonly string[]): boolean {
  if (target.length === 0) return false;
  const joined = target.join('');
  if (words.includes(joined)) return true;
  return target.every((word) => words.includes(word));
}

export function guessAsset(
  file: string,
  size: { width: number; height: number } | null,
  catalogue: Catalogue,
  format: string | null = null,
): Inventory {
  const words = tokens(file);
  const joined = words.join('');
  const w = size?.width ?? 0;
  const h = size?.height ?? 0;

  const map = catalogue.maps.find(
    (m) => names(words, m.words) || joined.includes(m.id.replace(/_/g, '')),
  );
  const unit = catalogue.units.find((u) => words.includes(u.name) || joined.includes(u.name));
  const portrait = catalogue.portraits.find((p) => words.includes(p) || joined.includes(p));
  const clipWord = words.find((word) => word in CLIP_WORDS);
  const clip = clipWord ? CLIP_WORDS[clipWord] : undefined;
  const number = words.map(Number).find((n) => Number.isInteger(n) && n >= 0 && n < 10);
  const reference = words.some((word) =>
    ['reference', 'ref', 'figure', 'sheet', 'turnaround'].includes(word),
  );
  const bust = words.some((word) => ['portrait', 'bust', 'face', 'headshot'].includes(word));

  if (map && (isLandscape(w, h) || !size)) {
    const verdict = !size
      ? 'unreadable'
      : w < 1920
        ? `too small: ${w} px wide, the map is delivered at 1920`
        : 'ok';
    return {
      guess: { kind: 'map', id: map.id },
      confidence: isLandscape(w, h) ? 'sure' : 'guess',
      verdict,
      next: `npm run art:map -- --map ${map.id} --in "${file}"`,
    };
  }
  if (unit && (clip !== undefined || isFrame(w, h)) && !reference && !bust) {
    const chosen: ClipName = clip ?? 'idle';
    const index = number ?? 0;
    const verdict =
      format === 'jpeg'
        ? 'a JPEG frame: export the pose as PNG, the key colour must be exact'
        : h < 512
          ? `too small: ${w}x${h}, a frame is delivered at 512x768`
          : 'ok';
    return {
      guess: { kind: 'frame', unit: unit.key, clip: chosen, index },
      confidence: clip !== undefined && isFrame(w, h) ? 'sure' : 'guess',
      verdict,
      next: `copy to art/raw/${unit.key}/${chosen}/${index}.png, then npm run art:normalise -- --unit ${unit.key}`,
    };
  }
  if (unit && reference) {
    return {
      guess: { kind: 'reference', unit: unit.key },
      confidence: 'sure',
      verdict: 'ok',
      next: `copy to art/raw/reference/${unit.key}.png (nothing to commit)`,
    };
  }
  if (portrait && (isSquare(w, h) || bust || !clip)) {
    const verdict = !size
      ? 'unreadable'
      : Math.min(w, h) < 512
        ? `too small: ${w}x${h}, a portrait is delivered at 1024 or larger`
        : isSquare(w, h)
          ? 'ok'
          : `not square: ${w}x${h}, art:portrait will cut the centre square`;
    return {
      guess: { kind: 'portrait', key: `portrait.${portrait}`, name: portrait },
      confidence: isSquare(w, h) || bust ? 'sure' : 'guess',
      verdict,
      next: `npm run art:portrait -- --key ${portrait} --in "${file}"`,
    };
  }
  return {
    guess: { kind: 'unknown' },
    confidence: 'none',
    verdict: size ? `${w}x${h}, no name the game knows` : 'unreadable',
    next: 'ask what it is',
  };
}
