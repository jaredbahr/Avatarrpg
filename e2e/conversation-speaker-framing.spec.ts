import { expect, test, type Page } from '@playwright/test';
import { CONTENT } from '../src/content';
import { apply } from '../src/core/state/reducer';
import type { GameState, Vec2 } from '../src/core/types';
import type { SessionMeta } from '../src/core/save/serialize';
import type { Camera } from '../src/render/camera';
import type { MapView, NpcMarker } from '../src/render/view';
import type { CameraInfo } from '../src/app/App';
import { allowSoftwareWebgl } from './budget';
import {
  enterNode,
  pauseClock,
  resetStorage,
  settleLayout,
  setLargeText,
  startGame,
  waitForIdle,
} from './helpers';

type Box = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};
interface Reading {
  now: number;
  state: GameState;
  session: SessionMeta;
  camera: CameraInfo | null;
  deviceScale: number;
  finishesAt: number;
  busy: boolean;
  moves: readonly unknown[];
  pin: GameState['world']['talk'];
  marker: NpcMarker | null;
  figure: { id: string; npcId: string | null; drawPos: Vec2; alpha: number } | null;
  canvas: Box;
  panel: Box | null;
  drawnBox: Box | null;
  draw: { method: string; attempted: boolean; frame: readonly number[]; image: string };
}
interface ReadSprite {
  visible: boolean;
  alpha: number;
  getBounds(): { x: number; y: number; width: number; height: number };
  texture: { frame: { x: number; y: number; width: number; height: number } };
}
interface ReadBackend {
  draw(view: MapView, camera: Camera): void;
  ctx?: CanvasRenderingContext2D;
  drawNpcs?(view: MapView, camera: Camera): void;
  unitSprites?: Map<string, ReadSprite>;
}
type AuditedWindow = Window & { speaker627?: { latest: Reading | null; frames: number } };

