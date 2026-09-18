import type { Beat, BeatContext } from './beats';
import {
  enterNode,
  resetStorage,
  settleLayout,
  startGame,
  takeTurn,
  waitForIdle,
} from '../helpers';
import { tileCentre } from './stage';

async function openGrumbler(ctx: BeatContext): Promise<void> {
  await resetStorage(ctx.page, ctx.query());
  await startGame(ctx.page, ['Explorer'], ['kaya', 'bo', 'wen'], 'grumbler-art', {
    reduceMotion: false,
  });
  await ctx.page.evaluate(() => window.fnt!.app.updateSettings({ showGrid: true }));
  await enterNode(ctx.page, 'battle_grumbler');
  await takeTurn(ctx.page);
  await waitForIdle(ctx.page);
  await settleLayout(ctx.page, ctx.settleTimeout);
}

export const GRUMBLER_BEATS: readonly Beat[] = [
  {
    id: '36-grumbler-portrait',
    title: 'Quarry driller: matching machine portrait and battlefield art',
    note: 'The amber cab, rust armor, brass hinges and steel drill identify the same machine in the turn strip, inspector and two-tile board footprint.',
    projects: ['surface-canvas', 'surface-webgl', 'ipad-canvas', 'ipad-webgl', 'portrait-canvas'],
    async run(ctx) {
      await openGrumbler(ctx);
      await ctx.shoot('The two-tile machine stands on the quarry floor beside the party.', 'floor');
      const pos = await ctx.page.evaluate(() => {
        const boss = window.fnt?.app.state?.battle?.units.find(
          (u) => u.sprite === 'unit.enemy.grumbler',
        );
        if (!boss) throw new Error('Missing Grumbler');
        return boss.pos;
      });
      const point = await tileCentre(ctx.page, pos);
      await ctx.page.mouse.click(point.x, point.y, { button: 'right' });
      await ctx.page.locator('.dialog canvas[data-asset="portrait.enemy.grumbler"]').waitFor();
      // Review the portrait at the top; initial Close-button focus currently
      // scrolls this unusually long inspector to its end (reported to UI owner).
      await ctx.page.evaluate(async () => {
        const panel = document.querySelector<HTMLElement>('.dialog');
        if (!panel) throw new Error('Missing inspector');
        await Promise.all(
          panel.getAnimations({ subtree: true }).map((animation) => animation.finished),
        );
        panel.scrollTop = 0;
      });
      await ctx.shoot(this.note, 'inspector');
    },
  },
  {
    id: '36-grumbler-motion',
    title: 'Quarry driller: tread movement, hydraulic strike and settling',
    note: 'The same chassis rolls one tile, braces, lowers the drill for release, then settles onto its track baseline. The animator still owns effects and sound cues.',
    projects: ['surface-canvas', 'surface-webgl'],
    async run(ctx) {
      await openGrumbler(ctx);
      await ctx.page.evaluate(async () => {
        const image = new Image();
        image.src = new URL('art/units/grumbler.png', document.baseURI).href;
        await image.decode();
      });
      await ctx.filmstrip(this.note, [60, 180, 330, 460, 620, 900], async () => {
        await ctx.page.evaluate(() => {
          const app = window.fnt!.app;
          const state = app.state;
          const battle = state?.battle;
          const boss = battle?.units.find((u) => u.sprite === 'unit.enemy.grumbler');
          const hero = battle?.units.find((u) => u.faction === 'party');
          if (!state || !battle || !boss || !hero) throw new Error('Missing quarry actors');
          const from = { x: 11, y: 5 };
          const to = { x: 10, y: 5 };
          const target = { x: 9, y: 5 };
          const before = battle.units.map((u) =>
            u.id === boss.id ? { ...u, pos: from } : u.id === hero.id ? { ...u, pos: target } : u,
          );
          app.state = {
            ...state,
            battle: {
              ...battle,
              units: before.map((u) => (u.id === boss.id ? { ...u, pos: to } : u)),
            },
          };
          app.resync();
          app.animator.clear();
          app.animator.push(
            performance.now(),
            [
              { type: 'unitMoved', unitId: boss.id, path: [to], cost: 1 },
              {
                type: 'abilityUsed',
                unitId: boss.id,
                abilityId: 'driller_slam',
                target,
                tiles: [target],
              },
            ],
            before,
          );
        });
      });
    },
  },
  {
    id: '36-grumbler-shutdown',
    title: 'Quarry driller: powered-down cab and lowered drill',
    note: 'The KO cel darkens the cab and lowers the drill while the existing animator supplies settling and fading.',
    projects: ['surface-canvas', 'surface-webgl'],
    async run(ctx) {
      await openGrumbler(ctx);
      await ctx.filmstrip(this.note, [90, 200, 360], async () => {
        await ctx.page.evaluate(() => {
          const app = window.fnt!.app;
          const state = app.state;
          const battle = state?.battle;
          const boss = battle?.units.find((u) => u.sprite === 'unit.enemy.grumbler');
          if (!state || !battle || !boss) throw new Error('Missing Grumbler');
          app.state = {
            ...state,
            battle: {
              ...battle,
              units: battle.units.map((u) => (u.id === boss.id ? { ...u, hp: 0 } : u)),
            },
          };
          app.animator.clear();
          app.animator.push(
            performance.now(),
            [{ type: 'unitDied', unitId: boss.id }],
            battle.units,
          );
          app.resync();
        });
      });
    },
  },
  {
    id: '36-grumbler-fallback',
    title: 'Quarry driller remains a machine when its atlas cannot load',
    note: 'The real Grumbler atlas request is blocked. Its original two-tile driller painter must remain visible, correctly grounded and recognizable.',
    projects: ['surface-canvas', 'surface-webgl'],
    async run(ctx) {
      await ctx.page.route('**/art/units/grumbler.*', (route) => route.abort());
      await openGrumbler(ctx);
      await ctx.shoot(this.note);
    },
  },
];
