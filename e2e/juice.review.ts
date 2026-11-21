/**
 * The combat juice review: one frame strip per ability per heading, for every hero's kit and every
 * enemy the encounters field, so the demo's "finished" bar (an action clip per heading and ability,
 * impact frames, projectiles, hit-stop, shake, a readable damage number) can be judged by eye.
 *
 * Staging is deterministic and owns nothing on a story map: the review enters the Forest Road fight
 * only for its board and camera, finds the clearest open patch on that board, and for each case
 * replaces the roster with the attacker and a dummy (a foe, or an ally for a heal), placed along
 * the heading. The attacker first walks one tile along the heading so it faces that way, the dice
 * are loaded so the hit lands, and the ability goes through `app.dispatch`, so the real rules,
 * animator, effects and damage numbers play. The paused page clock is then stepped through the
 * exchange and each frame is cropped on the attacker and the dummy.
 *
 * The cases come from content: every character's kit (grants and both sides of every choice) and
 * every enemy any encounter places (roster, variants, reinforcements, flag-gated groups). A case the
 * rules refuse to stage is listed and fails the run at the end, after every other strip is written.
 *
 * Writes, under `FNT_JUICE_OUT` (default `.review/juice/<commit>`, gitignored):
 * - `<renderer>/<unit>--<ability>--<heading>.png`, one row of frames;
 * - `<renderer>/<unit>--<ability>--<heading>.gif` with `FNT_JUICE_MOTION=1` (needs ffmpeg);
 * - `<renderer>/index.html`, every strip with its frame times, and `cases.json`.
 *
 * Run: `npm run review:juice`. Options, all optional and comma-separated:
 * - `FNT_JUICE_UNIT=kaya,crossbow` character or enemy ids (default: all);
 * - `FNT_JUICE_ABILITY=fire_blast` ability ids (default: all);
 * - `FNT_JUICE_HEADING=east,south` (default `east,southWest`; `all` for the eight);
 * - `FNT_JUICE_RENDERER=canvas|webgl|both` (default `canvas`);
 * - `FNT_JUICE_FRAMES=12` frames a strip;
 * - `FNT_JUICE_MOTION=1` also an animated GIF of each exchange at 30 fps;
 * - `FNT_JUICE_OUT=<dir>`; `FNT_JUICE_PORT` for the dev server (default 4351).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import type * as AbilitiesModule from '../src/core/rules/abilities';
import type * as CreateModule from '../src/core/state/createGame';
import type * as LevelingModule from '../src/core/rules/leveling';
import type { BattleState, GameState, Unit } from '../src/core/types';
import { HEADINGS } from '../src/content/assets/clips';
import { pauseClock, resetStorage, settleLayout, startGame } from './helpers';
import { loadDice } from './gallery/stage';
import { paintedGroundPoint } from './projection';

const list = (name: string): string[] =>
  (process.env[name] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const revision = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
  encoding: 'utf8',
}).trim();
const OUT = process.env.FNT_JUICE_OUT ?? join('.review', 'juice', revision);
const UNITS = list('FNT_JUICE_UNIT');
const ABILITIES = list('FNT_JUICE_ABILITY');
const HEADING_ARG = list('FNT_JUICE_HEADING');
const HEADING_LIST: readonly string[] =
  HEADING_ARG.length === 0
    ? ['east', 'southWest']
    : HEADING_ARG[0] === 'all'
      ? HEADINGS
      : HEADING_ARG;
const RENDERER = process.env.FNT_JUICE_RENDERER ?? 'canvas';
const RENDERERS = RENDERER === 'both' ? (['canvas', 'webgl'] as const) : [RENDERER];
const FRAMES = Math.max(4, Number(process.env.FNT_JUICE_FRAMES ?? 12));
const MOTION = process.env.FNT_JUICE_MOTION === '1';

for (const heading of HEADING_LIST)
  if (!(HEADINGS as readonly string[]).includes(heading))
    throw new Error(`FNT_JUICE_HEADING: "${heading}" is not one of ${HEADINGS.join(', ')}.`);

/** A grid step for each heading (`HEADINGS` order: east, then clockwise on screen). */
const STEP: Readonly<Record<string, { x: number; y: number }>> = {
  east: { x: 1, y: 0 },
  southEast: { x: 1, y: 1 },
  south: { x: 0, y: 1 },
  southWest: { x: -1, y: 1 },
  west: { x: -1, y: 0 },
  northWest: { x: -1, y: -1 },
  north: { x: 0, y: -1 },
  northEast: { x: 1, y: -1 },
};

