import type { Page } from '@playwright/test';
import {
  enterNode,
  resetStorage,
  settleLayout,
  startGame,
  takeTurn,
  waitForIdle,
} from '../helpers';
import {
  actor,
  cast,
  endTurn,
  enemies,
  fellEnemies,
  giveTurn,
  grantAbility,
  loadDice,
  open,
  paintSurface,
  partyUnit,
  placeUnit,
  setHp,
  showFigureSheet,
  tileCentre,
  updateSettings,
} from './stage';
import type { FigureRow, Vec2 } from './stage';

/**
 * The beats: every picture the gallery takes, and what each one is for.
 *
 * A beat stages a moment through the real game (the e2e helpers, plus the
 * state surgery in `stage.ts`) and asks the context for a still or a
 * filmstrip. The catalogue is data so `scripts/gallery-index.mjs` can caption
 * the pictures and so a new beat is one entry, not a new spec.
 *
 * Fixed party and seed, so a run captures the same board as the last one and
 * two runs differ only by the change under review.
 */

export const SEED = 'gallery';
/** One player at the table controlling four heroes: no hand-off cards between turns. */
export const PLAYERS = ['Elias'];
export const PARTY = ['kaya', 'bo', 'nilak', 'nima'];

/** Where a filmstrip samples the playback, in animator milliseconds after the act. */
export const CAST_TIMES = [80, 200, 320, 560, 900];
/** A six-tile village walk lasts 660 ms: mid-stride twice, arriving, settled. */
export const WALK_TIMES = [120, 330, 540, 700, 1000];

export interface BeatContext {
  readonly page: Page;
  readonly renderer: 'canvas' | 'webgl';
  readonly project: string;
  /** How long a layout settle may take here: longer on WebGL under software GL. */
  readonly settleTimeout: number;
  /** Builds the query string for a fresh page: the project's renderer plus anything extra. */
  query(extra?: Record<string, string>): string;
  /** One still. `suffix` distinguishes several stills in one beat. */
  shoot(note: string, suffix?: string): Promise<void>;
  /**
   * Pauses the clock, runs `act` (which must not need the page's timers or
   * animation frames: dispatch, never click), then captures a still at each
   * of `times` ms into the playback before letting it finish.
   */
  filmstrip(note: string, times: readonly number[], act: () => Promise<void>): Promise<void>;
}

export interface Beat {
  /** Sortable, file-name safe: `07-fire-cast`. */
  readonly id: string;
  readonly title: string;
  /** What the picture is for: what a reviewer is meant to be judging. */
  readonly note: string;
  /** Projects that capture this beat. Default: every landscape project. */
  readonly projects?: readonly string[];
  run(ctx: BeatContext): Promise<void>;
}

const LANDSCAPE = ['surface-canvas', 'surface-webgl', 'ipad-canvas', 'ipad-webgl'];
const PORTRAIT_TOO = [...LANDSCAPE, 'portrait-canvas'];
const STATS = ['surface-canvas', 'surface-webgl', 'ipad-webgl'];
/** The figure page is a Canvas 2D bake whichever backend draws the board; once per pixel density. */
const FIGURES = ['surface-canvas', 'ipad-canvas'];
/** The painting slot, once per backend: the 2x projects would show the same picture larger. */
const SURFACES = ['surface-canvas', 'surface-webgl'];

