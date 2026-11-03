import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { Command, GameEvent, Vec2 } from '../src/core/types';
import type { MapView } from '../src/render/view';
import { allowSoftwareWebgl } from './budget';
import { paintedTileCentre } from './projection';
import { enterNode, resetStorage, startGame } from './helpers';

interface WalkAudit {
  truncated: boolean;
  inputs: { command: Command; events: readonly GameEvent[] }[];
  frames: {
    party: Vec2;
    gao: Vec2;
    moving: boolean;
    clip: string | undefined;
    units: { id: string; pos: Vec2 }[];
    people: { id: string; pos: Vec2 }[];
  }[];
}
type AuditedWindow = Window & { npcWalkAudit?: WalkAudit };

for (const renderer of ['canvas', 'webgl'] as const) {
  for (const partySize of [1, 3, 6] as const) {
    test(`approaching Mira keeps people clear (${renderer}, ${partySize} people)`, async ({
      page,
    }, testInfo) => {
      allowSoftwareWebgl(test, renderer);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await resetStorage(page, `?renderer=${renderer}`);
      const characters = ['kaya', 'sura', 'bo', 'wen', 'nima', 'jinu'].slice(0, partySize);
      await startGame(page, characters, characters, 'npc-collision-discovery', {
        reduceMotion: false,
      });
      await enterNode(page, 'village_explore');
      await expect(page.locator('.explore-scene .map-canvas')).toBeVisible();
      await waitForSettledParty(page, testInfo);

      // Pan using real controls, then walk to the west side of Gao. No clock,
      // location, NPC, animation or collision data is substituted by this probe.
      const box = await page.locator('.map-canvas').boundingBox();
      if (!box) throw new Error('Village canvas is unavailable');
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 - 600, box.y + box.height / 2, {
        steps: 5,
      });
      await page.mouse.up();
      const clickGroundPoint = async (tile: Vec2) => {
        const point = await paintedTileCentre(page, tile);
        if (!point) throw new Error('Canvas camera is unavailable');
        expect(
          await page.evaluate(
            (point) => document.elementFromPoint(point.x, point.y)?.matches('.map-canvas'),
            point,
          ),
        ).toBe(true);
        await page.mouse.click(point.x, point.y);
      };
      await clickGroundPoint({ x: 8, y: 4 });
      await waitForSettledParty(page, testInfo);
      expect(await page.evaluate(() => window.fnt!.app.state!.location.pos)).toEqual({
        x: 8,
        y: 4,
      });

      // Forward every call unchanged. Sample the actual view delivered to the
      // selected backend, rather than treating logical arrival as drawn motion.
      await page.evaluate(() => {
        const app = window.fnt!.app;
        const audit: WalkAudit = { inputs: [], frames: [], truncated: false };
        (window as AuditedWindow).npcWalkAudit = audit;
        const dispatch = app.dispatch.bind(app);
        app.dispatch = (command) => {
          const events = dispatch(command);
          audit.inputs.push({ command, events });
          return events;
        };
        const scene = (app as unknown as { scene: { renderer: { draw: (view: MapView) => void } } })
          .scene;
        const draw = scene.renderer.draw.bind(scene.renderer);
        scene.renderer.draw = (view) => {
          const leader = view.units.find((unit) => unit.id === app.state!.party[0]?.id);
          const gao = view.npcs.find((npc) => npc.id === 'lw.npc.gao');
          if (leader && gao && audit.frames.length >= 20_000) audit.truncated = true;
          else if (leader && gao)
            audit.frames.push({
              party: leader.renderPos ?? leader.pos,
              gao: gao.renderPos ?? gao.pos,
              moving: Boolean(leader.renderPos),
              clip: leader.clip,
              units: view.units.map((unit) => ({ id: unit.id, pos: unit.renderPos ?? unit.pos })),
              people: view.npcs
                .filter((npc) => npc.id !== 'riverside_sign')
                .map((npc) => ({ id: npc.id, pos: npc.renderPos ?? npc.pos })),
            });
          draw(view);
        };
      });

      // Mira's upright covers this projected ground point. Assert the actual
      // dispatched NPC tile below: this is an approach, not a ground10,4 test.
      await clickGroundPoint({ x: 10, y: 4 });
      await waitForSettledParty(page, testInfo);
      await expect(page.locator('.conversation-panel')).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath('mira-arrival.png') });
      const report = await page.evaluate(() => ({
        ...((window as AuditedWindow).npcWalkAudit ?? { inputs: [], frames: [], truncated: false }),
        location: window.fnt!.app.state!.location,
        node: window.fnt!.app.state!.story.nodeId,
        backend: window.fnt!.app.rendererBackend(),
        reduceMotion: window.fnt!.app.settings.reduceMotion,
      }));
      const moves = report.inputs.filter((input) => input.command.type === 'walkTo');
      const walk = moves
        .flatMap((input) => input.events)
        .find((event) => event.type === 'partyWalked');
      const moving = report.frames.filter((frame) => frame.moving);
      const minimumDrawnDistance = Math.min(
        ...moving.map((frame) =>
          Math.hypot(frame.party.x - frame.gao.x, frame.party.y - frame.gao.y),
        ),
      );
      let minimumPartyDistance = Infinity;
      let minimumPersonDistance = Infinity;
      for (const frame of report.frames) {
        for (let i = 0; i < frame.units.length; i++) {
          const unit = frame.units[i];
          if (!unit) continue;
          for (const other of frame.units.slice(i + 1))
            minimumPartyDistance = Math.min(
              minimumPartyDistance,
              Math.hypot(unit.pos.x - other.pos.x, unit.pos.y - other.pos.y),
            );
          for (const person of frame.people)
            minimumPersonDistance = Math.min(
              minimumPersonDistance,
              Math.hypot(unit.pos.x - person.pos.x, unit.pos.y - person.pos.y),
            );
        }
      }
      await testInfo.attach('actual-input-route-and-rendered-motion', {
        body: JSON.stringify(
          { ...report, minimumDrawnDistance, minimumPartyDistance, minimumPersonDistance, errors },
          null,
          2,
        ),
        contentType: 'application/json',
      });
      expect(report.backend).toBe(renderer);
      expect(report.truncated, 'Capture must include the complete movement and gathering').toBe(
        false,
      );
      expect(report.reduceMotion).toBe(false);
      expect(moves.map((input) => input.command)).toEqual([
        { type: 'walkTo', pos: { x: 11, y: 5 } },
      ]);
      expect(walk).toBeDefined();
      expect(report.node).toBe('mira_intro');
      expect(report.location.pos).toEqual({ x: 10, y: 5 });
      expect(
        moving.length,
        'The real backend must receive intermediate walking frames',
      ).toBeGreaterThan(0);
      // Both checks are needed: a safe discrete path must also stay clear while
      // its normal curved playback is drawn. Half a tile excludes entering the
      // centre half-cell around Gao; it does not claim sprite/art acceptance.
      expect
        .soft(walk?.type === 'partyWalked' && walk.path.some((p) => p.x === 9 && p.y === 4))
        .toBe(false);
      expect.soft(minimumDrawnDistance).toBeGreaterThanOrEqual(0.5);
      // Same native spacing floor as party-spacing.spec.ts; validate every
      // follower through waits, walks and the final gathering, not just the leader.
      if (partySize > 1) expect.soft(minimumPartyDistance).toBeGreaterThanOrEqual(0.78);
      expect.soft(minimumPersonDistance).toBeGreaterThanOrEqual(0.5);
      expect(errors).toEqual([]);
    });
  }
}

/** Idle gaps before gathering do not mean that the party has finished settling. */
async function waitForSettledParty(page: Page, testInfo: TestInfo): Promise<void> {
  try {
    await page.waitForFunction(
      () => {
        const app = window.fnt!.app;
        const scene = (app as unknown as { scene: { needsSettle: boolean } }).scene;
        return !app.animator.busy(performance.now()) && !scene.needsSettle;
      },
      undefined,
      { timeout: 20_000 },
    );
  } catch (error) {
    const diagnostic = await page
      .evaluate(() => {
        const app = window.fnt!.app;
        return {
          audit: (window as AuditedWindow).npcWalkAudit,
          location: app.state!.location,
          node: app.state!.story.nodeId,
          now: performance.now(),
          finishesAt: app.animator.finishesAt,
          backend: app.rendererBackend(),
        };
      })
      .catch((captureError: unknown) => ({ captureError: String(captureError) }));
    await testInfo.attach('unchanged-settlement-deadline', {
      body: JSON.stringify(diagnostic, null, 2),
      contentType: 'application/json',
    });
    throw error;
  }
}