interface Case {
  readonly kind: 'hero' | 'enemy';
  readonly unit: string;
  readonly ability: string;
  readonly heading: string;
}

interface Staged {
  readonly error?: string;
  readonly attacker?: string;
  readonly others?: readonly string[];
}

/** The open patch every case is staged on: its centre, found once per board. */
const RADIUS = 4;

/** Every case the content offers: each hero's kit and each fielded enemy's abilities. */
async function contentCases(page: Page): Promise<Omit<Case, 'heading'>[]> {
  return page.evaluate(() => {
    const content = window.fnt!.app.content;
    const out: { kind: 'hero' | 'enemy'; unit: string; ability: string }[] = [];
    for (const character of content.characters.values()) {
      const ids = new Set<string>();
      for (const entry of character.kit) {
        if ('ability' in entry) ids.add(entry.ability);
        else if ('choose' in entry) entry.choose.forEach((id) => ids.add(id));
      }
      for (const ability of ids) out.push({ kind: 'hero', unit: character.id, ability });
    }
    const fielded = new Set<string>();
    for (const encounter of content.encounters.values()) {
      const placements = [
        ...encounter.enemies,
        ...encounter.reinforcements,
        ...encounter.variants.flatMap((v) => v.enemies ?? []),
        ...encounter.conditionalEnemies.flatMap((group) => group.placements),
      ];
      for (const placement of placements) fielded.add(placement.enemyId);
    }
    for (const id of [...fielded].sort()) {
      const def = content.enemies.get(id);
      if (!def) continue;
      for (const ability of def.abilities) out.push({ kind: 'enemy', unit: id, ability });
    }
    return out;
  });
}

/**
 * The clearest open patch on the board: every tile within `RADIUS` (or failing that, a tile less)
 * open, flat and free of props, nearest the board's middle. Surfaces are cleared when staging.
 */
async function findPatch(page: Page): Promise<{ x: number; y: number }> {
  const centre = await page.evaluate((largest) => {
    for (let radius = largest; radius >= largest - 1; radius--) {
      const battle = window.fnt!.app.state!.battle!;
      const { width, height, tiles } = battle.grid;
      const at = (x: number, y: number) => tiles[y * width + x];
      const propAt = new Set(battle.props.map((p) => `${p.pos.x},${p.pos.y}`));
      let best: { x: number; y: number; d: number } | null = null;
      for (let cy = radius; cy < height - radius; cy++)
        for (let cx = radius; cx < width - radius; cx++) {
          const base = at(cx, cy);
          if (!base) continue;
          let clear = true;
          for (let y = cy - radius; y <= cy + radius && clear; y++)
            for (let x = cx - radius; x <= cx + radius; x++) {
              const tile = at(x, y);
              if (
                !tile ||
                tile.blocked ||
                tile.elevation !== base.elevation ||
                tile.terrain === 'water_deep' ||
                tile.terrain === 'pit' ||
                propAt.has(`${x},${y}`)
              ) {
                clear = false;
                break;
              }
            }
          if (!clear) continue;
          const d = Math.hypot(cx - width / 2, cy - height / 2);
          if (!best || d < best.d) best = { x: cx, y: cy, d };
        }
      if (best) return { x: best.x, y: best.y };
    }
    return null;
  }, RADIUS);
  if (!centre)
    throw new Error(
      `The staging board has no open ${RADIUS * 2 - 1}x${RADIUS * 2 - 1} patch; pick another board.`,
    );
  return centre;
}

/**
 * Replaces the roster with the case's attacker and dummy and makes it the attacker's turn. Returns
 * the ids, or why the rules refuse every placement tried.
 */