const HERO_ROWS: readonly FigureRow[] = [
  { key: 'unit.fire.kaya', label: 'Kaya · fire' },
  { key: 'unit.fire.tenzo', label: 'Tenzo · fire' },
  { key: 'unit.water.nilak', label: 'Nilak · water' },
  { key: 'unit.water.sura', label: 'Sura · water' },
  { key: 'unit.earth.bo', label: 'Bo · earth' },
  { key: 'unit.earth.linmei', label: 'Lin Mei · earth' },
  { key: 'unit.air.nima', label: 'Nima · air' },
  { key: 'unit.air.jinu', label: 'Jinu · air' },
  { key: 'unit.non.riko', label: 'Riko' },
  { key: 'unit.non.wen', label: 'Wen' },
];
const ENEMY_ROWS: readonly FigureRow[] = [
  { key: 'unit.enemy.thug', label: 'Bandit' },
  { key: 'unit.enemy.slinger', label: 'Slinger' },
  { key: 'unit.enemy.bruiser', label: 'Bruiser' },
  { key: 'unit.enemy.quarrybender', label: 'Quarry bandit (earth)' },
  { key: 'unit.enemy.deserter', label: 'Deserter (fire)' },
  { key: 'unit.enemy.merc', label: 'Mercenary' },
  { key: 'unit.enemy.crossbow', label: 'Crossbow' },
  { key: 'unit.enemy.sergeant', label: 'Sergeant' },
  { key: 'unit.enemy.grumbler', label: 'The Grumbler (2 tiles)', widthTiles: 2 },
  { key: 'unit.ally.ruon', label: 'Captain Ruon (ally)' },
];
const VILLAGE_ROWS: readonly FigureRow[] = [
  { key: 'npc.elder', label: 'Elder' },
  { key: 'npc.shopkeeper', label: 'Shopkeeper' },
  { key: 'npc.kid', label: 'Kid' },
  { key: 'npc.guard', label: 'Gate guard' },
];
const CLOSE_ROWS: readonly FigureRow[] = [
  { key: 'unit.fire.kaya', label: 'Kaya · fire' },
  { key: 'unit.earth.bo', label: 'Bo · earth' },
  { key: 'unit.water.nilak', label: 'Nilak · water' },
  { key: 'unit.air.nima', label: 'Nima · air' },
  { key: 'unit.enemy.thug', label: 'Bandit' },
];

function shifted(pos: Vec2, dx: number, dy: number): Vec2 {
  return { x: pos.x + dx, y: pos.y + dy };
}

/** A fresh page, a fresh game, into the village with the layout settled. */
async function openVillage(ctx: BeatContext): Promise<void> {
  await resetStorage(ctx.page, ctx.query());
  await startGame(ctx.page, PLAYERS, PARTY, SEED, { reduceMotion: false });
  await enterNode(ctx.page, 'village_explore');
  await ctx.page.locator('.explore-scene .map-canvas').waitFor();
  await settleLayout(ctx.page, ctx.settleTimeout);
}

/** A fresh page, a fresh game, straight into a fight, with the layout settled. */
async function openBattle(
  ctx: BeatContext,
  options: { node?: string; extra?: Record<string, string> } = {},
): Promise<void> {
  await resetStorage(ctx.page, ctx.query(options.extra));
  await startGame(ctx.page, PLAYERS, PARTY, SEED, { reduceMotion: false });
  await enterNode(ctx.page, options.node ?? 'battle_forest_road');
  await takeTurn(ctx.page, { settleTimeout: ctx.settleTimeout });
  await waitForIdle(ctx.page);
  await settleLayout(ctx.page, ctx.settleTimeout);
}

/** Gives `characterId` the turn and stands the first enemy `dx,dy` from them. */
async function faceOff(
  ctx: BeatContext,
  characterId: string,
  dx: number,
  dy: number,
): Promise<{ hero: string; heroPos: Vec2; enemy: string; enemyPos: Vec2 }> {
  const hero = await partyUnit(ctx.page, characterId);
  if (!hero) throw new Error(`${characterId} is not in the party.`);
  const [enemy] = await enemies(ctx.page);
  if (!enemy) throw new Error('No enemy to stage.');
  let enemyPos = shifted(hero.pos, dx, dy);
  if (!(await open(ctx.page, enemyPos))) enemyPos = shifted(hero.pos, -dx, dy);
  await giveTurn(ctx.page, hero.id);
  await placeUnit(ctx.page, enemy.id, enemyPos);
  await loadDice(ctx.page);
  await settleLayout(ctx.page, ctx.settleTimeout);
  return { hero: hero.id, heroPos: hero.pos, enemy: enemy.id, enemyPos };
}