/** Observe real backend submissions, forwarding every render call unchanged. */
async function observeBackend(page: Page): Promise<void> {
  await page.evaluate(() => {
    const app = window.fnt!.app;
    const scene = (app as unknown as { scene: { renderer: { backend: ReadBackend } } }).scene;
    const backend = scene.renderer.backend;
    const canvas = document.querySelector<HTMLCanvasElement>('.explore-scene .map-canvas');
    if (!canvas) throw new Error('Missing actual exploration canvas');
    const audit = { latest: null as Reading | null, frames: 0 };
    (window as AuditedWindow).speaker627 = audit;
    const boxes = new Map<string, { box: Box; frame: number[]; image: string }>();
    const attempted = new Set<string>();
    let current: NpcMarker | null = null;
    const rect = (r: { x: number; y: number; width: number; height: number }): Box => ({
      left: r.x,
      top: r.y,
      right: r.x + r.width,
      bottom: r.y + r.height,
      width: r.width,
      height: r.height,
    });

    if (backend.ctx && backend.drawNpcs) {
      const ctx = backend.ctx;
      const image = ctx.drawImage.bind(ctx);
      // Topdown drawOccupants invokes drawNpcs once per actual NPC. The first
      // main-context image in that call is its body; talk-pip images follow it.
      const npcs = backend.drawNpcs.bind(backend);
      backend.drawNpcs = (view, camera) => {
        current = view.npcs.length === 1 ? (view.npcs[0] ?? null) : null;
        if (current) attempted.add(current.id);
        try {
          npcs(view, camera);
        } finally {
          current = null;
        }
      };
      ctx.drawImage = ((...args: unknown[]) => {
        if (current && !boxes.has(current.id) && (args.length === 9 || args.length === 5)) {
          const offset = args.length === 9 ? 5 : 1;
          const [x, y, width, height] = args.slice(offset, offset + 4) as [
            number,
            number,
            number,
            number,
          ];
          const matrix = ctx.getTransform();
          const points = [
            [x, y],
            [x + width, y],
            [x, y + height],
            [x + width, y + height],
          ].map(([px, py]) => matrix.transformPoint({ x: px, y: py }));
          const css = canvas.getBoundingClientRect();
          const xs = points.map((p) => css.left + (p.x * css.width) / canvas.width);
          const ys = points.map((p) => css.top + (p.y * css.height) / canvas.height);
          const left = Math.min(...xs),
            top = Math.min(...ys);
          const source = args[0];
          boxes.set(current.id, {
            box: rect({
              x: left,
              y: top,
              width: Math.max(...xs) - left,
              height: Math.max(...ys) - top,
            }),
            frame: args.length === 9 ? (args.slice(1, 5) as number[]) : [],
            image: source instanceof HTMLImageElement ? source.currentSrc : 'canvas-body',
          });
        }
        Reflect.apply(image, ctx, args);
      }) as typeof ctx.drawImage;
    }

    const draw = backend.draw.bind(backend);
    backend.draw = (view, camera) => {
      boxes.clear();
      attempted.clear();
      draw(view, camera);
      const state = app.state;
      if (!state) return;
      const pin = state.world.talk;
      const figure =
        pin?.mapId === state.location.mapId
          ? app.residents.figures().find((who) => who.npcId === pin.npcId)
          : undefined;
      const marker =
        pin?.mapId === state.location.mapId
          ? view.npcs.find((npc) => npc.id === (figure?.id ?? pin.npcId))
          : undefined;
      const css = canvas.getBoundingClientRect();
      const panel = document.querySelector<HTMLElement>(
        '.explore-conversation .conversation-panel',
      );
      let body = marker ? boxes.get(marker.id) : undefined;
      let method = 'canvas-drawImage';
      let tried = marker ? attempted.has(marker.id) : false;
      if (backend.unitSprites && marker) {
        method = 'pixi-getBounds';
        const sprite = backend.unitSprites.get(`npc:${marker.id}`);
        tried = Boolean(sprite);
        if (sprite?.visible && sprite.alpha > 0) {
          const box = sprite.getBounds();
          const f = sprite.texture.frame;
          body = {
            box: rect({
              x: css.left + (box.x * css.width) / camera.viewport.width,
              y: css.top + (box.y * css.height) / camera.viewport.height,
              width: (box.width * css.width) / camera.viewport.width,
              height: (box.height * css.height) / camera.viewport.height,
            }),
            frame: [f.x, f.y, f.width, f.height],
            image: 'actual-pixi-texture',
          };
        }
      }
      const tracks = (app.animator as unknown as { timeline: { tracks: readonly unknown[] } })
        .timeline.tracks;
      audit.latest = {
        now: view.time,
        state,
        session: app.session.toMeta(),
        camera: app.rendererCamera(),
        deviceScale: camera.deviceScale,
        finishesAt: app.animator.finishesAt,
        busy: app.animator.busy(view.time),
        moves: tracks.filter((track) => (track as { kind: string }).kind === 'move'),
        pin,
        marker: marker ?? null,
        figure: figure
          ? { id: figure.id, npcId: figure.npcId, drawPos: figure.drawPos, alpha: figure.alpha }
          : null,
        canvas: rect(css),
        panel: panel && panel.getClientRects().length ? rect(panel.getBoundingClientRect()) : null,
        drawnBox: body?.box ?? null,
        draw: { method, attempted: tried, frame: body?.frame ?? [], image: body?.image ?? '' },
      };
      audit.frames++;
    };
  });
}

async function readFrame(
  page: Page,
  label: string,
  scale: number,
  expectedNpcId: 'kid_pella' | 'guard_dorin' = 'kid_pella',
) {
  const reading = await page.evaluate(() => (window as AuditedWindow).speaker627?.latest ?? null);
  if (!reading) throw new Error('No actual backend frame observed');
  expect(reading.pin?.mapId).toBe('ba_dan_village');
  expect(reading.pin?.npcId).toBe(expectedNpcId);
  expect(reading.figure?.npcId).toBe(expectedNpcId);
  expect(reading.marker?.id).toBe(reading.figure?.id);
  expect(reading.marker?.renderPos ?? reading.marker?.pos).toEqual(reading.figure?.drawPos);
  expect(reading.figure?.alpha).toBe(1);
  expect(reading.camera?.projection).toBe('topdown');
  expect(reading.deviceScale).toBe(scale);
  expect(Number.isInteger(reading.deviceScale)).toBe(true);
  expect(reading.draw.attempted).toBe(true);
  expect(reading.panel).not.toBeNull();
  const box = reading.drawnBox,
    panel = reading.panel!,
    canvas = reading.canvas;
  // Strict full SPRITE bounds, from actual drawImage transforms/getBounds.
  // No footpoint/portrait/framing-helper proxy, overlap allowance or extra
  // breathing-room requirement. Soft only so baseline controls still finish.
  expect
    .soft(
      Boolean(
        box &&
        box.width > 0 &&
        box.height > 0 &&
        box.left >= canvas.left &&
        box.right <= canvas.right &&
        box.top >= canvas.top &&
        box.bottom <= canvas.bottom &&
        box.bottom <= panel.top,
      ),
      `${label}: entire actual ${expectedNpcId === 'kid_pella' ? 'Pella' : 'Dorin'} sprite is above the panel and inside the canvas`,
    )
    .toBe(true);
  return { label, ...reading };
}