async function stage(
  page: Page,
  c: Case,
  patch: { x: number; y: number },
  step: { x: number; y: number },
): Promise<Staged> {
  return page.evaluate(
    async ({ c, patch, step }) => {
      // Through the dev server, as enemy-scale.review.ts does.
      const createPath = '/src/core/state/createGame.ts';
      const levelPath = '/src/core/rules/leveling.ts';
      const abilityPath = '/src/core/rules/abilities.ts';
      const { createPartyUnit } = (await import(createPath)) as typeof CreateModule;
      const { scaleStats } = (await import(levelPath)) as typeof LevelingModule;
      const { canUseAbility, isValidTarget } = (await import(
        abilityPath
      )) as typeof AbilitiesModule;
      const app = window.fnt!.app;
      const content = app.content;
      const w = window as unknown as { juiceBase?: GameState };
      const base = (w.juiceBase ??= app.state!);
      const battle = base.battle!;
      const ability = content.abilities.get(c.ability);
      if (!ability) return { error: `unknown ability ${c.ability}` };

      const tough = (u: Unit, id: string, faction: Unit['faction']): Unit => ({
        ...u,
        id,
        faction,
        hp: 200,
        base: { ...u.base, maxHp: 200 },
        statuses: [],
        cooldowns: {},
        ap: u.base.maxAp,
        move: u.base.maxMove,
      });
      const enemyUnit = (id: string): Unit | null => {
        const def = content.enemies.get(id);
        if (!def) return null;
        const stats = scaleStats(def.stats, def.element, 3);
        return {
          id: 'x',
          name: def.name,
          faction: 'enemy',
          element: def.element,
          characterId: null,
          enemyId: def.id,
          disciplineId: null,
          level: 3,
          xp: 0,
          pos: { x: 0, y: 0 },
          size: def.size,
          hp: stats.maxHp,
          ap: stats.maxAp,
          move: stats.maxMove,
          bankedAp: 0,
          pendingAp: 0,
          base: stats,
          abilities: [...def.abilities],
          cooldowns: {},
          statuses: [],
          ai: 'none',
          temporary: false,
          sprite: def.sprite,
        };
      };
      const hero = battle.units.find((u) => u.faction === 'party');
      const foeTemplate = battle.units.find((u) => u.faction === 'enemy');
      if (!hero || !foeTemplate) return { error: 'the staging fight has no party or no enemy' };

      let attacker: Unit;
      if (c.kind === 'hero') {
        const character = content.characters.get(c.unit);
        if (!character) return { error: `unknown character ${c.unit}` };
        const unit = createPartyUnit(content, character, 0, 10, undefined, { autoChoose: true });
        attacker = {
          ...unit,
          abilities: unit.abilities.includes(c.ability)
            ? unit.abilities
            : [...unit.abilities, c.ability],
        };
      } else {
        const unit = enemyUnit(c.unit);
        if (!unit) return { error: `unknown enemy ${c.unit}` };
        attacker = unit;
      }
      attacker = { ...attacker, id: 'jA', pos: patch, ap: attacker.base.maxAp, cooldowns: {} };
      const side = attacker.faction;
      // A foe from the other side, an ally from this one.
      const foe = tough(
        side === 'party' ? foeTemplate : hero,
        'jT',
        side === 'party' ? 'enemy' : 'party',
      );
      const ally = tough(side === 'party' ? hero : foeTemplate, 'jT', side);

      // Counted from the edge of the attacker's footprint, so a two-tile unit (the Driller) has room.
      const edge = attacker.size - 1;
      const at = (k: number) => ({
        x: patch.x + (step.x > 0 ? edge : 0) + step.x * k,
        y: patch.y + (step.y > 0 ? edge : 0) + step.y * k,
      });
      const reach = Math.max(1, Math.min(ability.range || 1, 2));
      const t = ability.targeting;
      const tries: { target: { x: number; y: number }; dummy: Unit }[] = [];
      if (t.shape === 'self') tries.push({ target: patch, dummy: { ...foe, pos: at(2) } });
      else if (t.shape === 'unit' && t.allow === 'ally')
        for (let k = reach; k >= 1; k--)
          tries.push({ target: at(k), dummy: { ...ally, pos: at(k), hp: 90 } });
      else if (t.shape === 'unit' && t.allow === 'downed')
        for (let k = 1; k <= reach; k++)
          tries.push({ target: at(k), dummy: { ...ally, pos: at(k), hp: 0 } });
      else {
        for (let k = reach; k >= 1; k--)
          tries.push({ target: at(k), dummy: { ...foe, pos: at(k) } });
        // A tile ability that wants an empty tile: the foe stands just past it.
        for (let k = reach; k >= 1; k--)
          tries.push({ target: at(k), dummy: { ...foe, pos: at(k + 1) } });
      }

      const reasons: string[] = [];
      for (const { target, dummy } of tries) {
        const units = [attacker, dummy];
        const staged: BattleState = {
          ...battle,
          units,
          order: units.map((u) => u.id),
          turnIndex: 0,
          phase: 'active',
          temporaryWalls: [],
          grid: {
            ...battle.grid,
            tiles: battle.grid.tiles.map((tile, i) => {
              const x = i % battle.grid.width;
              const y = Math.floor(i / battle.grid.width);
              const near = Math.max(Math.abs(x - patch.x), Math.abs(y - patch.y)) <= 5;
              return near && tile.surface ? { ...tile, surface: null } : tile;
            }),
          },
          props: battle.props.filter(
            (p) => Math.max(Math.abs(p.pos.x - patch.x), Math.abs(p.pos.y - patch.y)) > 5,
          ),
        };
        const usable = canUseAbility(content, attacker, ability);
        if (!usable.ok) return { error: usable.reason };
        const valid = isValidTarget(content, staged, attacker, ability, target);
        if (!valid.ok) {
          reasons.push(`${target.x},${target.y}: ${valid.reason}`);
          continue;
        }
        app.state = { ...base, battle: staged };
        app.resync();
        app.animator.clear();
        // Each walks one tile toward the other first, so each faces along the heading.
        const now = performance.now();
        const back = { x: patch.x - step.x, y: patch.y - step.y };
        const beyond = { x: dummy.pos.x + step.x, y: dummy.pos.y + step.y };
        const before = units.map((u) =>
          u.id === attacker.id ? { ...u, pos: back } : dummy.hp > 0 ? { ...u, pos: beyond } : u,
        );
        app.animator.push(
          now - 2000,
          [
            { type: 'unitMoved', unitId: attacker.id, path: [attacker.pos], cost: 1 },
            ...(dummy.hp > 0 && dummy.id !== attacker.id
              ? [{ type: 'unitMoved' as const, unitId: dummy.id, path: [dummy.pos], cost: 1 }]
              : []),
          ],
          before,
        );
        app.animator.prune(now);
        (window as unknown as { juiceTarget?: { x: number; y: number } }).juiceTarget = target;
        return { attacker: attacker.id, others: [dummy.id] };
      }
      return { error: `no placement the rules accept (${reasons.join('; ')})` };
    },
    { c, patch, step },
  );
}

