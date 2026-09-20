import { describe, expect, it } from 'vitest';
import { spriteText } from '../../../scripts/art/icons';
import { ABILITY_MARKS, MARK_KINDS } from './marks';
import { ICON_IDS, SYMBOL_PREFIX, iconMarkup, iconsReady, resetIconsForTest } from './icons';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('the icon table', () => {
  it('names an icon for every kind of mark, with no duplicates', () => {
    for (const kind of MARK_KINDS) {
      expect(ICON_IDS[kind], `${kind} has no icon`).toBeTruthy();
    }
    const ids = MARK_KINDS.map((kind) => ICON_IDS[kind]);
    expect(new Set(ids).size, 'two kinds share an icon').toBe(ids.length);
  });
});

describe('iconMarkup', () => {
  it('draws the mark until the sprite is in, and after it fails', () => {
    for (const state of ['idle', 'loading', 'failed', 'off'] as const) {
      resetIconsForTest(state);
      expect(iconsReady()).toBe(false);
      // Exactly what the game drew before the sprite existed.
      expect(iconMarkup('rock')).toBe(ABILITY_MARKS.rock);
    }
    resetIconsForTest();
  });

  it('points at the sprite once it is in', () => {
    resetIconsForTest('ready');
    const markup = iconMarkup('fireball');
    expect(markup).toContain(`<use href="#${SYMBOL_PREFIX}fireball"/>`);
    expect(markup).not.toBe(ABILITY_MARKS.fireball);
    resetIconsForTest();
  });
});

describe('the committed sprite', () => {
  const onDisk = readFileSync(resolve('public/art/icons/game-icons.svg'), 'utf8');

  it('is what the icon table generates', () => {
    // Regenerated and compared, the way the map packs are: picking a different
    // icon without rebuilding the sprite fails here rather than in the game.
    expect(onDisk).toBe(spriteText());
  });

  it('carries a symbol for every kind, and every symbol is drawable', () => {
    for (const kind of MARK_KINDS) {
      expect(onDisk, `${kind} is missing`).toContain(`<symbol id="${SYMBOL_PREFIX}${kind}"`);
    }
    // currentColor throughout, so a button tints an icon like a drawn mark.
    expect(onDisk).not.toMatch(/fill="#[0-9a-f]{3,6}"/i);
    expect(onDisk.match(/<symbol /g)?.length).toBe(MARK_KINDS.length);
  });
});