async function domain(page: Page) {
  return page.evaluate(() => {
    const app = window.fnt!.app;
    if (!app.state) throw new Error('No game state');
    return { state: app.state, session: app.session.toMeta(), finishesAt: app.animator.finishesAt };
  });
}

async function fixture(page: Page, renderer: string) {
  await resetStorage(page, `?style=topdown&renderer=${renderer}`);
  await startGame(page, ['One', 'Two', 'Three'], ['kaya', 'sura', 'bo'], 'speaker-frame-627', {
    reduceMotion: false,
  });
  await enterNode(page, 'village_explore');
  await waitForIdle(page);
  await settleLayout(page);
  const setup = await page.evaluate(() => {
    const app = window.fnt!.app,
      state = app.state!;
    const pella = app.residents.figures().find((who) => who.npcId === 'kid_pella');
    const map = app.content.maps.get(state.location.mapId);
    if (!pella?.pos || !map) throw new Error('Canonical Pella placement unavailable');
    const candidates = (
      [
        [0, -2],
        [-2, 0],
        [2, 0],
        [0, 2],
      ] as const
    ).map(([x, y]) => ({ x: pella.pos!.x + x, y: pella.pos!.y + y }));
    const pos = candidates.find((p) => {
      const symbol = map.rows[p.y]?.[p.x];
      return (
        symbol !== undefined &&
        map.legend[symbol]?.blocked !== true &&
        !app.residents.figures().some((who) => who.pos?.x === p.x && who.pos?.y === p.y)
      );
    });
    if (!pos) throw new Error('No valid two-tile Pella approach fixture');
    // Supported public reconciliation, using real current-game data. Only the
    // initial approach position is staged; no actor, pin or outcome is made up.
    app.adoptSave({ ...state, location: { ...state.location, pos } }, app.session.toMeta());
    return {
      pos,
      pella: pella.pos,
      limits: 'Supported reconciled approach-position fixture, not a browser-earned campaign.',
    };
  });
  await waitForIdle(page);
  await settleLayout(page);
  // Party idleness does not imply resident arrival. Wait on the normal clock,
  // before Look around freezes residents, so Visit takes the direct talk path.
  await page.waitForFunction(
    (target) => {
      const app = window.fnt!.app;
      const figure = app.residents
        .figures()
        .find((who) => who.id === 'lw.npc.pella' && who.npcId === 'kid_pella');
      if (
        !figure ||
        figure.walking ||
        figure.alpha !== 1 ||
        !figure.pos ||
        figure.pos.x !== target.x ||
        figure.pos.y !== target.y ||
        figure.drawPos.x !== target.x ||
        figure.drawPos.y !== target.y
      )
        return false;
      // walkingTo can request a resident's return; never call it until the
      // observed figure is already completely home at the canonical target.
      return !app.residents.walkingTo(target);
    },
    setup.pella,
    { timeout: 20_000 },
  );
  const settledResident = await page.evaluate(() => {
    const app = window.fnt!.app;
    const scene = (app as unknown as { scene: { renderer: { lastView: MapView | null } } }).scene;
    return {
      figure: app.residents.figures().find((who) => who.id === 'lw.npc.pella') ?? null,
      submitted: scene.renderer.lastView?.npcs.find((npc) => npc.id === 'lw.npc.pella') ?? null,
    };
  });
  await expect(page.locator('.toast')).toHaveCount(0);
  expect((await domain(page)).state.location.pos).toEqual(setup.pos);
  await observeBackend(page);
  return { ...setup, settledResident };
}