/**
 * Centres the camera on a staged unit through the turn strip's own focus control. The attacker
 * acts first, so it is the first chip with its name. The clock is paused, so no settle wait here:
 * the caller steps the clock after.
 */
async function focus(page: Page, id: string): Promise<void> {
  const name = await page.evaluate(
    (unitId) => window.fnt!.app.state!.battle!.units.find((u) => u.id === unitId)!.name,
    id,
  );
  await page
    .getByRole('button', { name: `Focus ${name}`, exact: true })
    .first()
    .click();
}

/** Tiles of frame above the higher pair's feet (a figure and its damage number) and below the lower. */
const HEAD_ROOM = 2.6;
const FOOT_ROOM = 0.7;

/** A unit's drawn feet on the page, or null once it is gone. */
async function feet(
  page: Page,
  id: string,
): Promise<{ x: number; y: number; lift: number } | null> {
  const at = await page.evaluate((unitId) => {
    const app = window.fnt!.app;
    const unit = app.state?.battle?.units.find((u) => u.id === unitId);
    if (!unit) return null;
    return { pos: app.animator.renderPos(performance.now(), unitId) ?? unit.pos, size: unit.size };
  }, id);
  if (!at) return null;
  // The middle of the footprint's front row: a two-tile unit (the Driller) stands on four cells.
  const point = await paintedGroundPoint(page, {
    x: at.pos.x + at.size / 2,
    y: at.pos.y + at.size - 0.5,
  });
  // How many tiles of frame the figure and its number need above its feet.
  return point ? { ...point, lift: HEAD_ROOM + (at.size - 1) * 1.6 } : null;
}

type Feet = { x: number; y: number; lift: number };

/** The frame both figures fit in, a damage number's height above the taller, in page CSS px. */
async function frameBox(page: Page, ids: readonly string[]) {
  const a = await paintedGroundPoint(page, { x: 0, y: 0 });
  const b = await paintedGroundPoint(page, { x: 1, y: 0 });
  if (!a || !b) throw new Error('The map canvas is not on the page.');
  const tile = Math.hypot(b.x - a.x, b.y - a.y);
  const points = (await Promise.all(ids.map((id) => feet(page, id)))).filter(
    (p): p is Feet => p !== null,
  );
  if (points.length === 0) throw new Error('Neither staged unit is on the page.');
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const big = Math.max(...points.map((p) => p.lift)) - HEAD_ROOM;
  const width = Math.max(...xs) - Math.min(...xs) + tile * (3 + big);
  const top = Math.min(...points.map((p) => p.y - p.lift * tile));
  const height = Math.max(...ys) + FOOT_ROOM * tile - top;
  return {
    tile,
    width: Math.round(width),
    height: Math.round(height),
    centre: {
      x: (Math.max(...xs) + Math.min(...xs)) / 2,
      y: (Math.max(...ys) + Math.min(...ys)) / 2,
    },
  };
}

