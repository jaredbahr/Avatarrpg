/**
 * Inline SVG marks.
 *
 * The four-nations wheel is the app icon (public/icons/favicon.svg) redrawn
 * with the palette tokens instead of hex, so the title screen, the backdrop
 * and any later use recolour with the theme from one source. Inline markup
 * rather than an <img>: an SVG loaded as an image cannot read CSS custom
 * properties, and this one is nothing but them.
 */

import type { Ability, AbilityEffect } from '../../core/types';

/** The wheel as the icon draws it: four nation quadrants, a gilt ring, an ink hub. */
export const WHEEL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <circle cx="32" cy="32" r="31" fill="var(--c-bg)"/>
  <path d="M32 32 L32 4 A28 28 0 0 0 4 32 Z" fill="var(--c-fire)"/>
  <path d="M32 32 L60 32 A28 28 0 0 0 32 4 Z" fill="var(--c-water)"/>
  <path d="M32 32 L32 60 A28 28 0 0 0 60 32 Z" fill="var(--c-earth)"/>
  <path d="M32 32 L4 32 A28 28 0 0 0 32 60 Z" fill="var(--c-air)"/>
  <circle cx="32" cy="32" r="28" fill="none" stroke="var(--c-gold)" stroke-width="3"/>
  <circle cx="32" cy="32" r="7" fill="var(--c-bg-deep)"/>
</svg>`;

/**
 * The wheel as a line drawing in the current text colour, for the backdrop:
 * rings and spokes only, hairline at any size (the stroke does not scale).
 */
export const WHEEL_LINES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke">
  <circle cx="32" cy="32" r="30" vector-effect="non-scaling-stroke"/>
  <circle cx="32" cy="32" r="22" vector-effect="non-scaling-stroke"/>
  <circle cx="32" cy="32" r="7" vector-effect="non-scaling-stroke"/>
  <path d="M32 2 V62 M2 32 H62" vector-effect="non-scaling-stroke"/>
</svg>`;

/* ------------------------------------------------------------------ */
/* Ability and control marks                                           */
/* ------------------------------------------------------------------ */

/*
 * One small line drawing per kind of action, drawn in `currentColor` so a
 * button tints it with its element and High contrast inks it. Inline SVG for
 * the same reason as the wheel: an <img> cannot read the tokens. These are
 * the drawn placeholders for the icons the mockup shows on every action
 * button; a generated icon per ability can replace one later by fx key,
 * the way a sheet replaces a painter.
 */

const svg = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

/** The kinds of action a mark can stand for. */
export const MARK_KINDS = [
  'bolt',
  'blast',
  'cone',
  'line',
  'wall',
  'dash',
  'pull',
  'push',
  'guard',
  'heal',
  'smoke',
  'mine',
  'rally',
  'sense',
  'fist',
  'sword',
  'club',
  'sling',
  'arrow',
  'drill',
  'flask',
  'torch',
  'rock',
  'gust',
  'fireball',
  'whip',
  'lightning',
  'ice',
  'tornado',
  'gauntlet',
  'chain',
  'wave',
  'ripple',
  'bolas',
] as const;

export type MarkKind = (typeof MARK_KINDS)[number];