for (const renderer of ['canvas', 'webgl'] as const) {
  for (const viewport of [
    { width: 1180, height: 820 },
    { width: 1366, height: 1024 },
  ]) {
    test(`topdown Pella sprite stays above conversation through talk/load/resize: ${renderer} ${viewport.width}x${viewport.height}`, async ({
      page,
    }, info) => {
      allowSoftwareWebgl(test, renderer);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewportSize(viewport);
      const setup = await fixture(page, renderer);
      expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe(renderer);
      const scale = await page.evaluate(() => {
        const scene = (window.fnt!.app as unknown as { scene: { renderer: { camera: Camera } } })
          .scene;
        return scene.renderer.camera.deviceScale;
      });
      await page.getByRole('button', { name: 'Look around', exact: true }).click();
      const nearby = page.getByRole('dialog', { name: 'Look around', exact: true });
      await expect(nearby.getByRole('button', { name: 'Visit Pella', exact: true })).toBeEnabled();
      await pauseClock(page);
      try {
        const before = await domain(page);
        const expectedTalk = apply(CONTENT, before.state, { type: 'walkTo', pos: setup.pella });
        expect(expectedTalk.events.some((event) => event.type === 'partyWalked')).toBe(true);
        await nearby.getByRole('button', { name: 'Visit Pella', exact: true }).click();
        const pendingPresentation = await domain(page);
        expect(pendingPresentation.state).toEqual(expectedTalk.state);
        expect(pendingPresentation.state.world.talk?.npcId).toBe('kid_pella');
        expect(pendingPresentation.session).toEqual(before.session);
        // App normally delays presentation until party playback finishes.
        // Exercise its documented public reconciliation hook early, without
        // changing state, actors, pins or tracks. This is presentation stress,
        // not an assertion about ordinary Visit timing.
        const reconciliation = await page.evaluate(() => {
          const app = window.fnt!.app;
          const sceneOf = () =>
            (
              app as unknown as {
                scene: { renderer: { backend: ReadBackend } };
              }
            ).scene;
          const tracks = () =>
            (
              app.animator as unknown as {
                timeline: { tracks: readonly unknown[] };
              }
            ).timeline.tracks.filter((track) => (track as { kind: string }).kind === 'move');
          const originalMoves = tracks();
          const renderer = sceneOf().renderer;
          const backend = renderer.backend;
          const cloned = () => ({
            now: performance.now(),
            state: structuredClone(app.state),
            session: structuredClone(app.session.toMeta()),
            // Preserve every move field; represent functions by their source
            // as evidence as well as checking the actual track identities.
            moves: JSON.parse(
              JSON.stringify(tracks(), (_key, value: unknown) =>
                typeof value === 'function' ? { functionSource: value.toString() } : value,
              ),
            ),
            finishesAt: app.animator.finishesAt,
            busy: app.animator.busy(performance.now()),
          });
          const before = cloned();
          if (!before.busy || !originalMoves.length || before.finishesAt <= before.now)
            throw new Error('Early presentation fixture requires genuine in-flight move tracks');
          app.resync();
          const after = cloned();
          const nextMoves = tracks();
          return {
            before,
            after,
            sameRenderer: sceneOf().renderer === renderer,
            sameBackend: sceneOf().renderer.backend === backend,
            sameMoveTracks:
              originalMoves.length === nextMoves.length &&
              originalMoves.every((track, index) => track === nextMoves[index]),
          };
        });
        expect(reconciliation.after).toEqual(reconciliation.before);
        expect(reconciliation.sameRenderer).toBe(true);
        expect(reconciliation.sameBackend).toBe(true);
        expect(reconciliation.sameMoveTracks).toBe(true);
        await expect(page.locator('.explore-conversation .conversation-panel')).toBeVisible();
        await page.clock.runFor(64);
        const approached = await readFrame(
          page,
          'early public presentation reconciliation during the real Visit route',
          scale,
        );
        expect(approached.state).toEqual(expectedTalk.state);
        expect(approached.session).toEqual(before.session);
        expect(approached.busy).toBe(true);
        expect(approached.finishesAt).toBeGreaterThan(approached.now);
        expect(approached.moves.length).toBeGreaterThan(0);
        const observations = [approached];
        await info.attach('real-pella-talk', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });

        const nextExpected = apply(CONTENT, approached.state, { type: 'advanceDialogue' });
        await page.locator('[data-conversation-control="next"]').click();
        await page.clock.runFor(32);
        const line = await readFrame(page, 'actual Next preserves pin and legal route', scale);
        expect(line.state).toEqual(nextExpected.state);
        expect(line.session).toEqual(approached.session);
        expect(line.state.rng).toBe(approached.state.rng);
        expect(line.finishesAt).toBe(approached.finishesAt);
        expect(line.moves).toEqual(approached.moves);
        observations.push(line);

        const other =
          viewport.width === 1180 ? { width: 1366, height: 1024 } : { width: 1180, height: 820 };
        await page.setViewportSize(other);
        await page.clock.runFor(64);
        const resized = await readFrame(
          page,
          'resize with the same pinned NPC and in-flight route',
          scale,
        );
        expect(resized.state).toEqual(line.state);
        expect(resized.session).toEqual(line.session);
        expect(resized.finishesAt).toBe(line.finishesAt);
        expect(resized.moves).toEqual(line.moves);
        observations.push(resized);
        await info.attach('resized-pella-talk', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });

        expect(await page.evaluate(() => window.fnt!.app.saveTo('auto'))).toBe(true);
        const saved = await domain(page);
        await page.clock.resume();
        await page.reload();
        await page.waitForFunction(() => Boolean(window.fnt?.app));
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        await observeBackend(page);
        await waitForIdle(page);
        await settleLayout(page);
        await pauseClock(page);
        const loaded = await readFrame(
          page,
          'actual Continue restores the canonical talk pin',
          scale,
        );
        expect(loaded.state).toEqual(saved.state);
        expect(loaded.session).toEqual(saved.session);
        observations.push(loaded);
        await info.attach('loaded-pella-pin', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });

        for (let guard = 0; guard < 12 && (await domain(page)).state.screen === 'dialogue'; guard++)
          await page.locator('[data-conversation-control="next"]').click();
        const finished = await domain(page);
        expect(finished.state.screen).toBe('explore');
        expect(finished.state.world.talk).toBeNull();
        await page.clock.runFor(32);
        const fallback = await page.evaluate(() => (window as AuditedWindow).speaker627?.latest);
        expect(fallback?.pin).toBeNull();
        expect(fallback?.drawnBox).toBeNull();
        const repeatExpected = apply(CONTENT, finished.state, { type: 'walkTo', pos: setup.pella });
        await page.getByRole('button', { name: 'Talk Pella', exact: true }).click();
        await page.clock.runFor(32);
        const repeat = await readFrame(
          page,
          'literal Talk opens the next real Pella conversation',
          scale,
        );
        expect(repeat.state).toEqual(repeatExpected.state);
        expect(repeat.state.story.nodeId).not.toBe(approached.state.story.nodeId);
        expect(repeat.session).toEqual(finished.session);
        observations.push(repeat);
        await info.attach('pella-repeat-talk', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
        await info.attach('speaker-frame-state-and-draws', {
          body: JSON.stringify(
            {
              renderer,
              viewport,
              setup,
              before,
              expectedTalk,
              pendingPresentation,
              reconciliation,
              nextExpected,
              saved,
              finished,
              repeatExpected,
              fallback,
              observations,
              errors,
              limits:
                'Full actual sprite quads, not opaque-pixel masks. Early public resync is an explicit presentation-stress fixture, not ordinary Visit timing. Ordinary save/Continue and repeat Talk remain independent geometry controls. Save/load intentionally resets presentation tracks; route/deadline equality applies before reload. No staged/narrator actor or malformed pin is fabricated; absent pins produce no speaker bounds. Legacy party/zoom assertions remain in the unchanged legacy spec.',
            },
            null,
            2,
          ),
          contentType: 'application/json',
        });
        expect(errors).toEqual([]);
      } finally {
        await page.clock.resume();
      }
    });
  }
}