/** One frame, recentred on the pair as the follow camera moves, at a fixed size. */
async function shot(page: Page, ids: readonly string[], w: number, h: number, tile: number) {
  const points = (await Promise.all(ids.map((id) => feet(page, id)))).filter(
    (p): p is Feet => p !== null,
  );
  const size = page.viewportSize()!;
  const cx = points.reduce((s, p) => s + p.x, 0) / Math.max(1, points.length);
  // The tallest figure's head and its number fit above, the lower one's shadow below.
  const top = Math.min(...points.map((p) => p.y - p.lift * tile));
  const clip = {
    x: Math.max(0, Math.min(size.width - w, cx - w / 2)),
    y: Math.max(0, Math.min(size.height - h, top)),
    width: Math.min(w, size.width),
    height: Math.min(h, size.height),
  };
  return PNG.sync.read(await page.screenshot({ clip }));
}

function sheet(frames: readonly PNG[]): Buffer {
  const first = frames[0]!;
  const gap = 4;
  const out = new PNG({
    width: first.width * frames.length + gap * (frames.length - 1),
    height: first.height,
  });
  out.data.fill(0x12);
  frames.forEach((f, i) =>
    PNG.bitblt(
      f,
      out,
      0,
      0,
      Math.min(f.width, first.width),
      Math.min(f.height, first.height),
      i * (first.width + gap),
      0,
    ),
  );
  return PNG.sync.write(out);
}

const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

