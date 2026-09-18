import type { Beat } from './beats';
import { CHARACTERS } from '../../src/content/characters';
import { ASSETS } from '../../src/content/assets/manifest';
import {
  enterNode,
  resetStorage,
  settleLayout,
  startGame,
  takeTurn,
  waitForIdle,
} from '../helpers';

const GROUPS = [
  ['kaya', 'tenzo', 'nilak', 'sura', 'bo'],
  ['linmei', 'nima', 'jinu', 'riko', 'wen'],
] as const;

/** Actual shipped pixels at roughly 40 px figure height, plus enlarged reviews. */
const CONTACT: Beat = {
  id: '35-hero-walk-cels',
  title: 'All heroes: lateral walk cels and mirrored footing',
  note: 'Idle, four east-facing walk cels and the same four facing west. Judge identity, foot line and silhouette at game size and enlarged.',
  projects: ['surface-canvas'],
  async run(ctx) {
    await resetStorage(ctx.page, ctx.query());
    const rows = CHARACTERS.map((character) => {
      const entry = ASSETS[character.sprite];
      if (entry?.kind !== 'sheet') throw new Error(`Missing sheet ${character.sprite}`);
      return { label: character.name, key: character.sprite, atlas: entry.atlas };
    });
    for (const [index, review] of [
      { rows, height: 64 },
      { rows: rows.slice(0, 5), height: 128 },
      { rows: rows.slice(5), height: 128 },
    ].entries()) {
      await ctx.page.evaluate(async ({ rows, height }) => {
        document.getElementById('walk-review')?.remove();
        const host = document.createElement('div');
        host.id = 'walk-review';
        host.style.cssText =
          'position:fixed;inset:0;z-index:99999;background:#efe5cf;color:#32251b;padding:20px;font:16px system-ui;overflow:hidden';
        const heading = document.createElement('h2');
        heading.textContent = `Hero walks · ${height === 64 ? 'game size' : 'enlarged'} · idle / east 1–4 / west 1–4`;
        host.append(heading);
        for (const row of rows) {
          const atlasUrl = new URL(row.atlas, document.baseURI);
          const atlas = (await fetch(atlasUrl).then((r) => r.json())) as {
            frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
            meta: { image: string };
          };
          const image = new Image();
          image.src = new URL(atlas.meta.image, atlasUrl).href;
          await image.decode();
          const line = document.createElement('div');
          line.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:8px';
          const label = document.createElement('span');
          label.textContent = row.label;
          label.style.cssText = 'width:100px;flex:none';
          line.append(label);
          for (let i = 0; i < 9; i++) {
            const rect =
              atlas.frames[`${row.key}/${i === 0 ? 'idle/0' : `walk/${(i - 1) % 4}`}`]?.frame;
            if (!rect) throw new Error(`Missing walk ${row.key}`);
            const canvas = document.createElement('canvas');
            canvas.width = Math.round((height * 2) / 3);
            canvas.height = height;
            const paint = canvas.getContext('2d');
            if (!paint) throw new Error('Missing review canvas');
            paint.strokeStyle = '#b7a789';
            paint.beginPath();
            paint.moveTo(0, height * 0.85);
            paint.lineTo(canvas.width, height * 0.85);
            paint.stroke();
            if (i >= 5) {
              paint.translate(canvas.width, 0);
              paint.scale(-1, 1);
            }
            paint.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, canvas.width, height);
            line.append(canvas);
          }
          host.append(line);
        }
        document.body.append(host);
      }, review);
      await ctx.shoot(this.note, `${index}`);
    }
  },
};

export const HERO_WALK_BEATS: readonly Beat[] = [
  CONTACT,
  ...GROUPS.flatMap((party, group) =>
    (['east', 'west'] as const).map((direction): Beat => ({
      id: `35-hero-walk-${group + 1}-${direction}`,
      title: `Hero walk to idle: party ${group + 1} ${direction}`,
      note: 'All four lateral cels through the production animator, followed by a stable idle on the same foot anchor.',
      projects: ['surface-canvas', 'surface-webgl'],
      async run(ctx) {
        await resetStorage(ctx.page, ctx.query());
        const ids = party.map((name) => {
          const character = CHARACTERS.find((c) => c.sprite.endsWith(`.${name}`));
          if (!character) throw new Error(`Unknown hero ${name}`);
          return character.id;
        });
        await startGame(ctx.page, ['Explorer'], ids, 'hero-walk-review', {
          reduceMotion: false,
        });
        await enterNode(ctx.page, 'battle_forest_road');
        await takeTurn(ctx.page);
        await waitForIdle(ctx.page);
        await settleLayout(ctx.page, ctx.settleTimeout);
        await ctx.page.evaluate(
          async (names) => {
            await Promise.all(
              names.map(async (name) => {
                const image = new Image();
                image.src = new URL(`art/units/walking-${name}.png`, document.baseURI).href;
                await image.decode();
              }),
            );
          },
          [...party],
        );
        // Combat walks ease in/out: sample more tightly around mid-travel
        // so the distance-based clock visits each cel rather than both contacts twice.
        await ctx.filmstrip(this.note, [70, 100, 125, 165, 360], async () => {
          await ctx.page.evaluate((direction) => {
            const app = window.fnt!.app;
            const state = app.state;
            const battle = state?.battle;
            if (!state || !battle) throw new Error('Expected battle');
            const party = battle.units.filter((u) => u.faction === 'party');
            const sign = direction === 'east' ? 1 : -1;
            const fromX = sign === 1 ? 8 : 10;
            const before = battle.units.map((u) => {
              const index = party.findIndex((hero) => hero.id === u.id);
              return index < 0 ? u : { ...u, pos: { x: fromX, y: 4 + index } };
            });
            app.state = {
              ...state,
              battle: {
                ...battle,
                units: before.map((u) =>
                  u.faction === 'party' ? { ...u, pos: { ...u.pos, x: fromX + sign * 2 } } : u,
                ),
              },
            };
            app.resync();
            app.animator.clear();
            // Independent pushes begin together; the reducer is not modified by a gallery setup.
            for (const hero of before.filter((u) => u.faction === 'party')) {
              app.animator.push(
                performance.now(),
                [
                  {
                    type: 'unitMoved',
                    unitId: hero.id,
                    path: [1, 2].map((step) => ({ x: fromX + sign * step, y: hero.pos.y })),
                    cost: 2,
                  },
                ],
                before,
                { alongside: hero.id !== party[0]?.id },
              );
            }
          }, direction);
        });
      },
    })),
  ),
];
