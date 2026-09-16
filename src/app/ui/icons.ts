/**
 * Drawn marks, or a real icon set.
 *
 * `marks.ts` draws every action as a few strokes, which is the fallback and
 * always will be: it is in the bundle, it needs no network, and it tints with
 * the element. This file is the slot a real set drops into beside it.
 *
 * The set is Game Icons, one silhouette per mark kind, shipped as one SVG
 * sprite under `public/art/icons/` rather than inlined. A silhouette runs to
 * several kilobytes of path where a drawn mark is a few hundred bytes, and
 * the script budget has no room for thirty of them; a sprite costs the bundle
 * nothing, is cached like any other asset, and is budgeted as art.
 *
 * Until the sprite is in, and if it never arrives, every mark is the drawn
 * one. `?icons=drawn` forces that, which is how the gallery shows the two
 * side by side for a verdict.
 */

import type { MarkKind } from './marks';
import { ABILITY_MARKS } from './marks';
import { assetUrl } from '../../render/spriteCache';

/** Where the generated sprite ships. `scripts/art/icons.ts` writes it. */
export const SPRITE_URL = 'art/icons/game-icons.svg';
/** Prefix on every symbol id, so the sprite cannot collide with anything else in the page. */
export const SYMBOL_PREFIX = 'gi-';

/**
 * One Game Icons id per mark kind. Complete by type, so a new kind cannot be
 * added without choosing an icon for it, and `npm run art:icons` rebuilds the
 * sprite from exactly this table.
 */
export const ICON_IDS: Readonly<Record<MarkKind, string>> = {
  bolt: 'energy-arrow',
  blast: 'explosion-rays',
  cone: 'fire-breath',
  line: 'laser-blast',
  wall: 'brick-wall',
  dash: 'run',
  pull: 'grab',
  push: 'push',
  guard: 'shield',
  heal: 'health-potion',
  smoke: 'smoke-bomb',
  mine: 'unlit-bomb',
  rally: 'rally-the-troops',
  sense: 'eye-target',
  fist: 'punch',
  sword: 'broadsword',
  club: 'wood-club',
  sling: 'slingshot',
  arrow: 'crossbow',
  drill: 'drill',
  flask: 'round-bottom-flask',
  torch: 'torch',
  rock: 'rock',
  gust: 'wind-slap',
  fireball: 'fireball',
  whip: 'whip',
  lightning: 'lightning-arc',
  ice: 'ice-spear',
  tornado: 'tornado',
  gauntlet: 'gauntlet',
  chain: 'crossed-chains',
  wave: 'wave-crest',
  ripple: 'water-drop',
  bolas: 'bolas',
};

type State = 'idle' | 'loading' | 'ready' | 'failed' | 'off';

let state: State = 'idle';

/** `?icons=drawn` keeps the drawn marks; anything else lets the sprite win. */
function forcedOff(): boolean {
  if (typeof window === 'undefined') return true;
  return new URLSearchParams(window.location.search).get('icons') === 'drawn';
}

/**
 * Fetches the sprite once and puts it in the document, where a `<use>` picks
 * its symbols up. Safari will not follow a `<use>` into another file, so the
 * sprite has to be in the page rather than referenced across one.
 */
export function loadIcons(): void {
  if (state !== 'idle') return;
  if (forcedOff()) {
    state = 'off';
    return;
  }
  state = 'loading';
  fetch(assetUrl(SPRITE_URL))
    .then((response) => {
      if (!response.ok) throw new Error(`${response.status} for ${SPRITE_URL}`);
      return response.text();
    })
    .then((text) => {
      // Only a sprite: anything else in the response is not put in the page.
      if (!text.includes(`<symbol id="${SYMBOL_PREFIX}`)) throw new Error('not an icon sprite');
      const holder = document.createElement('div');
      holder.setAttribute('aria-hidden', 'true');
      holder.style.display = 'none';
      holder.innerHTML = text;
      document.body.appendChild(holder);
      state = 'ready';
    })
    .catch((reason: unknown) => {
      state = 'failed';
      console.warn('The icon sprite failed to load; using the drawn marks.', reason);
    });
}

/** True once the sprite is in the page and its symbols can be drawn. */
export function iconsReady(): boolean {
  return state === 'ready';
}

/** For tests, which need each case without a page reload. */
export function resetIconsForTest(next: State = 'idle'): void {
  state = next;
}

/**
 * The markup for a kind: the icon when the sprite is in, the drawn mark
 * otherwise. Both are `currentColor`, so a button tints either the same way.
 */
export function iconMarkup(kind: MarkKind): string {
  if (!iconsReady()) return ABILITY_MARKS[kind];
  return `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><use href="#${SYMBOL_PREFIX}${kind}"/></svg>`;
}
