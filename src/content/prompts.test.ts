import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLIP_FRAME_COUNTS, CLIP_NAMES } from './assets/clips';
import { ASSETS } from './assets/manifest';
import { CHARACTERS } from './characters';
import { ALL_MAPS } from './index';
import {
  ELEMENT_PALETTES,
  ENEMY_PALETTE,
  NEUTRAL_PALETTE,
  TERRAIN_STYLES,
} from '../render/palettes';

/**
 * The prompt packs under docs/art/prompts are content: they are what the art
 * gets generated from, so they get validated like the rest of the content.
 *
 * Five things are checked. Every portrait key in the manifest has a pack, so
 * a new speaker cannot ship without one. Every hero sprite, and the pilot
 * enemy, has a sheet pack whose pose table matches the clip vocabulary, so
 * the frames a pack asks for are the frames the runtime can play. Every map
 * has a painting pack and a layout image (`scripts/art/lib/maps.test.ts`
 * holds them to what the content generates). Every hex a pack quotes is a
 * palette value, so a pack cannot drift from the colours the game draws
 * with. And no pack, note or checklist names the franchise or a character
 * from it: the art bible forbids it, and a generator steered by a name
 * produces a likeness the disclaimer in the README promises we do not use.
 */

const ART = join(process.cwd(), 'docs', 'art');
const PORTRAITS = join(ART, 'prompts', 'portraits');
const SHEETS = join(ART, 'prompts', 'sheets');
const MAPS = join(ART, 'prompts', 'maps');

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

const SHEET_SECTIONS = [
  '**Palette**',
  '**Reference**',
  '**Deliver**',
  '**Ships as**',
  '**Manifest**',
  '## Who',
  '## Signature',
  '## Poses',
  '## Prompt',
  '## Negative prompt',
  '## Commands',
  '## Check',
];

const MAP_SECTIONS = [
  '**Deliver**',
  '**Ships as**',
  '**Map**',
  '**Layout**',
  '**Palette**',
  '## Where',
  '## The grid',
  '## Prompt',
  '## Negative prompt',
  '## Commands',
  '## Check',
];

/** Every colour a pack may quote: the palettes, ink, parchment, the UI gold and the ground. */
const ALLOWED_HEX = new Set<string>(
  [...Object.values(ELEMENT_PALETTES), NEUTRAL_PALETTE, ENEMY_PALETTE].flatMap((p) => [
    p.base,
    p.light,
    p.dark,
    p.accent,
    p.ink,
  ]),
);
for (const style of Object.values(TERRAIN_STYLES)) ALLOWED_HEX.add(style.fill);
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

describe('sheet prompt packs', () => {
  /** Every hero's sprite, and the bandit the art bible pairs with the first hero sheet. */
  const sheetKeys = [...CHARACTERS.map((c) => c.sprite), 'unit.enemy.thug'];

  it('exist for every hero sprite and the pilot enemy, and for nothing the manifest lacks', () => {
    for (const key of sheetKeys) {
      expect(existsSync(join(SHEETS, `${key}.md`)), `${key} needs a sheet pack`).toBe(true);
    }
    for (const entry of readdirSync(SHEETS)) {
      const key = entry.replace(/\.md$/, '');
      expect(ASSETS[key], `${entry} is not a manifest key`).toBeDefined();
    }
  });

  it('carry every section a pack needs, and name their key, reference and commands', () => {
    for (const key of sheetKeys) {
      const text = readFileSync(join(SHEETS, `${key}.md`), 'utf8');
      for (const section of SHEET_SECTIONS) {
        expect(text, `${key}: missing ${section}`).toContain(section);
      }
      expect(text).toContain(`'${key}':`);
      expect(text).toContain(`art/raw/reference/${key}.png`);
      expect(text).toContain(`npm run art:normalise -- --unit ${key}`);
      expect(text).toContain(`npm run art:pack -- --unit ${key}`);
    }
  });

  it('ask for exactly the frames the clip table allows', () => {
    for (const key of sheetKeys) {
      const text = readFileSync(join(SHEETS, `${key}.md`), 'utf8');
      // The optional Riverside tea cels have their own bounded source pack below.
      for (const clip of CLIP_NAMES.filter((clip) => clip !== 'tea')) {
        const { min, max } = CLIP_FRAME_COUNTS[clip];
        for (let index = 0; index < min; index++) {
          expect(text, `${key}: ${clip}/${index}`).toContain(`\`${clip}/${index}.png\``);
        }
        expect(text, `${key}: ${clip} asks for more frames than the table allows`).not.toContain(
          `\`${clip}/${max}.png\``,
        );
      }
    }
  });

  it('keeps the optional tea source pack bound to the two illustrated Riverside actors', () => {
    const pack = readFileSync(join(ART, 'riverside-tea.md'), 'utf8');
    for (let i = 0; i < CLIP_FRAME_COUNTS.tea.min; i++) {
      expect(pack).toContain(`\`tea/${i}.png\``);
    }
    expect(pack).not.toContain('`tea/2.png`');
    expect(
      Object.entries(ASSETS)
        .filter(([, asset]) => asset.kind === 'sheet' && asset.clips.tea)
        .map(([key]) => key),
    ).toEqual(['unit.village.sura', 'unit.village.kaya']);
  });

  it('never ship a hero sheet without its portrait pack describing the same figure', () => {
    for (const character of CHARACTERS) {
      const sheet = readFileSync(join(SHEETS, `${character.sprite}.md`), 'utf8');
      const portrait = readFileSync(
        join(PORTRAITS, `${character.portrait.slice('portrait.'.length)}.md`),
        'utf8',
      );
      // Both packs point at the same reference figure, so sprite and portrait are one character.
      expect(portrait).toContain(`art/raw/reference/${character.sprite}.png`);
      expect(sheet).toContain(`art/raw/reference/${character.sprite}.png`);
    }
  });

  it('are the only packs, beside the notes, under the prompts folder', () => {
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

describe('map painting packs', () => {
  it('exist for every map, with the layout image beside them, and for nothing else', () => {
    for (const map of ALL_MAPS) {
      expect(existsSync(join(MAPS, `${map.id}.md`)), `${map.id} needs a map pack`).toBe(true);
      expect(existsSync(join(MAPS, `${map.id}-layout.png`)), `${map.id} needs its layout`).toBe(
        true,
      );
    }
    const ids = new Set(ALL_MAPS.map((m) => m.id));
    for (const entry of readdirSync(MAPS)) {
      const id = entry.replace(/-layout\.png$|\.md$/, '');
      expect(ids.has(id), `${entry} is not a map`).toBe(true);
    }
  });

  it('carry every section a pack needs, and name their file, size and commands', () => {
    for (const map of ALL_MAPS) {
      const text = readFileSync(join(MAPS, `${map.id}.md`), 'utf8');
      for (const section of MAP_SECTIONS) {
        expect(text, `${map.id}: missing ${section}`).toContain(section);
      }
      expect(text).toContain(`url: 'art/maps/${map.id}.webp'`);
      expect(text).toContain(`art/raw/maps/${map.id}.png`);
      expect(text).toContain(`npm run art:map -- --map ${map.id}`);
      expect(text).toContain(`${map.width} columns by ${map.height} rows`);
    }
  });
});