export const BEATS: readonly Beat[] = [
  {
    id: '01-title',
    title: 'Title screen',
    note: 'The first thing anyone sees: the wheel, the display face, the ink-and-parchment shell.',
    async run(ctx) {
      await resetStorage(ctx.page, ctx.query());
      await ctx.page.getByRole('button', { name: /new game/i }).waitFor();
      await ctx.shoot(this.note);
    },
  },
  {
    id: '02-village',
    title: 'Ba Dan village',
    note: 'Explore: the only walk-around map. The party stands in it as a line and down the side as a roster with health and action points; Talk, Party, Save and Pause sit along the bottom. Upright, the roster is a strip above the map. Judge the ground, the buildings, the villagers and how much it feels like a place.',
    projects: PORTRAIT_TOO,
    async run(ctx) {
      await openVillage(ctx);
      await ctx.shoot(this.note);
    },
  },
  {
    id: '02b-village-walk',
    title: 'The party walks the village',
    note: 'Six tiles east along the road: the leader walks the route the rules gave and the others follow in a line a tile apart, each in their own figure, and settle behind.',
    projects: SURFACES,
    async run(ctx) {
      await openVillage(ctx);
      await ctx.filmstrip(this.note, WALK_TIMES, async () => {
        await ctx.page.evaluate(() => {
          window.fnt?.app.dispatch({ type: 'walkTo', pos: { x: 9, y: 7 } });
        });
      });
    },
  },
  {
    id: '03-dialogue',
    title: 'Dialogue with a portrait',
    note: 'The visual-novel stage: portrait medallion, name plate, mood-tinted backdrop. This is where generated portraits land.',
    projects: PORTRAIT_TOO,
    async run(ctx) {
      await resetStorage(ctx.page, ctx.query());
      await startGame(ctx.page, PLAYERS, PARTY, SEED, { reduceMotion: false });
      await enterNode(ctx.page, 'mira_intro');
      await ctx.page.locator('.stage').waitFor();
      await ctx.shoot(this.note);
    },
  },
  {
    id: '04-board-idle',
    title: 'The board at rest',
    note: 'The forest road with the HUD docked: ground, puddles, trees, unit sprites, turn strip and action bar.',
    projects: PORTRAIT_TOO,
    async run(ctx) {
      await openBattle(ctx);
      await ctx.shoot(this.note);
    },
  },
  {
    id: '05-move-preview',
    title: 'Move preview',
    note: 'Move selected and a tile picked: the reachable range, the path and the confirm bar. Grid feel lives here.',
    async run(ctx) {
      await openBattle(ctx);
      const kaya = await partyUnit(ctx.page, 'kaya');
      if (!kaya) throw new Error('Kaya is not in the party.');
      await giveTurn(ctx.page, kaya.id);
      await settleLayout(ctx.page, ctx.settleTimeout);
      await ctx.page.getByRole('button', { name: /^Move/ }).click();
      const target = shifted(kaya.pos, 2, 0);
      const point = await tileCentre(ctx.page, target);
      await ctx.page.mouse.click(point.x, point.y);
      await ctx.page
        .locator('.confirm-bar')
        .filter({ hasText: /Confirm/ })
        .waitFor();
      await ctx.shoot(this.note);
    },
  },
  {
    id: '05b-walk',
    title: 'Walking a route',
    note: 'A four-tile walk with a turn in it, through its playback: the curve, the ease out of the tile and into the last one, the bob, the sprite turning to face the way it goes.',
    async run(ctx) {
      await openBattle(ctx);
      const kaya = await partyUnit(ctx.page, 'kaya');
      if (!kaya) throw new Error('Kaya is not in the party.');
      await giveTurn(ctx.page, kaya.id);
      await settleLayout(ctx.page, ctx.settleTimeout);
      const route: Vec2[] = [
        shifted(kaya.pos, 1, 0),
        shifted(kaya.pos, 2, 0),
        shifted(kaya.pos, 3, 0),
        shifted(kaya.pos, 3, 1),
      ];
      for (const tile of route) {
        if (!(await open(ctx.page, tile))) throw new Error(`Tile ${tile.x},${tile.y} is not open.`);
      }
      await ctx.filmstrip(this.note, [60, 160, 260, 360, 430], async () => {
        await ctx.page.evaluate(
          ({ id, path }) => {
            window.fnt?.app.dispatch({ type: 'move', unitId: id, path });
          },
          { id: kaya.id, path: route },
        );
      });
    },
  },
  {
    id: '06-aim-preview',
    title: 'Aiming a blast',
    note: 'Fire Blast aimed at a bandit: range, the 3x3 area, the hit chance and damage chips, the reaction sentence.',
    async run(ctx) {
      await openBattle(ctx);
      const staged = await faceOff(ctx, 'kaya', 4, 0);
      await grantAbility(ctx.page, staged.hero, 'fire_blast');
      await settleLayout(ctx.page, ctx.settleTimeout);
      await ctx.page.getByRole('button', { name: /fire blast/i }).click();
      const point = await tileCentre(ctx.page, staged.enemyPos);
      await ctx.page.mouse.click(point.x, point.y);
      await ctx.page
        .locator('.confirm-bar')
        .filter({ hasText: /Confirm/ })
        .waitFor();
      await ctx.shoot(this.note);
    },
  },
  {
    id: '07-fire-cast',
    title: 'Fire Blast lands',
    note: 'The fire effect through its playback: cast, impact, the ground catching, the damage number.',
    async run(ctx) {
      await openBattle(ctx);
      const staged = await faceOff(ctx, 'kaya', 4, 0);
      await grantAbility(ctx.page, staged.hero, 'fire_blast');
      await ctx.filmstrip(this.note, CAST_TIMES, async () => {
        await cast(ctx.page, staged.hero, 'fire_blast', staged.enemyPos);
      });
    },
  },
  {
    id: '08-water-whip',
    title: 'Water Whip lands',
    note: 'The water effect: a whip, not a ring. Compare with fire for how distinct the elements read.',
    async run(ctx) {
      await openBattle(ctx);
      const staged = await faceOff(ctx, 'nilak', 3, 0);
      await ctx.filmstrip(this.note, CAST_TIMES, async () => {
        await cast(ctx.page, staged.hero, 'water_whip', staged.enemyPos);
      });
    },
  },
  {
    id: '09-rock-throw',
    title: 'Rock Throw lands',
    note: 'The earth effect: something thrown, something that hits with weight.',
    async run(ctx) {
      await openBattle(ctx);
      const staged = await faceOff(ctx, 'bo', 3, 0);
      await ctx.filmstrip(this.note, CAST_TIMES, async () => {
        await cast(ctx.page, staged.hero, 'rock_throw', staged.enemyPos);
      });
    },
  },
  {
    id: '10-air-blast',
    title: 'Air Blast lands',
    note: 'The air effect: spirals and a shove, the lightest of the four.',
    async run(ctx) {
      await openBattle(ctx);
      const staged = await faceOff(ctx, 'nima', 3, 0);
      await ctx.filmstrip(this.note, CAST_TIMES, async () => {
        await cast(ctx.page, staged.hero, 'air_blast', staged.enemyPos);
      });
    },
  },
  {
    id: '11-lightning-puddle',
    title: 'Lightning through a puddle',
    note: 'The signature reaction: two bandits on the same water, one bolt, both shocked. The bolt and the chain are what to look at.',
    async run(ctx) {
      await openBattle(ctx);
      const kaya = await partyUnit(ctx.page, 'kaya');
      if (!kaya) throw new Error('Kaya is not in the party.');
      const [first, second] = await enemies(ctx.page);
      if (!first || !second) throw new Error('Two enemies are needed on the puddle.');
      // The forest road's puddle spans (4..7, 6); make sure of it, then fill it.
      const puddle: Vec2[] = [
        { x: 5, y: 6 },
        { x: 6, y: 6 },
        { x: 5, y: 5 },
        { x: 6, y: 5 },
      ];
      for (const tile of puddle) await paintSurface(ctx.page, tile, 'water');
      await giveTurn(ctx.page, kaya.id);
      await placeUnit(ctx.page, kaya.id, { x: 2, y: 6 });
      await placeUnit(ctx.page, first.id, { x: 5, y: 6 });
      await placeUnit(ctx.page, second.id, { x: 6, y: 5 });
      await grantAbility(ctx.page, kaya.id, 'lightning');
      await loadDice(ctx.page);
      await settleLayout(ctx.page, ctx.settleTimeout);
      await ctx.filmstrip(this.note, CAST_TIMES, async () => {
        await cast(ctx.page, kaya.id, 'lightning', { x: 5, y: 6 });
      });
    },
  },
  {
    id: '12-ko',
    title: 'A bandit goes down',
    note: 'The KO: the fall, the "down" floater, what a fallen unit looks like on the board afterwards.',
    async run(ctx) {
      await openBattle(ctx);
      const staged = await faceOff(ctx, 'bo', 3, 0);
      // The dice are loaded, but a hit chance is not a promise, so try until
      // the rock connects; the picture does not care which roll it was.
      for (let attempt = 0; attempt < 8; attempt++) {
        await setHp(ctx.page, staged.enemy, 1);
        await giveTurn(ctx.page, staged.hero);
        await loadDice(ctx.page);
        let died = false;
        await ctx.filmstrip(this.note, CAST_TIMES, async () => {
          const events = await cast(ctx.page, staged.hero, 'rock_throw', staged.enemyPos);
          died = events.includes('unitDied');
        });
        if (died) return;
        await waitForIdle(ctx.page);
      }
      throw new Error('Rock Throw missed eight times in a row.');
    },
  },
  {
    id: '13-victory',
    title: 'Victory panel',
    note: 'The result panel over the board: the fight is won, XP is paid, Continue.',
    async run(ctx) {
      await openBattle(ctx);
      const active = await actor(ctx.page);
      if (!active) throw new Error('Nobody is acting.');
      await fellEnemies(ctx.page);
      await endTurn(ctx.page, active.id);
      await ctx.page.locator('.result-panel').waitFor();
      await waitForIdle(ctx.page);
      await ctx.shoot(this.note);
    },
  },
  {
    id: '14-boss-blast',
    title: 'The quarry floor and a 5x5 storm',
    note: 'The boss map with ledges, oil and mud, a two-tile machine, and the biggest effect in the game with the frame-time readout showing.',
    projects: STATS,
    async run(ctx) {
      await openBattle(ctx, { node: 'battle_grumbler', extra: { stats: '1' } });
      const kaya = await partyUnit(ctx.page, 'kaya');
      if (!kaya) throw new Error('Kaya is not in the party.');
      const boss = (await enemies(ctx.page)).find((u) => u.size === 2);
      if (!boss) throw new Error('No two-tile boss on the floor.');
      await giveTurn(ctx.page, kaya.id);
      // Stand within range but off to one side, so the storm is not on top of the caster.
      const from = { x: Math.max(0, boss.pos.x - 5), y: boss.pos.y };
      if (await open(ctx.page, from)) await placeUnit(ctx.page, kaya.id, from);
      await grantAbility(ctx.page, kaya.id, 'lightning_storm');
      await loadDice(ctx.page);
      await settleLayout(ctx.page, ctx.settleTimeout);
      await ctx.shoot('The quarry floor at rest, with the frame-time readout.', 'floor');
      await ctx.filmstrip(this.note, CAST_TIMES, async () => {
        await cast(ctx.page, kaya.id, 'lightning_storm', boss.pos);
      });
    },
  },
  {
    id: '16-grid-on',
    title: 'The grid, switched on',
    note: 'The same board with the Show grid setting on: tile lines back over the ground, for anyone who counts squares.',
    async run(ctx) {
      await openBattle(ctx);
      await updateSettings(ctx.page, { showGrid: true });
      const kaya = await partyUnit(ctx.page, 'kaya');
      if (!kaya) throw new Error('Kaya is not in the party.');
      await giveTurn(ctx.page, kaya.id);
      await settleLayout(ctx.page, ctx.settleTimeout);
      await ctx.page.getByRole('button', { name: /^Move/ }).click();
      await ctx.shoot(this.note);
    },
  },
  {
    id: '17-figures',
    title: 'Every figure, every pose',
    note: 'The placeholder rig through the sheet baker, a row per unit: idle A and B, walk A and B, cast wind-up, release and recover, melee A and B, hit, KO. Real sheets replace these one key at a time.',
    projects: FIGURES,
    async run(ctx) {
      await resetStorage(ctx.page, ctx.query());
      await ctx.page.getByRole('button', { name: /new game/i }).waitFor();
      const height = ctx.page.viewportSize()?.height ?? 900;
      const pages: readonly (readonly [string, readonly FigureRow[]])[] = [
        ['heroes', HERO_ROWS],
        ['enemies', ENEMY_ROWS],
        ['village', VILLAGE_ROWS],
      ];
      for (const [name, rows] of pages) {
        // As large as the rows allow on this screen, up to a 64 px tile.
        const tile = Math.min(64, Math.floor((height - 70) / rows.length / 1.62));
        await showFigureSheet(ctx.page, rows, tile);
        await ctx.shoot(`${this.note} (${name}, ${tile} px a tile)`, name);
      }
      await showFigureSheet(ctx.page, CLOSE_ROWS, 96);
      await ctx.shoot(`${this.note} (the gallery party and a bandit at 96 px a tile)`, 'close');
    },
  },
  {
    id: '15-largest-contrast',
    title: 'Largest text, high contrast',
    note: 'The accessibility settings on: the HUD grows, the map gives up height, the board must still read.',
    async run(ctx) {
      await openBattle(ctx);
      await updateSettings(ctx.page, { largeText: 'huge', highContrast: true });
      await settleLayout(ctx.page, ctx.settleTimeout);
      await waitForIdle(ctx.page);
      await ctx.shoot(this.note);
    },
  },
  {
    id: '18-backdrop',
    title: 'A painting under the grid',
    note: 'The painting slot with a flat stand-in for the forest road (the layout image the map packs ship, 32 px a tile, with the probe block): the puddle, the move contour, the units and the effects are drawn over the painting, and the decor that marked footing stands down. Then the same board with Show grid on: every edge in the painting sits on a tile line, which is the check a real painting must pass.',
    projects: SURFACES,
    async run(ctx) {
      await openBattle(ctx);
      const loaded = await ctx.page.evaluate(() =>
        window.fnt?.app.overrideBackdrop('forest_road', {
          url: 'art/test/backdrop.png',
          pixelsPerTile: 32,
        }),
      );
      if (!loaded) throw new Error('The probe painting did not load.');
      const kaya = await partyUnit(ctx.page, 'kaya');
      if (!kaya) throw new Error('Kaya is not in the party.');
      await giveTurn(ctx.page, kaya.id);
      await settleLayout(ctx.page, ctx.settleTimeout);
      await ctx.page.getByRole('button', { name: /^Move/ }).click();
      await ctx.shoot(this.note, 'painted');
      await updateSettings(ctx.page, { showGrid: true });
      await settleLayout(ctx.page, ctx.settleTimeout);
      await ctx.shoot(`${this.note} (Show grid on)`, 'grid');
    },
  },
  {
    id: '19-icons',
    title: 'Drawn marks, or a real icon set',
    note: 'The same action bar twice: first with the drawn marks that have always shipped, then with Game Icons, one silhouette per kind of action, swapped in through the sprite. Both tint with the element. The question is which reads better on parchment at a glance, and whether the silhouettes sitting beside the line-drawn Move and End turn looks deliberate or unfinished.',
    projects: SURFACES,
    async run(ctx) {
      // The drawn marks first, forced, so the pair is the same turn either way.
      await openBattle(ctx, { extra: { icons: 'drawn' } });
      const kaya = await partyUnit(ctx.page, 'kaya');
      if (!kaya) throw new Error('Kaya is not in the party.');
      await giveTurn(ctx.page, kaya.id);
      await settleLayout(ctx.page, ctx.settleTimeout);
      await ctx.shoot(this.note, 'drawn');

      await openBattle(ctx);
      const again = await partyUnit(ctx.page, 'kaya');
      if (!again) throw new Error('Kaya is not in the party.');
      await giveTurn(ctx.page, again.id);
      await ctx.page.waitForFunction(() => document.querySelectorAll('svg use').length > 0);
      await settleLayout(ctx.page, ctx.settleTimeout);
      await ctx.shoot(`${this.note} (the icon set)`, 'icons');
    },
  },
];

/** Whether a beat is captured on a project. */
export function capturedOn(beat: Beat, project: string): boolean {
  return (beat.projects ?? LANDSCAPE).includes(project);
}