for (const renderer of RENDERERS) {
  test(`combat juice review (${renderer})`, async ({ page }) => {
    const dir = join(OUT, renderer);
    mkdirSync(dir, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.clock.install();
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Ana'], ['kaya', 'sura', 'bo'], 'juice-review', { reduceMotion: false });
    await page.evaluate(() =>
      window.fnt!.app.dispatch({ type: 'enterNode', nodeId: 'battle_forest_road' }),
    );
    await settleLayout(page);
    const ready = page.getByRole('button', { name: "I'm ready" });
    if (await ready.isVisible()) await ready.click();
    await settleLayout(page);
    await pauseClock(page);
    await page.clock.runFor(500);

    const patch = await findPatch(page);
    const all = await contentCases(page);
    const cases: Case[] = all
      .filter((c) => UNITS.length === 0 || UNITS.includes(c.unit))
      .filter((c) => ABILITIES.length === 0 || ABILITIES.includes(c.ability))
      .flatMap((c) => HEADING_LIST.map((heading) => ({ ...c, heading })));
    if (cases.length === 0)
      throw new Error(
        `No case matches FNT_JUICE_UNIT=${UNITS.join(',') || '*'} FNT_JUICE_ABILITY=${ABILITIES.join(',') || '*'}. ` +
          `Units on offer: ${[...new Set(all.map((c) => c.unit))].join(', ')}.`,
      );

    const failures: string[] = [];
    const written: { name: string; times: number[]; events: string[]; gif: boolean }[] = [];
    for (const c of cases) {
      const name = `${c.unit}--${c.ability}--${c.heading}`;
      console.log(`${written.length + failures.length + 1}/${cases.length} ${name}`);
      const staged = await stage(page, c, patch, STEP[c.heading]!);
      if (staged.error || !staged.attacker) {
        failures.push(`${name}: ${staged.error ?? 'not staged'}`);
        continue;
      }
      const ids = [staged.attacker, ...(staged.others ?? [])];
      // The turn strip's real focus control, then let the camera settle on the pair.
      await focus(page, staged.attacker);
      await page.clock.runFor(300);
      await page.clock.fastForward(1500);
      await loadDice(page, 0.5);
      const box = await frameBox(page, ids);

      const cast = await page.evaluate(
        ({ id, ability }) => {
          const app = window.fnt!.app;
          const target = (window as unknown as { juiceTarget: { x: number; y: number } })
            .juiceTarget;
          const now = performance.now();
          const events = app.dispatch({
            type: 'useAbility',
            unitId: id,
            abilityId: ability,
            target,
          });
          return {
            events: events.map((e) => e.type),
            duration: app.animator.finishesAt - now,
            text: events.find((e) => e.type === 'message'),
          };
        },
        { id: staged.attacker, ability: c.ability },
      );
      if (!cast.events.includes('abilityUsed')) {
        failures.push(
          `${name}: the rules refused the cast (${JSON.stringify(cast.text ?? cast.events)})`,
        );
        continue;
      }
      // The whole action, then long enough for the number to rise and the target to recover.
      const span = Math.max(1200, cast.duration + 900);
      const times: number[] = [];
      const frames: PNG[] = [];
      let t = 0;
      for (let i = 0; i < FRAMES; i++) {
        const next = Math.round((span * i) / (FRAMES - 1));
        await page.clock.fastForward(Math.max(1, next - t));
        t = Math.max(t + 1, next);
        times.push(t);
        frames.push(await shot(page, ids, box.width, box.height, box.tile));
      }
      writeFileSync(join(dir, `${name}.png`), sheet(frames));

      let gif = false;
      if (MOTION && hasFfmpeg) {
        // The same exchange again at 30 fps, as a player sees it.
        const again = await stage(page, c, patch, STEP[c.heading]!);
        if (!again.error) {
          await focus(page, staged.attacker);
          await page.clock.runFor(300);
          await page.clock.fastForward(1500);
          await loadDice(page, 0.5);
          await page.evaluate(
            ({ id, ability }) => {
              const target = (window as unknown as { juiceTarget: { x: number; y: number } })
                .juiceTarget;
              window.fnt!.app.dispatch({
                type: 'useAbility',
                unitId: id,
                abilityId: ability,
                target,
              });
            },
            { id: staged.attacker, ability: c.ability },
          );
          const tmp = mkdtempSync(join(tmpdir(), 'juice-'));
          const count = Math.ceil(span / (1000 / 30));
          for (let i = 0; i < count; i++) {
            const png = await shot(page, ids, box.width, box.height, box.tile);
            writeFileSync(join(tmp, `f${String(i).padStart(4, '0')}.png`), PNG.sync.write(png));
            await page.clock.fastForward(Math.round(1000 / 30));
          }
          execFileSync('ffmpeg', [
            '-y',
            '-loglevel',
            'error',
            '-framerate',
            '30',
            '-i',
            join(tmp, 'f%04d.png'),
            '-vf',
            'scale=iw/2:-1:flags=neighbor,split[a][b];[a]palettegen[p];[b][p]paletteuse',
            join(dir, `${name}.gif`),
          ]);
          rmSync(tmp, { recursive: true, force: true });
          gif = true;
        }
      }
      written.push({ name, times, events: cast.events, gif });
      // Let anything still settling finish before the next case replaces the roster.
      await page.clock.fastForward(1500);
    }

    writeFileSync(
      join(dir, 'cases.json'),
      JSON.stringify({ revision, renderer, patch, written, failures }, null, 2),
    );
    const rows = written
      .map(
        (w) =>
          `<section><h2>${w.name}</h2><p>${w.times.map((t) => `${t} ms`).join(' · ')}</p>` +
          `<p class="events">${w.events.join(' → ')}</p><img src="${w.name}.png">` +
          (w.gif ? `<img src="${w.name}.gif">` : '') +
          '</section>',
      )
      .join('\n');
    writeFileSync(
      join(dir, 'index.html'),
      `<!doctype html><meta charset="utf-8"><title>Combat juice ${revision} (${renderer})</title>` +
        '<style>body{background:#120d0a;color:#f4e9d8;font:14px system-ui;margin:16px}img{max-width:100%;display:block;margin:4px 0}' +
        'h2{font-size:15px;margin:18px 0 2px}p{margin:2px 0;color:#a89880}.events{font-size:12px}</style>' +
        `<h1>Combat juice, ${revision}, ${renderer}</h1>` +
        (failures.length ? `<h2>Not staged</h2><pre>${failures.join('\n')}</pre>` : '') +
        rows,
    );
    if (MOTION && !hasFfmpeg)
      console.warn('FNT_JUICE_MOTION=1 needs ffmpeg on the PATH; strips only.');
    console.log(`Combat juice: ${written.length} strips, ${failures.length} not staged, in ${dir}`);
    expect(errors, 'page errors during the review').toEqual([]);
    expect(failures, 'cases the review could not stage').toEqual([]);
  });
}