// Ordinary adjacent Dorin controls complement the unchanged Pella presentation-stress cases.
for (const renderer of ['canvas', 'webgl'] as const) {
  for (const viewport of [
    { width: 1180, height: 820 },
    { width: 1366, height: 1024 },
  ]) {
    test(`ordinary Dorin Huge sprite stays above conversation through talk/load/resize: ${renderer} ${viewport.width}x${viewport.height}`, async ({
      page,
    }, info) => {
      allowSoftwareWebgl(test, renderer);
      await page.setViewportSize(viewport);
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await resetStorage(page, `?style=topdown&renderer=${renderer}`);
      await startGame(
        page,
        ['One', 'Two', 'Three'],
        ['kaya', 'sura', 'bo'],
        'dorin-camera-discovery',
        { reduceMotion: false },
      );
      await enterNode(page, 'village_explore');
      await setLargeText(page, 'huge');
      await waitForIdle(page);
      const waited = await page.evaluate(() => {
        const app = window.fnt!.app,
          state = app.state!,
          seat = app.content.maps.get(state.location.mapId)?.restSpots?.[0];
        if (!seat) throw Error('No real rest spot');
        app.adoptSave(
          { ...state, location: { ...state.location, pos: seat.pos } },
          app.session.toMeta(),
        );
        const before = structuredClone(app.state!);
        const events = app.dispatch({ type: 'wait', until: 'afternoon' });
        return { seat, before, after: app.state, events };
      });
      expect(waited.events.some((e) => e.type === 'phaseChanged')).toBe(true);
      expect(waited.after).toEqual(
        apply(CONTENT, waited.before, { type: 'wait', until: 'afternoon' }).state,
      );
      await waitForIdle(page);
      const setup = await page.evaluate(() => {
        const app = window.fnt!.app,
          state = app.state!,
          map = app.content.maps.get(state.location.mapId)!;
        const who = app.residents.figures().find((w) => w.npcId === 'guard_dorin');
        if (!who?.pos) throw Error('No canonical afternoon Dorin');
        const target = who.pos,
          pos = { x: target.x, y: target.y - 1 },
          symbol = map.rows[pos.y]?.[pos.x];
        if (
          symbol === undefined ||
          map.legend[symbol]?.blocked ||
          app.residents.figures().some((w) => w.pos?.x === pos.x && w.pos?.y === pos.y)
        )
          throw Error('North neighbour is not clear legal ground');
        app.adoptSave({ ...state, location: { ...state.location, pos } }, app.session.toMeta());
        return {
          target,
          pos,
          huge: app.settings.largeText,
          font: getComputedStyle(document.documentElement).fontSize,
        };
      });
      expect(setup.huge).toBe('huge');
      expect(setup.font).toBe('24px');
      expect((await domain(page)).state.location.pos).toEqual(setup.pos);
      await waitForIdle(page);
      await page.waitForFunction(
        (target) => {
          const app = window.fnt!.app,
            w = app.residents.figures().find((x) => x.npcId === 'guard_dorin');
          return (
            !!w?.pos &&
            !w.walking &&
            w.alpha === 1 &&
            w.pos.x === target.x &&
            w.pos.y === target.y &&
            w.drawPos.x === target.x &&
            w.drawPos.y === target.y &&
            !app.residents.walkingTo(target)
          );
        },
        setup.target,
        { timeout: 20000 },
      );
      await settleLayout(page);
      await observeBackend(page);
      expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe(renderer);
      const scale = await page.evaluate(
        () =>
          (window.fnt!.app as unknown as { scene: { renderer: { camera: Camera } } }).scene.renderer
            .camera.deviceScale,
      );
      await page.getByRole('button', { name: 'Look around', exact: true }).click();
      const nearby = page.getByRole('dialog', { name: 'Look around', exact: true });
      await expect(
        nearby.getByRole('button', { name: 'Visit Gate Guard Dorin', exact: true }),
      ).toBeEnabled();
      await pauseClock(page);
      try {
        const before = await domain(page),
          expected = apply(CONTENT, before.state, { type: 'walkTo', pos: setup.target });
        expect(expected.state.screen).toBe('dialogue');
        expect(expected.events.some((e) => e.type === 'partyWalked')).toBe(false);
        await nearby.getByRole('button', { name: 'Visit Gate Guard Dorin', exact: true }).click();
        await expect(page.locator('.explore-conversation .conversation-panel')).toBeVisible();
        await page.clock.runFor(64);
        const opened = await readFrame(
          page,
          'ordinary adjacent Dorin Talk, Huge',
          scale,
          'guard_dorin',
        );
        expect(opened.state).toEqual(expected.state);
        expect(opened.session).toEqual(before.session);
        await info.attach('ordinary-dorin-opened', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
        // An idle dispatch may advance the empty timeline to its command time.
        // Active-route Pella deadlines above retain their exact equality guards.
        const nextCommandTime = await page.evaluate(() => performance.now());
        expect(opened.busy).toBe(false);
        expect(opened.moves).toEqual([]);
        expect(opened.finishesAt).toBeLessThanOrEqual(nextCommandTime);
        await page.locator('[data-conversation-control="next"]').click();
        await page.clock.runFor(32);
        const next = await readFrame(page, 'ordinary Dorin Next, Huge', scale, 'guard_dorin');
        expect(next.state).toEqual(apply(CONTENT, opened.state, { type: 'advanceDialogue' }).state);
        expect(next.session).toEqual(opened.session);
        expect(next.state.rng).toBe(opened.state.rng);
        expect(next.finishesAt).toBe(Math.max(opened.finishesAt, nextCommandTime));
        expect(next.busy).toBe(false);
        expect(next.moves).toEqual([]);
        expect(next.moves).toEqual(opened.moves);
        const nextExpected = apply(CONTENT, opened.state, { type: 'advanceDialogue' });
        await info.attach('ordinary-dorin-next', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
        await page.setViewportSize(
          viewport.width === 1180 ? { width: 1366, height: 1024 } : { width: 1180, height: 820 },
        );
        await page.clock.runFor(64);
        const resized = await readFrame(
          page,
          'ordinary Dorin after owner-viewport resize, Huge',
          scale,
          'guard_dorin',
        );
        expect(resized.state).toEqual(next.state);
        expect(resized.session).toEqual(next.session);
        expect(resized.state.rng).toBe(next.state.rng);
        expect(resized.finishesAt).toBe(next.finishesAt);
        expect(resized.moves).toEqual(next.moves);
        await info.attach('ordinary-dorin-resized', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
        expect(await page.evaluate(() => window.fnt!.app.saveTo('auto'))).toBe(true);
        const saved = await domain(page);
        await page.clock.resume();
        await page.reload();
        await page.waitForFunction(() => !!window.fnt?.app);
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        await observeBackend(page);
        await waitForIdle(page);
        await settleLayout(page);
        await pauseClock(page);
        const loaded = await readFrame(
          page,
          'ordinary Continue restored Dorin pin, Huge',
          scale,
          'guard_dorin',
        );
        expect(loaded.state).toEqual(saved.state);
        expect(loaded.session).toEqual(saved.session);
        await info.attach('ordinary-dorin-loaded', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
        await info.attach('ordinary-dorin-observations', {
          body: JSON.stringify(
            {
              renderer,
              viewport,
              textSize: 'huge',
              waited,
              setup,
              scale,
              before,
              expected,
              nextExpected,
              nextCommandTime,
              saved,
              observations: [opened, next, resized, loaded],
              errors,
              limits:
                'Public rest/approach position setup and real reducer wait establish afternoon; this is not an earned-campaign fixture. Ordinary adjacent Visit/Next/resize/reloadContinue, with no resync, actor, phase, flag, pin or outcome invention. Full actual sprite quads and zero overlap. Save/load resets presentation tracks; move/deadline equality applies before reload. Dorin repeats the same node; the Pella different-node assertion remains unchanged.',
            },
            null,
            2,
          ),
          contentType: 'application/json',
        });
        expect(errors).toEqual([]);
      } finally {
        await page.clock.resume();
      }
    });
  }
}