export const ABILITY_MARKS: Readonly<Record<MarkKind, string>> = {
  bolt: svg('<circle cx="16" cy="8" r="3.5"/><path d="M13 11 4 20M11 7 6 9M17 13l-2 5"/>'),
  blast: svg(
    '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  ),
  cone: svg('<path d="M4 20 20 4M4 20l17-9M4 20 13 3M12 5.5a12 12 0 0 1 6.5 6.5"/>'),
  line: svg('<path d="M3 21 21 3M14 3h7v7"/>'),
  wall: svg(
    '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 12h18M12 5v7M7.5 12v7M16.5 12v7"/>',
  ),
  dash: svg('<path d="m5 6 6 6-6 6M13 6l6 6-6 6"/>'),
  pull: svg('<path d="M20 4 8 16M8 9v7h7"/>'),
  push: svg('<path d="M4 12h11M11 8l4 4-4 4M19 5v14"/>'),
  guard: svg('<path d="m12 3 8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'),
  heal: svg('<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>'),
  smoke: svg('<path d="M7 18h11a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18z"/>'),
  mine: svg(
    '<circle cx="12" cy="13" r="5"/><path d="M12 4v3M4 13h3M17 13h4M6.5 7.5l2 2M17.5 7.5l-2 2"/>',
  ),
  rally: svg('<path d="M6 21V4h11l-2 4 2 4H6"/>'),
  sense: svg(
    '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  ),
  fist: svg(
    '<path d="M7 11V8a2 2 0 0 1 4 0v1M11 8V7a2 2 0 0 1 4 0v2M15 8a2 2 0 0 1 4 0v5a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6v-2a2 2 0 0 1 2-2h4"/>',
  ),
  sword: svg('<path d="m4 20 11-11M14 4l6 6-2 2-6-6zM6 14l4 4M3 21l3-1"/>'),
  club: svg('<path d="m4 20 8-8M12 12l6-7 3 3-7 6z"/>'),
  sling: svg('<circle cx="12" cy="7" r="3"/><path d="m9 9-5 11M15 9l5 11"/>'),
  arrow: svg('<path d="M4 20 18 6M13 6h5v5M4 12v8h8"/>'),
  drill: svg('<path d="M12 3v4M8 7h8l-4 14zM9.5 11h5M10.5 14h3"/>'),
  flask: svg('<path d="M10 3h4M11 3v5l-5 9a2 2 0 0 0 2 3h8a2 2 0 0 0 2-3l-5-9V3"/>'),
  torch: svg(
    '<path d="m10 21 2-8 2 8zM12 13c-3 0-4-2-4-4 0-2 2-3 2-5 1 1 2 2 2 2s0-2 1-3c2 2 3 4 3 6 0 2-1 4-4 4z"/>',
  ),
  rock: svg('<path d="m5 17 2-7 5-4 6 2 2 6-3 4H8z"/>'),
  gust: svg('<path d="M3 8h10a2.5 2.5 0 1 0-2.5-2.5M3 13h14a3 3 0 1 1-3 3M3 18h7a2 2 0 1 1-2 2"/>'),
  fireball: svg(
    '<path d="M12 21c-4 0-6-3-6-6 0-3 2-4 2-7 1 1 2 2 2 3 0-3 1-6 3-8 1 3 3 5 4 7 1 2 1 3 1 5 0 3-2 6-6 6z"/>',
  ),
  whip: svg('<path d="M4 19c0-5 4-7 8-7s7-2 7-6c0-2-1-3-2-3"/><circle cx="4" cy="19" r="1.5"/>'),
  lightning: svg('<path d="M13 2 5 13h6l-1 9 9-12h-6z"/>'),
  ice: svg('<path d="M12 3v18M6 6l12 12M18 6 6 18M12 3l-2 3M12 3l2 3"/>'),
  tornado: svg('<path d="M4 5h16M6 9h12M8 13h8M10 17h4M12 21h1"/>'),
  gauntlet: svg(
    '<path d="M6 12V8a2 2 0 0 1 2-2h7a3 3 0 0 1 3 3v4a6 6 0 0 1-6 6H9a3 3 0 0 1-3-3zM6 12h5M19 3l2 2"/>',
  ),
  chain: svg('<circle cx="8" cy="16" r="3"/><circle cx="16" cy="8" r="3"/><path d="m10 14 4-4"/>'),
  wave: svg(
    '<path d="M2 15c2-3 4-3 6 0s4 3 6 0 4-3 6 0M2 20c2-3 4-3 6 0s4 3 6 0 4-3 6 0M2 10c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>',
  ),
  ripple: svg(
    '<path d="M12 12h.01M8 12a4 4 0 0 1 8 0M5 12a7 7 0 0 1 14 0M2 12a10 10 0 0 1 20 0"/>',
  ),
  bolas: svg(
    '<circle cx="6" cy="17" r="2.5"/><circle cx="18" cy="17" r="2.5"/><circle cx="12" cy="5" r="2.5"/><path d="m8 16 4-9 4 9"/>',
  ),
};

/** The controls round the board: move, end turn, confirm, cancel, log, pause, tip, recentre. */
export const UI_MARKS = {
  move: svg(
    '<circle cx="15" cy="4" r="2"/><path d="M13 7l-3 1-2 4M13 7l-1 6-4 6M12 13l4 2 1 5M11 9l6 2"/>',
  ),
  end: svg('<path d="M4 12h13M12 6l6 6-6 6"/>'),
  check: svg('<path d="m4 12.5 5 5L20 7"/>'),
  cancel: svg('<path d="m6 6 12 12M18 6 6 18"/>'),
  log: svg('<path d="M6 4h12v14a2 2 0 0 1-2 2H4a2 2 0 0 0 2-2zM9 8h6M9 12h6"/>'),
  pause: svg('<path d="M9 5v14M15 5v14"/>'),
  talk: svg('<path d="M4 5h16v10h-9l-5 4v-4H4z"/>'),
  party: svg(
    '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5a5 5 0 0 1 5.5 5.5"/>',
  ),
  save: svg('<path d="M12 4v10M8 10l4 4 4-4M4 16v3h16v-3"/>'),
  tip: svg('<path d="M9 18h6M10 21h4M8 10a4 4 0 1 1 8 0c0 2-2 3-2 5h-4c0-2-2-3-2-5z"/>'),
  recentre: svg(
    '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><circle cx="12" cy="12" r="2"/>',
  ),
} as const;

/**
 * Signature marks by fx key: the abilities whose picture the mockup names,
 * and every enemy technique, since the kind rules below read a club swing
 * and a sabre cut as the same melee strike.
 */
export const SIGNATURE_MARKS: Readonly<Record<string, MarkKind>> = {
  'fx.fire.blast': 'fireball',
  'fx.fire.wall': 'wall',
  'fx.fire.lightning': 'lightning',
  'fx.fire.chain': 'lightning',
  'fx.fire.storm': 'lightning',
  'fx.water.whip': 'whip',
  'fx.water.pull': 'whip',
  'fx.water.spikes': 'ice',
  'fx.water.path': 'ice',
  'fx.water.wave': 'wave',
  'fx.water.octopus': 'wave',
  'fx.earth.rock': 'rock',
  'fx.earth.boulder': 'rock',
  'fx.earth.shockwave': 'ripple',
  'fx.earth.metal': 'chain',
  'fx.earth.cable': 'chain',
  'fx.air.blast': 'gust',
  'fx.air.gust': 'gust',
  'fx.air.cyclone': 'tornado',
  'fx.air.tornado': 'tornado',
  'fx.air.boom': 'ripple',
  'fx.non.glove': 'gauntlet',
  'fx.non.bolas': 'bolas',
  'fx.non.mine': 'mine',
  'fx.non.array': 'lightning',
  'fx.enemy.club': 'club',
  'fx.enemy.sling': 'sling',
  'fx.enemy.blade': 'sword',
  'fx.enemy.sabre': 'sword',
  'fx.enemy.crossbow': 'arrow',
  'fx.enemy.slam': 'drill',
  'fx.enemy.spray': 'drill',
  'fx.enemy.debris': 'drill',
  'fx.enemy.churn': 'drill',
};

/** What an ability's mark needs to know: its key, what it targets and what it does. */
export type Markable = Pick<Ability, 'fx' | 'targeting' | 'effects' | 'range' | 'element'>;

/**
 * The kind of mark an ability gets when no signature names one: read off
 * what it does (a dash, a wall, a heal, a pull), then what it targets (a
 * cone, a line, an area), then how it reaches (a strike up close, a bolt at
 * range). New content gets a sensible picture without touching this file.
 */
export function kindFor(ability: Markable): MarkKind {
  const kinds = new Set(ability.effects.map((effect) => effect.kind));
  if (kinds.has('dash')) return 'dash';
  if (kinds.has('wall')) return 'wall';
  if (ability.targeting.shape === 'self') return kinds.has('revealSurfaces') ? 'sense' : 'guard';
  if (kinds.has('heal')) return 'heal';
  if (kinds.has('pull')) return 'pull';
  if (!kinds.has('damage')) {
    if (kinds.has('push')) return 'push';
    const surface = ability.effects.find(
      (effect): effect is Extract<AbilityEffect, { kind: 'surface' }> => effect.kind === 'surface',
    )?.surface;
    if (surface === 'steam') return 'smoke';
    if (surface === 'fire') return 'torch';
    if (surface === 'oil') return 'flask';
    if (surface === 'rubble') return 'rock';
    if (surface === 'ice') return 'ice';
    if (ability.targeting.shape === 'unit' && ability.targeting.allow === 'ally') return 'rally';
    if (surface === 'water' || surface === 'mud') return 'wave';
  }
  if (ability.targeting.shape === 'cone') return 'cone';
  if (ability.targeting.shape === 'line') return 'line';
  if (ability.targeting.shape === 'blast') return 'blast';
  if (ability.range <= 1) return ability.element === 'nonbender' ? 'fist' : 'bolt';
  return 'bolt';
}

/** The kind an ability resolves to: its signature if it has one, else by what it does. */
export function markKindFor(ability: Markable): MarkKind {
  return SIGNATURE_MARKS[ability.fx] ?? kindFor(ability);
}

/** The drawn mark for an ability. `iconMarkup` in icons.ts prefers a real icon. */
export function markFor(ability: Markable): string {
  return ABILITY_MARKS[markKindFor(ability)];
}
