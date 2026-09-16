import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ASSETS } from './assets/manifest';
import { ELEMENT_PALETTES, ENEMY_PALETTE, NEUTRAL_PALETTE } from '../render/palettes';

/**
 * The prompt packs under docs/art/prompts are content: they are what the art
 * gets generated from, so they get validated like the rest of the content.
 *
 * Three things are checked. Every portrait key in the manifest has a pack, so
 * a new speaker cannot ship without one. Every hex a pack quotes is a palette
 * value, so a pack cannot drift from the colours the game draws with. And no
 * pack, note or checklist names the franchise or a character from it: the
 * art bible forbids it, and a generator steered by a name produces a likeness
 * the disclaimer in the README promises we do not use.
 */

const ART = join(process.cwd(), 'docs', 'art');
const PORTRAITS = join(ART, 'prompts', 'portraits');

const REQUIRED_SECTIONS = [
  '**Palette**',
  '**Deliver**',
  '**Ships as**',
  '**Manifest**',
  '## Who',
  '## Signature',
  '## Prompt',
  '## Negative prompt',
  '## Variations',
  '## Check',
];

/** Every colour a pack may quote: the palettes, ink, parchment and the UI gold. */
const ALLOWED_HEX = new Set<string>(
  [...Object.values(ELEMENT_PALETTES), NEUTRAL_PALETTE, ENEMY_PALETTE].flatMap((p) => [
    p.base,
    p.light,
    p.dark,
    p.accent,
    p.ink,
  ]),
);
ALLOWED_HEX.add('#f4e9d8');
ALLOWED_HEX.add('#d9a441');
ALLOWED_HEX.add('#f0c674');
ALLOWED_HEX.add('#00ff00');

/*
 * Words that would steer a generator toward the source material. Matched as
 * whole words, case-insensitively. Place names and factions are here as well
 * as characters, because "a fire nation soldier" is as much a likeness
 * request as a name is. The in-game element vocabulary ("bender") is on the
 * list too: the packs describe what a character wears and holds, never what
 * they are called in the game.
 */
const DENYLIST = [
  'avatar',
  'aang',
  'katara',
  'sokka',
  'toph',
  'zuko',
  'iroh',
  'azula',
  'ozai',
  'roku',
  'kyoshi',
  'suki',
  'mai',
  'ty lee',
  'appa',
  'momo',
  'korra',
  'mako',
  'bolin',
  'asami',
  'tenzin',
  'lin beifong',
  'beifong',
  'amon',
  'kuvira',
  'zaheer',
  'varrick',
  'equalist',
  'nickelodeon',
  'airbender',
  'firebender',
  'waterbender',
  'earthbender',
  'bender',
  'bending',
  'fire nation',
  'water tribe',
  'earth kingdom',
  'air nomad',
  'air temple',
  'republic city',
  'ba sing se',
  'omashu',
];

function markdownFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...markdownFiles(path));
    else if (entry.name.endsWith('.md')) out.push(path);
  }
  return out;
}

describe('portrait prompt packs', () => {
  const portraitKeys = Object.keys(ASSETS).filter((key) => key.startsWith('portrait.'));

  it('exist for every portrait key in the manifest', () => {
    expect(portraitKeys.length).toBeGreaterThan(0);
    for (const key of portraitKeys) {
      const file = join(PORTRAITS, `${key.slice('portrait.'.length)}.md`);
      expect(existsSync(file), `${key} needs ${file}`).toBe(true);
    }
  });

  it('carry every section a pack needs', () => {
    for (const key of portraitKeys) {
      const file = join(PORTRAITS, `${key.slice('portrait.'.length)}.md`);
      const text = readFileSync(file, 'utf8');
      for (const section of REQUIRED_SECTIONS) {
        expect(text, `${key}: missing ${section}`).toContain(section);
      }
      // The manifest line in the pack must name the key it is for.
      expect(text).toContain(`'${key}':`);
    }
  });

  it('quote only palette colours', () => {
    for (const file of markdownFiles(join(ART, 'prompts'))) {
      const text = readFileSync(file, 'utf8');
      for (const hex of text.match(/#[0-9a-f]{6}\b/gi) ?? []) {
        expect(ALLOWED_HEX.has(hex.toLowerCase()), `${file} quotes ${hex}`).toBe(true);
      }
    }
  });

  it('never name the franchise, its characters or its factions', () => {
    for (const file of markdownFiles(ART)) {
      const text = readFileSync(file, 'utf8').toLowerCase();
      for (const term of DENYLIST) {
        const pattern = new RegExp(`\\b${term.replace(/ /g, '\\s+')}\\b`, 'i');
        expect(pattern.test(text), `${file} contains "${term}"`).toBe(false);
      }
    }
  });

  it('ship the shared notes beside the packs', () => {
    for (const name of [
      'README.md',
      'prompts/_style.md',
      'prompts/checklist.md',
      'prompts/generator-notes.md',
    ]) {
      expect(existsSync(join(ART, name)), name).toBe(true);
    }
  });
});
