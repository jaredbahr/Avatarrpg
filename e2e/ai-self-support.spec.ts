import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { CONTENT } from '../src/content';
import { deserialize, serialize, stateFromBlob } from '../src/core/save/serialize';
import { createGame } from '../src/core/state/createGame';
import { apply } from '../src/core/state/reducer';
import { xpForLevel } from '../src/core/rules/leveling';
import { tileAt } from '../src/core/rules/grid';
import type { MapView } from '../src/render/view';
import { resetStorage, settleMapCanvas, takeTurn, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

interface SupportRenderProbe {
  castFrames: number;
  frame: string | null;
  clipTime: number | null;
}

interface SupportWindow {
  supportRenderProbe: SupportRenderProbe;
}

interface SupportScene {
  renderer: { draw(view: MapView): void };
  holdAi(): void;
  releaseAi(): void;
}

/** Supported isolated combat checkpoint, not a completed six-player campaign. */
function checkpoint(actor: 'sergeant' | 'healer') {
  const fresh = createGame(CONTENT, {
    seed: 'ai-self-support-558',
    startNode: 'village_explore',
    party: ['kaya', 'nilak', 'bo', 'tenzo', 'lin_mei', 'nima'].map((characterId) => ({
      characterId,
      level: 2,
    })),
  });
  // Consistent supported-save level boundaries; these levels were not earned here.
  const ready = {
    ...fresh,
    party: fresh.party.map((unit) => ({ ...unit, xp: xpForLevel(unit.level) })),
  };
  const entered = apply(CONTENT, ready, { type: 'enterNode', nodeId: 'battle_ambush' }).state;
  const battle = entered.battle;
  const authoredSergeant = battle?.units.find((unit) => unit.enemyId === 'merc_sergeant');
  const healer = battle?.units.find((unit) => unit.characterId === 'nilak');
  if (!battle || !authoredSergeant || !healer)
    throw new Error('Missing authored ambush support units');
  const sergeant = { ...authoredSergeant, pos: { x: 14, y: 6 }, move: 0 };
  const ground = tileAt(battle.grid, sergeant.pos);
  if (!ground || ground.blocked || ground.surface)
    throw new Error('The isolated support checkpoint must be clear authored ground');
  // Keep the authored board and Sergeant kit. Stage it on an interior tile,
  // remove other AI actors and its movement budget to isolate self-support.
  const units = battle.units
    .filter((unit) => unit.faction === 'party' || unit.id === sergeant.id)
    .map((unit) =>
      unit.id === sergeant.id
        ? sergeant
        : actor === 'healer' && unit.id === healer.id
          ? { ...unit, hp: 1 }
          : unit,
    );
  const active = actor === 'sergeant' ? sergeant.id : healer.id;
  const state = {
    ...entered,
    battle: {
      ...battle,
      units,
      order: [active, ...units.filter((unit) => unit.id !== active).map((unit) => unit.id)],
      turnIndex: 0,
    },
  };
  const session = { players: [{ name: 'Support controls', unitId: healer.id }], soloPlay: true };
  const parsed = deserialize(
    serialize(state, {
      label: `Isolated ${actor} support checkpoint`,
      summary: 'Supported combat fixture; no campaign or encounter-balance claim',
      savedAt: 1_700_000_000_000,
      session,
    }),
  );
  if (!parsed.ok) throw new Error(parsed.error);
  expect(stateFromBlob(parsed.blob)).toEqual(state);
  return { state, session: parsed.blob.session, sergeant, healer };
}

test('an isolated authored Sergeant takes its legal self-Rally turn', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const fixture = checkpoint('sergeant');
  const expected = apply(CONTENT, fixture.state, { type: 'runAiTurn' });
  await resetStorage(page, '?renderer=canvas');
  await page.evaluate(({ state, session, sergeant }) => {
    const app = window.fnt!.app;
    app.updateSettings({ reduceMotion: false });
    app.adoptSave(state, session);
    const scene = (app as unknown as { scene: SupportScene }).scene;
    // Hold presentation scheduling while the real Focus control brings the
    // isolated actor on screen. This does not establish automatic framing.
    scene.holdAi();
    const probe: SupportRenderProbe = { castFrames: 0, frame: null, clipTime: null };
    (window as unknown as SupportWindow).supportRenderProbe = probe;
    const draw = scene.renderer.draw.bind(scene.renderer);
    // Forward the unchanged real frame, then retain its cast evidence. A host
    // poll may arrive after the short pose; it must not erase a rendered cast.
    scene.renderer.draw = (view: MapView) => {
      draw(view);
      const actor = view.units.find((unit) => unit.id === sergeant.id);
      if (actor?.clip !== 'cast') return;
      probe.castFrames += 1;
      if (probe.frame || (actor.clipTime ?? 0) < 80) return;
      const canvas = document.querySelector<HTMLCanvasElement>('canvas.map-canvas');
      if (!canvas) throw new Error('Missing actual combat canvas');
      probe.frame = canvas.toDataURL('image/png');
      probe.clipTime = actor.clipTime ?? null;
    };
  }, fixture);
  await expect(page.locator('canvas.map-canvas')).toBeVisible();
  await page.getByRole('button', { name: `Focus ${fixture.sergeant.name}`, exact: true }).click();
  await page.waitForLoadState('networkidle');
  await waitForIdle(page);
  await settleMapCanvas(page);
  const focused = await paintedTileCentre(page, fixture.sergeant.pos);
  if (!focused) throw new Error('Missing focused Sergeant tile');
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, focused)).toBe(
    'CANVAS',
  );
  await page.evaluate(() => {
    (window.fnt!.app as unknown as { scene: SupportScene }).scene.releaseAi();
  });
  await expect
    .poll(() =>
      page.evaluate(
        (id) =>
          window
            .fnt!.app.state?.battle?.units.find((unit) => unit.id === id)
            ?.statuses.some((status) => status.id === 'inspired') ?? false,
        fixture.sergeant.id,
      ),
    )
    .toBe(true);
  expect(expected.events.filter((event) => event.type === 'abilityUsed')).toEqual([
    {
      type: 'abilityUsed',
      unitId: fixture.sergeant.id,
      abilityId: 'rally',
      target: fixture.sergeant.pos,
      tiles: [fixture.sergeant.pos],
    },
  ]);
  await expect
    .poll(() =>
      page.evaluate(() => Boolean((window as unknown as SupportWindow).supportRenderProbe.frame)),
    )
    .toBe(true);
  const rendered = await page.evaluate(
    () => (window as unknown as SupportWindow).supportRenderProbe,
  );
  expect(rendered.castFrames).toBeGreaterThan(0);
  if (!rendered.frame) throw new Error('No actual rendered Rally cast capture');
  const cast = info.outputPath('sergeant-self-rally-cast.png');
  await writeFile(cast, Buffer.from(rendered.frame.split(',')[1] ?? '', 'base64'));
  await info.attach('sergeant-self-rally-cast', { path: cast, contentType: 'image/png' });
  await info.attach('sergeant-self-rally-render-observation', {
    body: JSON.stringify({ castFrames: rendered.castFrames, clipTime: rendered.clipTime }),
    contentType: 'application/json',
  });
  expect(await takeTurn(page)).toBe(true);
  await waitForIdle(page);
  expect(await page.evaluate(() => window.fnt!.app.state)).toEqual(expected.state);
  expect(expected.state.log.some((line) => line.includes('Mercenary Sergeant uses Rally'))).toBe(
    true,
  );
  expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe('canvas');
  const settled = info.outputPath('sergeant-self-rally-settled.png');
  await page.screenshot({ path: settled });
  await info.attach('sergeant-self-rally-settled', { path: settled, contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test('the player still heals their own unit through the real targeting controls', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const fixture = checkpoint('healer');
  await resetStorage(page, '?renderer=canvas');
  await page.evaluate(({ state, session }) => {
    const app = window.fnt!.app;
    app.updateSettings({ reduceMotion: false });
    app.adoptSave(state, session);
  }, fixture);
  expect(await takeTurn(page)).toBe(true);
  await waitForIdle(page);
  const before = await page.evaluate(() => window.fnt!.app.state!);
  const healer = before.battle?.units.find((unit) => unit.id === fixture.healer.id);
  if (!healer) throw new Error('The healer is missing');
  const expected = apply(CONTENT, before, {
    type: 'useAbility',
    unitId: healer.id,
    abilityId: 'healing_stream',
    target: healer.pos,
  });
  await page.getByRole('button', { name: /^Healing Stream/ }).click();
  await settleMapCanvas(page);
  const target = await paintedTileCentre(page, healer.pos);
  if (!target) throw new Error('Missing painted healer tile');
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, target)).toBe(
    'CANVAS',
  );
  await page.mouse.click(target.x, target.y);
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await waitForIdle(page);
  expect(await page.evaluate(() => window.fnt!.app.state)).toEqual(expected.state);
  expect(expected.state.battle?.units.find((unit) => unit.id === healer.id)?.hp).toBeGreaterThan(1);
  const capture = info.outputPath('player-self-heal-control.png');
  await page.screenshot({ path: capture });
  await info.attach('player-self-heal-control', { path: capture, contentType: 'image/png' });
  expect(errors).toEqual([]);
});
