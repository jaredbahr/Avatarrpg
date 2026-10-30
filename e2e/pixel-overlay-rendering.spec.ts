import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { CONTENT } from '../src/content';
import { RngCursor } from '../src/core/rng';
import { reachable } from '../src/core/rules/grid';
import { BattleDraft } from '../src/core/state/battleDraft';
import { TIER_LIFT } from '../src/render/geometry/elevation';
import { npcPipLift } from '../src/render/npcPip';
import type { G1Bounds } from '../src/render/pixelMarks';
import { talkPipMark, type PixelOverlayCue } from '../src/render/pixelOverlayGeometry';
import { FOOT_LINE } from '../src/render/sheets/bake';
import type { MapView, RenderUnit } from '../src/render/view';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, startGame, takeTurn, waitForIdle } from './helpers';
import { groundPoint } from './projection';

const REVIEW_DIR = resolve(process.cwd(), '.shots/pixel-overlay-review');
const VIEWPORT = { width: 1280, height: 800 };
const MARK_CENTRES = {
  move: { x: 6.5, y: 6.5 },
  target: { x: 7.5, y: 5.5 },
  area: { x: 8.5, y: 6.5 },
  rangeBonus: { x: 9.5, y: 6.5 },
  hover: { x: 10.5, y: 6.5 },
  path: { x: 7.5, y: 7.5 },
  aim: { x: 7.5, y: 3.5 },
  exit: { x: 8.5, y: 7.5 },
  targetReticle: { x: 8.5, y: 5.5 },
  selected: { x: 8.5, y: 4.86 },
  ko: { x: 10.5, y: 4.55 },
  talk: { x: 10.5, y: 8.5 },
  healthBar: { x: 8.5, y: 6.5 },
} as const;
const MARK_NAMES = Object.keys(MARK_CENTRES) as (keyof typeof MARK_CENTRES)[];

type Crop = { dataUrl: string; width: number; height: number };
type DrawTiming = { firstDrawMs: number; repeatedDrawMs: number; cues: string };
type MarkName = keyof typeof MARK_CENTRES;
type MarkMetric = {
  pixels: number;
  width: number;
  height: number;
  mask: Uint8Array;
  bounds: { x: number; y: number; width: number; height: number };
};
type MarkCrops = Record<MarkName, { before: Crop; after: Crop }> & {
  plainReticle: Crop;
  noOpBase: Crop;
  occlusion: { before: Crop; after: Crop; actorless: Crop };
};
type AlphaProbe = {
  width: number;
  height: number;
  offsetCss: number;
  nonzero: number;
  unexpected: number;
  partialBlocks: number;
  allowed: number[];
  observed: number[];
};

function maskMetrics(beforeUrl: string, afterUrl: string, threshold = 18): MarkMetric {
  const before = PNG.sync.read(Buffer.from(beforeUrl.split(',')[1] ?? '', 'base64'));
  const after = PNG.sync.read(Buffer.from(afterUrl.split(',')[1] ?? '', 'base64'));
  if (before.width !== after.width || before.height !== after.height) {
    throw new Error('The mark probe crops have different dimensions.');
  }
  let left = before.width;
  let top = before.height;
  let right = -1;
  let bottom = -1;
  let pixels = 0;
  const mask = new Uint8Array(before.width * before.height);
  for (let y = 0; y < before.height; y++) {
    for (let x = 0; x < before.width; x++) {
      const i = (y * before.width + x) * 4;
      const delta =
        Math.abs((before.data[i] ?? 0) - (after.data[i] ?? 0)) +
        Math.abs((before.data[i + 1] ?? 0) - (after.data[i + 1] ?? 0)) +
        Math.abs((before.data[i + 2] ?? 0) - (after.data[i + 2] ?? 0));
      if (delta < threshold) continue;
      mask[y * before.width + x] = 1;
      pixels++;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return {
    pixels,
    width: before.width,
    height: before.height,
    mask,
    bounds: {
      x: left,
      y: top,
      width: right >= left ? right - left + 1 : 0,
      height: bottom >= top ? bottom - top + 1 : 0,
    },
  };
}

function maskCoverageWithin(source: MarkMetric, target: MarkMetric, tolerance: number): number {
  let matched = 0;
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (!source.mask[y * source.width + x]) continue;
      let found = false;
      for (let dy = -tolerance; dy <= tolerance && !found; dy++) {
        for (let dx = -tolerance; dx <= tolerance; dx++) {
          const tx = x + dx;
          const ty = y + dy;
          if (
            tx >= 0 &&
            ty >= 0 &&
            tx < target.width &&
            ty < target.height &&
            target.mask[ty * target.width + tx]
          ) {
            found = true;
            break;
          }
        }
      }
      if (found) matched++;
    }
  }
  return matched / Math.max(1, source.pixels);
}

function erodeMask(source: MarkMetric, radius: number): MarkMetric {
  const mask = new Uint8Array(source.mask.length);
  let pixels = 0;
  let left = source.width;
  let top = source.height;
  let right = -1;
  let bottom = -1;
  for (let y = radius; y < source.height - radius; y++) {
    for (let x = radius; x < source.width - radius; x++) {
      let interior = true;
      for (let dy = -radius; dy <= radius && interior; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (!source.mask[(y + dy) * source.width + x + dx]) {
            interior = false;
            break;
          }
        }
      }
      if (!interior) continue;
      mask[y * source.width + x] = 1;
      pixels++;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return {
    pixels,
    width: source.width,
    height: source.height,
    mask,
    bounds: {
      x: left,
      y: top,
      width: right >= left ? right - left + 1 : 0,
      height: bottom >= top ? bottom - top + 1 : 0,
    },
  };
}

function maskIntersectionPixelsInBox(
  a: MarkMetric,
  b: MarkMetric,
  box: { left: number; top: number; right: number; bottom: number },
): number {
  if (a.width !== b.width || a.height !== b.height) throw new Error('Mask dimensions differ.');
  let count = 0;
  for (let y = Math.max(0, box.top); y < Math.min(a.height, box.bottom); y++) {
    for (let x = Math.max(0, box.left); x < Math.min(a.width, box.right); x++) {
      const index = y * a.width + x;
      count += (a.mask[index] ?? 0) * (b.mask[index] ?? 0);
    }
  }
  return count;
}

function maskPixelsInBox(
  mask: MarkMetric,
  box: { left: number; top: number; right: number; bottom: number },
): number {
  let count = 0;
  for (let y = Math.max(0, box.top); y < Math.min(mask.height, box.bottom); y++) {
    for (let x = Math.max(0, box.left); x < Math.min(mask.width, box.right); x++) {
      count += mask.mask[y * mask.width + x] ?? 0;
    }
  }
  return count;
}

function torsoInteriorBox(mask: MarkMetric, zoom: number, dpr: number) {
  const pixelsPerWorldPixel = zoom * dpr;
  const centerX = mask.bounds.x + mask.bounds.width / 2;
  const halfWidth = 10 * pixelsPerWorldPixel;
  return {
    left: Math.floor(centerX - halfWidth),
    right: Math.ceil(centerX + halfWidth),
    top: Math.floor(mask.bounds.y + mask.bounds.height * 0.35),
    bottom: Math.ceil(mask.bounds.y + mask.bounds.height * 0.68),
  };
}

async function captureGameplayMove(
  page: Page,
  backend: 'canvas' | 'webgl',
  dpr: number,
): Promise<DrawTiming> {
  const captureMoveFrame = async (
    phase: 'preview' | 'confirmed',
    expectedVisual?: { actorId: string; destination: { x: number; y: number } },
  ): Promise<void> => {
    const path = resolve(
      REVIEW_DIR,
      `gameplay-${backend}-dpr${dpr}-move-${phase}${dpr === 2 ? '-canvas' : ''}.png`,
    );
    if (dpr === 1) {
      // Keep the full-page UI context at DPR1. The gameplay assertions below
      // exercise the same real Move path at both device scales.
      await page.screenshot({ path });
      return;
    }
    // Chromium's full-page screenshot forces an expensive software-WebGL
    // readback. Draw the actual MapView and save the canvas at its native
    // backing resolution, rather than reducing or resampling the pixels.
    if (phase === 'confirmed') {
      // The scene loop publishes its final MapView on the next actual frame.
      await page.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
      );
    }
    const frame = await page.evaluate((expected) => {
      const renderer = (
        window.fnt!.app as unknown as {
          scene: { renderer: { lastView: MapView | null; draw(view: MapView): void } };
        }
      ).scene.renderer;
      const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
      const view = renderer.lastView;
      if (!canvas || !view) throw new Error('Missing real Move canvas or MapView');
      const actor = expected ? view.units.find((unit) => unit.id === expected.actorId) : null;
      if (expected && !actor) throw new Error('Missing confirmed Move actor in final MapView');
      const visualPosition = actor ? (actor.renderPos ?? actor.pos) : null;
      renderer.draw(view);
      const rect = canvas.getBoundingClientRect();
      return {
        dataUrl: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height,
        cssWidth: rect.width,
        cssHeight: rect.height,
        visualPosition,
      };
    }, expectedVisual ?? null);
    const png = Buffer.from(frame.dataUrl.split(',')[1] ?? '', 'base64');
    expect(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
    expect(png.readUInt32BE(16)).toBe(frame.width);
    expect(png.readUInt32BE(20)).toBe(frame.height);
    expect(Math.abs(frame.width - frame.cssWidth * dpr)).toBeLessThanOrEqual(1);
    expect(Math.abs(frame.height - frame.cssHeight * dpr)).toBeLessThanOrEqual(1);
    if (expectedVisual) expect(frame.visualPosition).toEqual(expectedVisual.destination);
    writeFileSync(path, png);
    writeFileSync(
      `${path}.json`,
      `${JSON.stringify(
        {
          capture: 'native-canvas-backing-after-renderer-draw',
          phase,
          backend,
          dpr,
          width: frame.width,
          height: frame.height,
          cssWidth: frame.cssWidth,
          cssHeight: frame.cssHeight,
          visualPosition: frame.visualPosition,
        },
        null,
        2,
      )}\n`,
    );
  };
  await resetStorage(page, `?renderer=${backend}`);
  await startGame(page, ['Kaya'], ['kaya'], 'pixel-review-move-parity');
  await enterNode(page, 'battle_forest_road');
  expect(await takeTurn(page)).toBe(true);
  await waitForIdle(page);
  expect(await page.evaluate(() => window.fnt?.app.rendererBackend())).toBe(backend);

  await page.getByRole('button', { name: /^Move/ }).click();
  const state = await page.evaluate(() => {
    const app = window.fnt?.app;
    const battle = app?.state?.battle;
    const camera = app?.rendererCamera();
    const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
    if (!app || !battle || !camera || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      battle,
      rng: app.state?.rng ?? 0,
      camera,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    };
  });
  expect(state, 'real move preview has a mounted battle and measured camera').not.toBeNull();
  if (!state) throw new Error('Missing real move preview state.');
  const draft = new BattleDraft(CONTENT, state.battle, new RngCursor(state.rng));
  const activeId = draft.order[draft.turnIndex];
  const active = activeId ? draft.unit(activeId) : null;
  expect(active, 'real preview has a living acting unit').toBeTruthy();
  if (!active) throw new Error('Missing acting unit.');
  const destination = [...reachable(draft.moveContext(active), active.pos, active.move).values()]
    .filter((cell) => cell.pos.x !== active.pos.x || cell.pos.y !== active.pos.y)
    .map((cell) => ({
      cell,
      point: groundPoint(state.camera, { x: cell.pos.x + 0.5, y: cell.pos.y + 0.5 }),
    }))
    .filter(
      ({ point }) =>
        point.x > 8 &&
        point.x < state.rect.width - 8 &&
        point.y > 8 &&
        point.y < state.rect.height - 8,
    )
    .sort(
      (a, b) =>
        Math.abs(a.cell.pos.x - active.pos.x) +
        Math.abs(a.cell.pos.y - active.pos.y) -
        (Math.abs(b.cell.pos.x - active.pos.x) + Math.abs(b.cell.pos.y - active.pos.y)),
    )[0];
  expect(destination, 'a reachable painted destination is visible').toBeTruthy();
  if (!destination) throw new Error('No visible legal movement target.');

  await page.mouse.click(state.rect.x + destination.point.x, state.rect.y + destination.point.y);
  await expect(page.locator('.confirm-bar')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Confirm$/ })).toBeEnabled();
  const drawTiming = await page.evaluate(() => {
    const renderer = (
      window.fnt!.app as unknown as {
        scene: {
          renderer: {
            lastView: MapView | null;
            draw(view: MapView): void;
          };
        };
      }
    ).scene.renderer;
    const view = renderer.lastView;
    if (!view) throw new Error('The live movement preview has no MapView.');
    const firstStart = performance.now();
    renderer.draw(view);
    const firstDrawMs = performance.now() - firstStart;
    const repeatStart = performance.now();
    renderer.draw(view);
    const repeatedDrawMs = performance.now() - repeatStart;
    return {
      firstDrawMs,
      repeatedDrawMs,
      cues: `overlays=${view.overlays.length},path=${view.path.length},target=${view.targetReticle ? 1 : 0}`,
    };
  });
  await captureMoveFrame('preview');
  await page.getByRole('button', { name: /^Confirm$/ }).click();
  await waitForIdle(page);
  // Confirm synchronously commits the chosen Move; after the existing idle
  // wait, assert its exact state once. An eventual poll can expire while a
  // software-WebGL readback returns the correct position at its deadline.
  const confirmedPosition = await page.evaluate((id) => {
    const unit = window.fnt?.app.state?.battle?.units.find((candidate) => candidate.id === id);
    return unit ? `${unit.pos.x},${unit.pos.y}` : null;
  }, active.id);
  expect(confirmedPosition).toBe(`${destination.cell.pos.x},${destination.cell.pos.y}`);
  await captureMoveFrame('confirmed', { actorId: active.id, destination: destination.cell.pos });
  return drawTiming;
}

async function captureVillageOverlays(page: Page, backend: 'canvas' | 'webgl'): Promise<void> {
  await resetStorage(page, `?renderer=${backend}`);
  await startGame(page, ['Kaya'], ['kaya'], 'pixel-review-ba-dan');
  await enterNode(page, 'village_explore');
  await waitForIdle(page);
  const images = await page.evaluate(() => {
    const renderer = (
      window.fnt!.app as unknown as {
        scene: {
          renderer: {
            camera: { centreOn(pos: { x: number; y: number }): void };
            lastView: MapView | null;
            draw(view: MapView): void;
          };
        };
      }
    ).scene.renderer;
    const view = renderer.lastView;
    const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
    const speakingNpc = view?.npcs.find((npc) => !npc.quiet);
    if (!view || !canvas || !speakingNpc)
      throw new Error('Ba Dan review needs a drawn NPC with a talk pip');
    renderer.camera.centreOn(speakingNpc.pos);
    const fixed: MapView = { ...view, time: 640_000, reducedMotion: true };
    renderer.draw({
      ...fixed,
      npcs: fixed.npcs.map((npc) => ({ ...npc, quiet: true })),
      exits: [],
      exit: null,
    });
    const before = canvas.toDataURL('image/png');
    renderer.draw(fixed);
    return { before, after: canvas.toDataURL('image/png') };
  });
  for (const [phase, dataUrl] of [
    ['before', images.before],
    ['after', images.after],
  ] as const) {
    writeFileSync(
      resolve(REVIEW_DIR, `ba-dan-${backend}-${phase}.png`),
      Buffer.from(dataUrl.split(',')[1] ?? '', 'base64'),
    );
  }
  expect(
    maskMetrics(images.before, images.after).pixels,
    `Ba Dan ${backend} talk and exit overlays change the rendered village frame`,
  ).toBeGreaterThan(0);
}

async function captureStagedMarks(
  page: Page,
  zoom: 1 | 2 | 3,
): Promise<{
  pairCapture: {
    mode: 'original' | 'phase-safe-groups';
    afterDraws: number;
    beforeDraws: number;
    warmupDraws: number;
    totalDraws: number;
    cropReadbacks: number;
    pairMs: number;
    groups: { anchor: MarkName; members: MarkName[]; offsetX: number; offsetY: number }[];
  };
  crops: MarkCrops;
  cache: {
    warm: number;
    repeated: number;
    smallPan: number;
    entries: number;
    bytes: number;
    warmMs: number;
    repeatedMs: number;
    spike: {
      warmKey: string | null;
      repeatedKey: string | null;
      panKey: string | null;
      repeatSameSource: boolean;
      panSameSource: boolean;
    };
  };
  actual: {
    dpr: number;
    scale: number;
    tilePx: number;
    targetAnchor: { x: number; y: number };
    anchors: Partial<Record<MarkName, { x: number; y: number }>>;
  };
  alphaProbes: Record<MarkName, AlphaProbe>;
  ruleSignatures: Record<MarkName, string>;
  contrastRules: Record<'move' | 'target' | 'area' | 'rangeBonus' | 'hover' | 'path', string>;
}> {
  return page.evaluate(
    ({ requestedZoom, centres, talkCue, talkPipLift, footLine }) => {
      type RuntimeRenderer = {
        camera: {
          scale: number;
          integerZoom: boolean;
          offsetX: number;
          offsetY: number;
          viewport: { dpr: number; width: number; height: number };
          centreOn(pos: { x: number; y: number }, size?: 1 | 2): void;
          panBy(dx: number, dy: number): void;
          project(pos: { x: number; y: number }): { x: number; y: number };
          spriteBox(
            pos: { x: number; y: number },
            footprint?: 1 | 2,
            square?: boolean,
          ): { x: number; y: number; size: number };
        };
        lastView: MapView | null;
        draw(view: MapView): void;
        backendName: 'canvas' | 'webgl';
        backend: {
          pixelMarkDrawables: {
            rasterizationCount: number;
            size: number;
            byteLength: number;
            entries: Map<string, { drawable: HTMLCanvasElement | null }>;
          };
        } & Record<string, unknown>;
      };
      const app = window.fnt!.app;
      const renderer = (app as unknown as { scene: { renderer: RuntimeRenderer } }).scene.renderer;
      const source = renderer.lastView;
      const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
      if (!source || !canvas) throw new Error('Missing the real MapView or battle canvas.');
      const camera = renderer.camera;
      camera.scale = requestedZoom;
      camera.centreOn({ x: source.grid.width / 2, y: source.grid.height / 2 });
      const party = source.units.find((unit) => unit.faction === 'party');
      const enemy = source.units.find((unit) => unit.faction === 'enemy');
      if (!party || !enemy) throw new Error('Staged marks need one party actor and one enemy.');
      const stagedUnit = (
        unit: RenderUnit,
        id: string,
        pos: { x: number; y: number },
        changes: Partial<RenderUnit> = {},
      ): RenderUnit => ({
        ...unit,
        ...changes,
        id,
        pos,
        renderPos: pos,
        offset: { x: 0, y: 0 },
        scale: 1,
        alpha: 1,
        clip: undefined,
        clipTime: 0,
        clipFrame: undefined,
        bend: undefined,
      });
      const occlusionActor = stagedUnit(party, 'pixel-review-occlusion-actor', { x: 6, y: 4 });
      const chosen = stagedUnit(party, 'pixel-review-selected', { x: 8, y: 4 });
      const knockedOut = stagedUnit(party, 'pixel-review-ko', { x: 10, y: 4 }, { fallen: true });
      const hostile = stagedUnit(enemy, 'pixel-review-hostile', { x: 8, y: 6 });
      const cueView: MapView = {
        ...source,
        time: 640_000,
        units: [occlusionActor, chosen, knockedOut, hostile],
        npcs: [
          {
            id: 'pixel-review-talk',
            pos: { x: 10, y: 8 },
            sprite: party.sprite,
            name: 'Talk pip probe',
            quiet: false,
            scale: 1,
          },
        ],
        overlays: [
          // Keep the per-cue visibility probe clear of unit sprites. A separate
          // isolated probe below verifies move-mask occlusion beneath a unit.
          { kind: 'move', tiles: [{ x: 6, y: 6 }] },
          { kind: 'target', tiles: [{ x: 7, y: 6 }] },
          { kind: 'area', tiles: [{ x: 8, y: 6 }] },
          { kind: 'rangeBonus', tiles: [{ x: 9, y: 6 }] },
        ],
        hoverTile: { x: 10, y: 6 },
        path: [
          { x: 7, y: 7 },
          { x: 8, y: 7 },
        ],
        pathFrom: { x: 6, y: 7 },
        pathOrigin: null,
        pathStart: 0,
        calmPath: false,
        aimArc: { from: { x: 6.2, y: 3.5 }, to: { x: 8.8, y: 3.5 }, arc: 0.5, color: '#7ec8e3' },
        exit: null,
        exits: [{ pos: { x: 8, y: 7 }, label: 'Review exit' }],
        targetReticle: { pos: { x: 8, y: 5 }, elevation: 'above', obscured: true },
        selectedUnitId: chosen.id,
        activeUnitId: null,
        cameraNudge: { x: 0, y: 0 },
        reducedMotion: true,
      };
      const canvasRect = canvas.getBoundingClientRect();
      const backingScaleX = canvas.width / canvasRect.width;
      const backingScaleY = canvas.height / canvasRect.height;
      const captureScreen = (
        point: { x: number; y: number },
        cssWidth = 164,
        cssHeight = cssWidth,
      ): Crop => {
        const width = Math.round(cssWidth * backingScaleX);
        const height = Math.round(cssHeight * backingScaleY);
        const sx = Math.max(
          0,
          Math.min(canvas.width - width, Math.round((point.x - cssWidth / 2) * backingScaleX)),
        );
        const sy = Math.max(
          0,
          Math.min(canvas.height - height, Math.round((point.y - cssHeight / 2) * backingScaleY)),
        );
        const crop = document.createElement('canvas');
        crop.width = width;
        crop.height = height;
        const context = crop.getContext('2d');
        if (!context) throw new Error('Could not allocate mark-crop canvas.');
        context.drawImage(canvas, sx, sy, width, height, 0, 0, width, height);
        return { dataUrl: crop.toDataURL('image/png'), width, height };
      };
      const capture = (centre: { x: number; y: number }): Crop =>
        captureScreen(camera.project(centre));
      const captureOcclusionView = (view: MapView): Crop => {
        renderer.draw(view);
        return captureScreen(camera.project({ x: 6.5, y: 4.5 }), 260, 260);
      };
      const cueGeometry = {} as Partial<Record<MarkName, G1Bounds>>;
      const markScreenRects = {} as Partial<
        Record<MarkName, { left: number; top: number; width: number; height: number }>
      >;
      const prefixes: Record<MarkName, readonly string[]> = {
        move: ['overlay:move:'],
        target: ['overlay:target:'],
        area: ['overlay:area:'],
        rangeBonus: ['overlay:rangeBonus:'],
        hover: ['hover:', 'hover-calm'],
        path: ['route-', 'route-dots:'],
        aim: ['aim-arc'],
        exit: ['exit'],
        targetReticle: ['target-reticle'],
        selected: ['selected-ring'],
        ko: ['ko-cross'],
        talk: ['talk'],
        healthBar: ['enemy-health-spike'],
      };
      const cueAnchors = {} as Partial<Record<MarkName, { x: number; y: number }>>;
      const cueSamples = { talk: talkCue } as Partial<Record<MarkName, PixelOverlayCue>>;
      const captureMark = (name: MarkName): Crop => {
        if (name === 'talk') {
          const npc = cueView.npcs[0];
          if (!npc || npc.sprite !== 'unit.fire.kaya')
            throw new Error('Talk crop needs the staged Kaya figure');
          // Measure the exact production NPC foot and pip lift. The camera's
          // oblique projection and pan clamp make a fixed ground-point offset
          // drift away from the pip at zoom 3.
          const box = camera.spriteBox(npc.pos, 1, false);
          const centre = {
            x: box.x + box.size / 2,
            y: box.y + box.size * (footLine - talkPipLift),
          };
          const halfPip = (9 * camera.scale) / 2;
          const margin = 2 * camera.scale;
          if (
            centre.x - halfPip - margin < 0 ||
            centre.y - halfPip - margin < 0 ||
            centre.x + halfPip + margin > camera.viewport.width ||
            centre.y + halfPip + margin > camera.viewport.height
          ) {
            throw new Error(
              `The full talk pip is outside the visible board at zoom ${camera.scale}`,
            );
          }
          return captureScreen(centre, 40, 40);
        }
        const geometry = cueGeometry[name];
        if (geometry) {
          const scale = camera.scale;
          const left = geometry.left * scale - camera.offsetX;
          const top = geometry.top * scale - camera.offsetY;
          const cssWidth = geometry.width * scale + 8 * scale;
          const cssHeight = geometry.height * scale + 8 * scale;
          const x = left + (geometry.width * scale) / 2;
          const y = top + (geometry.height * scale) / 2;
          markScreenRects[name] = {
            left: left - 4 * scale,
            top: top - 4 * scale,
            width: cssWidth,
            height: cssHeight,
          };
          if (
            left - 4 * scale < 0 ||
            top - 4 * scale < 0 ||
            left + geometry.width * scale + 4 * scale > camera.viewport.width ||
            top + geometry.height * scale + 4 * scale > camera.viewport.height
          ) {
            throw new Error(
              `${name} full pixel-mark bounds ${left.toFixed(1)},${top.toFixed(1)} ${geometry.width * scale}x${geometry.height * scale} are outside ${camera.viewport.width}x${camera.viewport.height} at zoom ${scale}`,
            );
          }
          return captureScreen({ x, y }, cssWidth, cssHeight);
        }
        const anchor = cueAnchors[name];
        return anchor
          ? captureScreen({
              x: anchor.x * camera.scale - camera.offsetX,
              y: anchor.y * camera.scale - camera.offsetY,
            })
          : capture(centres[name]);
      };
      const centreOnMark = (name: MarkName): void => {
        if (name === 'talk') {
          // centreOn takes a tile position and adds its own half-cell.
          camera.centreOn({ x: 10, y: 8 });
          return;
        }
        const geometry = cueGeometry[name];
        if (!geometry) {
          camera.centreOn(centres[name]);
          return;
        }
        const centreX = (geometry.left + geometry.width / 2) * camera.scale - camera.offsetX;
        const centreY = (geometry.top + geometry.height / 2) * camera.scale - camera.offsetY;
        camera.panBy(camera.viewport.width / 2 - centreX, camera.viewport.height / 2 - centreY);
      };
      const afterView = (view: MapView, name: MarkName): Crop => {
        renderer.draw(view);
        return captureMark(name);
      };
      const drawComparisonView = (view: MapView, name: MarkName): Crop => {
        // Pixi retains raised-top pixels for the same semantic MapView across
        // the adapter seam. Filtered test probes must invalidate that cached
        // lift only for this before/after capture; perf draws below stay warm.
        if (renderer.backendName === 'webgl') renderer.backend.marksKey = '';
        return afterView(view, name);
      };
      const drawOcclusionComparison = (view: MapView): Crop => {
        if (renderer.backendName === 'webgl') renderer.backend.marksKey = '';
        return captureOcclusionView(view);
      };
      const observedBackend = renderer.backend;
      const adapterName = renderer.backendName === 'canvas' ? 'drawPixelCues' : 'appendPixelMarks';
      const unwrapped = observedBackend[adapterName] as
        ((...args: unknown[]) => unknown) | undefined;
      if (!unwrapped) throw new Error(`Missing ${adapterName} pixel-mark adapter seam.`);
      observedBackend[adapterName] = (...args: unknown[]): unknown => {
        const cuesIndex = adapterName === 'drawPixelCues' ? 0 : 2;
        const cues = args[cuesIndex] as
          | readonly {
              id: string;
              anchor?: { x: number; y: number };
              spec?: { bounds: G1Bounds };
            }[]
          | undefined;
        for (const cue of cues ?? []) {
          for (const name of Object.keys(prefixes) as MarkName[]) {
            if (prefixes[name].some((prefix) => cue.id.startsWith(prefix))) {
              cueSamples[name] ??= cue as PixelOverlayCue;
              if (cue.anchor) cueAnchors[name] = cue.anchor;
              if (cue.spec?.bounds) {
                const left = (cue.anchor?.x ?? 0) + cue.spec.bounds.left;
                const top = (cue.anchor?.y ?? 0) + cue.spec.bounds.top;
                const right = left + cue.spec.bounds.width;
                const bottom = top + cue.spec.bounds.height;
                const previous = cueGeometry[name];
                if (previous) {
                  const unionLeft = Math.min(previous.left, left);
                  const unionTop = Math.min(previous.top, top);
                  const unionRight = Math.max(previous.left + previous.width, right);
                  const unionBottom = Math.max(previous.top + previous.height, bottom);
                  cueGeometry[name] = {
                    left: unionLeft,
                    top: unionTop,
                    width: unionRight - unionLeft,
                    height: unionBottom - unionTop,
                  };
                } else {
                  cueGeometry[name] = {
                    left,
                    top,
                    width: cue.spec.bounds.width,
                    height: cue.spec.bounds.height,
                  };
                }
              }
            }
          }
        }
        return unwrapped.apply(observedBackend, args);
      };
      camera.centreOn({ x: source.grid.width / 2, y: source.grid.height / 2 });
      renderer.draw(cueView);
      observedBackend[adapterName] = unwrapped;
      const alphaProbes = {} as Record<MarkName, AlphaProbe>;
      for (const name of Object.keys(prefixes) as MarkName[]) {
        const cue = cueSamples[name];
        if (!cue) throw new Error(`${name} did not emit a production pixel cue`);
        const bounds = cue.spec.bounds;
        const first = cue.spec.operations[0];
        const occupied = first?.kind === 'circle' ? first.centre : first?.points[0];
        if (!occupied) throw new Error(`${name} has no mark pixel near an authored point`);
        const sampledWidth = Math.min(80, bounds.width);
        const sampledHeight = Math.min(80, bounds.height);
        const localLeft = Math.min(
          Math.max(occupied.x - Math.floor(sampledWidth / 2), bounds.left),
          bounds.left + bounds.width - sampledWidth,
        );
        const localTop = Math.min(
          Math.max(occupied.y - Math.floor(sampledHeight / 2), bounds.top),
          bounds.top + bounds.height - sampledHeight,
        );
        const boardLeft = (cue.anchor?.x ?? 0) + localLeft;
        const boardTop = (cue.anchor?.y ?? 0) + localTop;
        const cssWidth = (sampledWidth + 4) * requestedZoom;
        const cssHeight = (sampledHeight + 4) * requestedZoom;
        const dpr = camera.viewport.dpr;
        const width = cssWidth * dpr;
        const height = cssHeight * dpr;
        const previousOffset = { x: camera.offsetX, y: camera.offsetY };
        // Half a CSS pixel at DPR2 is one whole device pixel. This catches
        // camera-phase mismatches without asking the sampler to smooth.
        const offsetCss = dpr === 2 ? 0.5 : 0;
        camera.offsetX = (boardLeft - 2) * requestedZoom + offsetCss;
        camera.offsetY = (boardTop - 2) * requestedZoom + offsetCss;
        const sourceAlphas = new Set<number>([0]);
        const drawableCache =
          observedBackend.pixelMarkDrawables as typeof observedBackend.pixelMarkDrawables & {
            get: (...args: unknown[]) => { drawable: HTMLCanvasElement | null };
          };
        const originalGet = drawableCache.get;
        drawableCache.get = (...args: unknown[]) => {
          const entry = originalGet.apply(drawableCache, args);
          const source = entry.drawable;
          if (source) {
            const data = source
              .getContext('2d')
              ?.getImageData(0, 0, source.width, source.height).data;
            if (!data) throw new Error(`${name} pixel source has no 2D data`);
            for (let i = 3; i < data.length; i += 4) sourceAlphas.add(data[i] ?? 0);
          }
          return entry;
        };
        let pixels: Uint8ClampedArray;
        try {
          if (renderer.backendName === 'canvas') {
            const backend = observedBackend as typeof observedBackend & {
              ctx: CanvasRenderingContext2D;
              drawPixelCues: (
                cues: readonly PixelOverlayCue[],
                camera: typeof renderer.camera,
                plane: 'ground' | 'screen',
              ) => void;
            };
            const target = document.createElement('canvas');
            target.width = width;
            target.height = height;
            const context = target.getContext('2d');
            if (!context) throw new Error('Could not allocate transparent Canvas probe');
            context.setTransform(dpr, 0, 0, dpr, 0, 0);
            const plane: 'ground' | 'screen' = [
              'move',
              'target',
              'area',
              'rangeBonus',
              'hover',
              'path',
              'aim',
              'exit',
            ].includes(name)
              ? 'ground'
              : 'screen';
            if (plane === 'ground') {
              const matrix = (
                camera as typeof camera & {
                  groundMatrix(): {
                    a: number;
                    b: number;
                    c: number;
                    d: number;
                    tx: number;
                    ty: number;
                  };
                }
              ).groundMatrix();
              context.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.tx, matrix.ty);
            }
            const originalContext = backend.ctx;
            backend.ctx = context;
            try {
              backend.drawPixelCues([cue], camera, plane);
            } finally {
              backend.ctx = originalContext;
            }
            pixels = context.getImageData(0, 0, width, height).data;
          } else {
            type ProbeLayer = {
              scale: { set(value: number): void };
              position: { set(x: number, y: number): void };
              children: { removeFromParent(): void; destroy(): void }[];
              destroy(): void;
            };
            type ProbeTexture = { destroy(): void };
            const backend = observedBackend as typeof observedBackend & {
              app: {
                renderer: {
                  render(options: {
                    container: ProbeLayer;
                    target: ProbeTexture;
                    clear: boolean;
                  }): void;
                  extract: {
                    pixels(target: ProbeTexture): {
                      pixels: Uint8ClampedArray;
                      width: number;
                      height: number;
                    };
                  };
                };
              };
              pixelOverlayLayer: { constructor: new () => ProbeLayer };
              pixelSpritePools: Map<ProbeLayer, unknown>;
              pixelSpriteUsed: Map<ProbeLayer, number>;
              target(
                texture: null,
                rect: { x: number; y: number; w: number; h: number },
              ): ProbeTexture;
              appendPixelMarks(
                layer: ProbeLayer,
                camera: typeof renderer.camera,
                cues: readonly PixelOverlayCue[],
                nudge: { x: number; y: number },
              ): void;
            };
            const Layer = backend.pixelOverlayLayer.constructor;
            const layer = new Layer();
            const target = backend.target(null, { x: 0, y: 0, w: cssWidth, h: cssHeight });
            try {
              layer.scale.set(requestedZoom);
              layer.position.set(-camera.offsetX, -camera.offsetY);
              backend.appendPixelMarks(layer, camera, [cue], { x: 0, y: 0 });
              backend.app.renderer.render({ container: layer, target, clear: true });
              const extracted = backend.app.renderer.extract.pixels(target);
              if (extracted.width !== width || extracted.height !== height)
                throw new Error(`${name} Pixi probe resolution disagrees with DPR`);
              pixels = extracted.pixels;
            } finally {
              backend.pixelSpritePools.delete(layer);
              backend.pixelSpriteUsed.delete(layer);
              for (const child of [...layer.children]) {
                child.removeFromParent();
                child.destroy();
              }
              layer.destroy();
              target.destroy();
            }
          }
        } finally {
          drawableCache.get = originalGet;
          camera.offsetX = previousOffset.x;
          camera.offsetY = previousOffset.y;
        }
        const allowed = [...sourceAlphas].map((alpha) => Math.round(alpha * (cue.alpha ?? 1)));
        const observed = new Set<number>();
        let nonzero = 0;
        let unexpected = 0;
        for (let i = 3; i < pixels.length; i += 4) {
          const alpha = pixels[i] ?? 0;
          observed.add(alpha);
          if (alpha > 0) nonzero++;
          if (!allowed.some((expected) => Math.abs(expected - alpha) <= 1)) unexpected++;
        }
        const block = requestedZoom * dpr;
        const blockOrigin = offsetCss ? block - 1 : 0;
        let partialBlocks = 0;
        for (let y = blockOrigin; y + block <= height; y += block) {
          for (let x = blockOrigin; x + block <= width; x += block) {
            const first = pixels[(y * width + x) * 4 + 3] ?? 0;
            for (let dy = 0; dy < block; dy++) {
              for (let dx = 0; dx < block; dx++) {
                if (pixels[((y + dy) * width + x + dx) * 4 + 3] !== first) partialBlocks++;
              }
            }
          }
        }
        alphaProbes[name] = {
          width,
          height,
          offsetCss,
          nonzero,
          unexpected,
          partialBlocks,
          allowed: [...new Set(allowed)].sort((a, b) => a - b),
          observed: [...observed].sort((a, b) => a - b),
        };
      }
      const ruleSignatures = {} as Record<MarkName, string>;
      for (const name of Object.keys(prefixes) as MarkName[]) {
        const cue = cueSamples[name];
        if (!cue) throw new Error(`${name} has no shared rule signature`);
        ruleSignatures[name] = JSON.stringify({ spec: cue.spec, alpha: cue.alpha ?? 1 });
      }
      const emittedTargetAnchor = cueAnchors.targetReticle;
      if (!emittedTargetAnchor)
        throw new Error('The staged target reticle did not emit a pixel mark.');
      const after = {} as Record<MarkName, Crop>;
      const comparisonView = (name: MarkName): MapView => ({
        ...cueView,
        units: cueView.units.map((unit) => ({
          ...unit,
          showHealth: name === 'healthBar' && unit.id === hostile.id,
        })),
      });
      const before = {} as Record<MarkName, Crop>;
      const backendObject = renderer.backend;
      const methodName = renderer.backendName === 'canvas' ? 'drawPixelCues' : 'appendPixelMarks';
      const original = backendObject[methodName] as ((...args: unknown[]) => unknown) | undefined;
      if (!original) throw new Error(`Missing ${methodName} pixel-mark adapter seam.`);
      const names = Object.keys(centres) as MarkName[];
      const pairStart = performance.now();
      let afterDraws = 0;
      let beforeDraws = 0;
      let warmupDraws = 0;
      const usedGroups: {
        anchor: MarkName;
        members: MarkName[];
        offsetX: number;
        offsetY: number;
      }[] = [];
      // Keep each pair at one camera position so the scene and lifted-ground
      // caches stay warm between its complete after and filtered before draws.
      if (camera.viewport.dpr !== 2) {
        // DPR1 retains the original per-cue draw order and camera positions.
        for (const name of names) {
          centreOnMark(name);
          const probeView = comparisonView(name);
          if (name === 'healthBar') {
            drawComparisonView(probeView, name);
            warmupDraws++;
          }
          after[name] = drawComparisonView(probeView, name);
          afterDraws++;
          if (name === 'talk') {
            const quietView: MapView = {
              ...probeView,
              npcs: probeView.npcs.map((npc) => ({ ...npc, quiet: true })),
            };
            before[name] = drawComparisonView(quietView, name);
            beforeDraws++;
            continue;
          }
          const wrapped = (...args: unknown[]): unknown => {
            const cuesIndex = methodName === 'drawPixelCues' ? 0 : 2;
            const cues = args[cuesIndex] as readonly { id: string }[] | undefined;
            if (!cues) throw new Error(`Missing pixel cue list in ${methodName}.`);
            args[cuesIndex] = cues.filter(
              (cue) => !prefixes[name].some((prefix) => cue.id.startsWith(prefix)),
            );
            return original.apply(backendObject, args);
          };
          backendObject[methodName] = wrapped;
          try {
            before[name] = drawComparisonView(probeView, name);
            beforeDraws++;
          } finally {
            backendObject[methodName] = original;
          }
        }
      } else {
        type CameraOffset = { x: number; y: number };
        const originalOffsets = {} as Record<MarkName, CameraOffset>;
        for (const name of names) {
          centreOnMark(name);
          originalOffsets[name] = { x: camera.offsetX, y: camera.offsetY };
        }
        const plans: { anchor: MarkName; members: MarkName[] }[] =
          requestedZoom === 1
            ? [
                {
                  anchor: 'move',
                  members: [
                    'move',
                    'target',
                    'area',
                    'rangeBonus',
                    'hover',
                    'path',
                    'aim',
                    'exit',
                    'selected',
                    'ko',
                  ],
                },
                { anchor: 'targetReticle', members: ['targetReticle'] },
                { anchor: 'talk', members: ['talk'] },
                { anchor: 'healthBar', members: ['healthBar'] },
              ]
            : requestedZoom === 2
              ? [
                  {
                    anchor: 'area',
                    members: [
                      'move',
                      'target',
                      'area',
                      'rangeBonus',
                      'hover',
                      'path',
                      'exit',
                      'ko',
                    ],
                  },
                  { anchor: 'selected', members: ['aim', 'selected'] },
                  { anchor: 'targetReticle', members: ['targetReticle'] },
                  { anchor: 'talk', members: ['talk'] },
                  { anchor: 'healthBar', members: ['healthBar'] },
                ]
              : [
                  { anchor: 'target', members: ['move', 'target', 'area', 'path', 'exit'] },
                  { anchor: 'rangeBonus', members: ['rangeBonus', 'hover', 'ko'] },
                  { anchor: 'aim', members: ['aim', 'selected'] },
                  { anchor: 'targetReticle', members: ['targetReticle'] },
                  { anchor: 'talk', members: ['talk'] },
                  { anchor: 'healthBar', members: ['healthBar'] },
                ];
        const scheduled = plans.flatMap((plan) => plan.members);
        if (scheduled.length !== names.length || new Set(scheduled).size !== names.length)
          throw new Error('DPR2 camera plan must contain every mark exactly once');
        const setCamera = (at: CameraOffset): void => {
          camera.offsetX = at.x;
          camera.offsetY = at.y;
          if (camera.offsetX !== at.x || camera.offsetY !== at.y)
            throw new Error('Camera did not retain its measured snapped offset');
        };
        const whole = (value: number): boolean => Math.abs(value - Math.round(value)) < 1e-6;
        const canShare = (name: MarkName, at: CameraOffset): boolean => {
          const geometry = cueGeometry[name];
          if (!geometry || !camera.integerZoom) return false;
          const old = originalOffsets[name];
          const dx = at.x - old.x;
          const dy = at.y - old.y;
          if (
            !whole(dx / requestedZoom) ||
            !whole(dy / requestedZoom) ||
            !whole(dx * camera.viewport.dpr) ||
            !whole(dy * camera.viewport.dpr)
          )
            return false;
          const cropAt = (offset: CameraOffset) => {
            const left = (geometry.left - 4) * requestedZoom - offset.x;
            const top = (geometry.top - 4) * requestedZoom - offset.y;
            const cssWidth = (geometry.width + 8) * requestedZoom;
            const cssHeight = (geometry.height + 8) * requestedZoom;
            const sx = Math.round(left * backingScaleX);
            const sy = Math.round(top * backingScaleY);
            const width = Math.round(cssWidth * backingScaleX);
            const height = Math.round(cssHeight * backingScaleY);
            return {
              left,
              top,
              cssWidth,
              cssHeight,
              sx,
              sy,
              width,
              height,
              fits:
                left >= 0 &&
                top >= 0 &&
                left + cssWidth <= camera.viewport.width &&
                top + cssHeight <= camera.viewport.height &&
                sx >= 0 &&
                sy >= 0 &&
                sx + width <= canvas.width &&
                sy + height <= canvas.height,
            };
          };
          const baseline = cropAt(old);
          const grouped = cropAt(at);
          return (
            baseline.fits &&
            grouped.fits &&
            baseline.sx - grouped.sx === Math.round(dx * camera.viewport.dpr) &&
            baseline.sy - grouped.sy === Math.round(dy * camera.viewport.dpr)
          );
        };
        const groups: { anchor: MarkName; members: MarkName[]; at: CameraOffset }[] = [];
        const fallback: MarkName[] = [];
        for (const plan of plans) {
          const at = originalOffsets[plan.anchor];
          const members = plan.members.filter((name) => {
            if (plan.members.length === 1 && name === plan.anchor) return true;
            const supported = canShare(name, at);
            if (!supported) fallback.push(name);
            return supported;
          });
          if (members.length) groups.push({ anchor: plan.anchor, members, at });
        }
        for (const name of fallback)
          groups.push({ anchor: name, members: [name], at: originalOffsets[name] });
        if (groups.reduce((sum, group) => sum + group.members.length, 0) !== names.length)
          throw new Error('DPR2 camera fallback dropped a mark');
        for (const group of groups) {
          setCamera(group.at);
          const first = group.members[0];
          if (!first) throw new Error('DPR2 camera group has no marks');
          const afterView = comparisonView(first);
          if (first === 'healthBar') {
            drawComparisonView(afterView, first);
            warmupDraws++;
          }
          after[first] = drawComparisonView(afterView, first);
          afterDraws++;
          for (const name of group.members.slice(1)) after[name] = captureMark(name);
          for (const name of group.members) {
            setCamera(group.at);
            const probeView = comparisonView(name);
            if (name === 'talk') {
              const quietView: MapView = {
                ...probeView,
                npcs: probeView.npcs.map((npc) => ({ ...npc, quiet: true })),
              };
              before[name] = drawComparisonView(quietView, name);
              beforeDraws++;
              continue;
            }
            const wrapped = (...args: unknown[]): unknown => {
              const cuesIndex = methodName === 'drawPixelCues' ? 0 : 2;
              const cues = args[cuesIndex] as readonly { id: string }[] | undefined;
              if (!cues) throw new Error(`Missing pixel cue list in ${methodName}.`);
              args[cuesIndex] = cues.filter(
                (cue) => !prefixes[name].some((prefix) => cue.id.startsWith(prefix)),
              );
              return original.apply(backendObject, args);
            };
            backendObject[methodName] = wrapped;
            try {
              before[name] = drawComparisonView(probeView, name);
              beforeDraws++;
            } finally {
              backendObject[methodName] = original;
            }
          }
          usedGroups.push({
            anchor: group.anchor,
            members: group.members,
            offsetX: group.at.x,
            offsetY: group.at.y,
          });
        }
      }
      const pairMs = performance.now() - pairStart;
      if (beforeDraws !== names.length || warmupDraws !== 1)
        throw new Error('Pixel cue capture changed a filtered before or health warmup draw');

      const occlusionBase: MapView = {
        ...cueView,
        overlays: [],
        hoverTile: null,
        path: [],
        pathFrom: null,
        aimArc: null,
        exits: [],
        targetReticle: null,
        selectedUnitId: null,
        activeUnitId: null,
        units: [{ ...occlusionActor, showHealth: false }],
        npcs: [],
      };
      const occlusionOverlay: MapView = {
        ...occlusionBase,
        overlays: [{ kind: 'move', tiles: [{ x: 6, y: 4 }] }],
      };
      const occlusionActorless: MapView = { ...occlusionBase, units: [] };
      camera.centreOn({ x: 6, y: 4 });
      const occlusionBefore = drawOcclusionComparison(occlusionBase);
      const occlusionAfter = drawOcclusionComparison(occlusionOverlay);
      const occlusionActorlessCrop = drawOcclusionComparison(occlusionActorless);

      // Exercise the valid, unadorned combat aim shape through the real backend.
      // A normal same-elevation, clear target has no cue pixels and must be a no-op.
      const noCuesView: MapView = {
        ...cueView,
        units: cueView.units.map((unit) => ({ ...unit, showHealth: false })),
        overlays: [],
        hoverTile: null,
        path: [],
        pathFrom: null,
        aimArc: null,
        exits: [],
        targetReticle: null,
        selectedUnitId: null,
        npcs: cueView.npcs.map((npc) => ({ ...npc, quiet: true })),
      };
      const plainReticleView: MapView = {
        ...noCuesView,
        // Match the initially observed staged reticle position so the no-op
        // crop covers the mark even when combat has since advanced the unit.
        targetReticle: { pos: { x: 8, y: 5 }, elevation: null, obscured: false },
      };
      const noOpBase = drawComparisonView(noCuesView, 'targetReticle');
      const plainReticle = drawComparisonView(plainReticleView, 'targetReticle');

      // Cache reuse is measured synchronously so the animated app loop cannot
      // add unrelated frames between the repeated source draws.
      camera.scale = requestedZoom;
      centreOnMark('healthBar');
      captureMark('healthBar'); // Assert the spike's complete padded bounds are visible.
      const spikeToken = () => {
        for (const [key, entry] of renderer.backend.pixelMarkDrawables.entries) {
          if (key.includes('#d94a3a') && entry.drawable) return { key, source: entry.drawable };
        }
        return null;
      };
      const warmStart = performance.now();
      renderer.draw(cueView);
      const warmMs = performance.now() - warmStart;
      const warm = renderer.backend.pixelMarkDrawables.rasterizationCount;
      const warmSpike = spikeToken();
      const repeatStart = performance.now();
      renderer.draw(cueView);
      const repeatedMs = performance.now() - repeatStart;
      const repeated = renderer.backend.pixelMarkDrawables.rasterizationCount;
      const repeatedSpike = spikeToken();
      camera.panBy(0, 1);
      renderer.draw(cueView);
      const smallPan = renderer.backend.pixelMarkDrawables.rasterizationCount;
      const panSpike = spikeToken();

      const contrastRules = {} as Record<
        'move' | 'target' | 'area' | 'rangeBonus' | 'hover' | 'path',
        string
      >;
      observedBackend[adapterName] = (...args: unknown[]): unknown => {
        const cuesIndex = adapterName === 'drawPixelCues' ? 0 : 2;
        const cues = args[cuesIndex] as readonly PixelOverlayCue[] | undefined;
        for (const cue of cues ?? []) {
          for (const name of ['move', 'target', 'area', 'rangeBonus', 'hover', 'path'] as const) {
            if (contrastRules[name] || !prefixes[name].some((prefix) => cue.id.startsWith(prefix)))
              continue;
            contrastRules[name] = JSON.stringify({ spec: cue.spec, alpha: cue.alpha ?? 1 });
          }
        }
        return unwrapped.apply(observedBackend, args);
      };
      try {
        renderer.draw({ ...cueView, crispOverlays: true });
      } finally {
        observedBackend[adapterName] = unwrapped;
      }

      const crops = {} as Record<MarkName, { before: Crop; after: Crop }>;
      for (const name of Object.keys(centres) as MarkName[])
        crops[name] = { before: before[name], after: after[name] };
      return {
        pairCapture: {
          mode: camera.viewport.dpr === 2 ? 'phase-safe-groups' : 'original',
          afterDraws,
          beforeDraws,
          warmupDraws,
          totalDraws: afterDraws + beforeDraws + warmupDraws,
          cropReadbacks: names.length * 2 + warmupDraws,
          pairMs,
          groups: usedGroups,
        },
        alphaProbes,
        ruleSignatures,
        contrastRules,
        crops: {
          ...crops,
          plainReticle,
          noOpBase,
          occlusion: {
            before: occlusionBefore,
            after: occlusionAfter,
            actorless: occlusionActorlessCrop,
          },
        },
        cache: {
          warm,
          repeated,
          smallPan,
          entries: renderer.backend.pixelMarkDrawables.size,
          bytes: renderer.backend.pixelMarkDrawables.byteLength,
          warmMs,
          repeatedMs,
          spike: {
            warmKey: warmSpike?.key ?? null,
            repeatedKey: repeatedSpike?.key ?? null,
            panKey: panSpike?.key ?? null,
            repeatSameSource: Boolean(warmSpike && repeatedSpike?.source === warmSpike.source),
            panSameSource: Boolean(warmSpike && panSpike?.source === warmSpike.source),
          },
        },
        actual: {
          dpr: camera.viewport.dpr,
          scale: camera.scale,
          tilePx: 64 * camera.scale,
          targetAnchor: emittedTargetAnchor as { x: number; y: number },
          anchors: cueAnchors,
          markGeometry: cueGeometry,
          markScreenRects,
          drawableKeys: [...renderer.backend.pixelMarkDrawables.entries.keys()],
        },
      };
    },
    {
      requestedZoom: zoom,
      centres: MARK_CENTRES,
      talkCue: talkPipMark({ x: 100, y: 100 }, 0.7),
      talkPipLift: npcPipLift('unit.fire.kaya', 1),
      footLine: FOOT_LINE,
    },
  );
}

async function backendRun(
  browser: Browser,
  backend: 'canvas' | 'webgl',
  dpr: number,
  zoomsToCapture: readonly (1 | 2 | 3)[] = [1, 2, 3],
) {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL as string,
    viewport: VIEWPORT,
    deviceScaleFactor: dpr,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    mkdirSync(REVIEW_DIR, { recursive: true });
    if (dpr === 1) await captureVillageOverlays(page, backend);
    const gameplayTiming = await captureGameplayMove(page, backend, dpr);
    const zooms = {} as Record<'1' | '2' | '3', Awaited<ReturnType<typeof captureStagedMarks>>>;
    for (const zoom of zoomsToCapture) {
      const captured = await captureStagedMarks(page, zoom);
      zooms[String(zoom) as '1' | '2' | '3'] = captured;
      if (dpr === 2)
        writeFileSync(
          resolve(REVIEW_DIR, `capture-plan-${backend}-dpr2-zoom${zoom}.json`),
          `${JSON.stringify(captured.pairCapture, null, 2)}\n`,
        );
    }
    return { zooms, gameplayTiming };
  } finally {
    await context.close();
  }
}

for (const dpr of [1, 2] as const) {
  test(`pixel overlay marks render with backend parity at DPR ${dpr}, camera zoom 1, 2 and 3`, async ({
    browser,
  }) => {
    test.setTimeout(600_000);
    allowSoftwareWebgl(test, 'webgl');
    const canvas = await backendRun(browser, 'canvas', dpr);
    const webgl = await backendRun(browser, 'webgl', dpr);
    const masks = {
      canvas: {} as Record<'1' | '2' | '3', Record<MarkName, MarkMetric>>,
      webgl: {} as Record<'1' | '2' | '3', Record<MarkName, MarkMetric>>,
    };

    for (const zoom of [1, 2, 3] as const) {
      const canvasRun = canvas.zooms[String(zoom) as '1' | '2' | '3'];
      const webglRun = webgl.zooms[String(zoom) as '1' | '2' | '3'];
      expect(canvasRun.actual).toMatchObject({ dpr, scale: zoom, tilePx: 64 * zoom });
      expect(webglRun.actual).toMatchObject({ dpr, scale: zoom, tilePx: 64 * zoom });
      for (const name of ['targetReticle', 'selected', 'ko', 'healthBar', 'exit'] as const) {
        const canvasAnchor = canvasRun.actual.anchors[name];
        const pixiAnchor = webglRun.actual.anchors[name];
        expect(canvasAnchor, `${name} emits a Canvas world anchor`).toBeTruthy();
        expect(pixiAnchor, `${name} emits a Pixi world anchor`).toBeTruthy();
        if (!canvasAnchor || !pixiAnchor) continue;
        expect(
          Math.abs(canvasAnchor.x - pixiAnchor.x),
          `${name} anchor x agrees within one G1 pixel at zoom ${zoom}`,
        ).toBeLessThanOrEqual(1);
        expect(
          Math.abs(canvasAnchor.y - pixiAnchor.y),
          `${name} anchor y agrees within one G1 pixel at zoom ${zoom}`,
        ).toBeLessThanOrEqual(1);
      }
      for (const name of MARK_NAMES) {
        expect(
          canvasRun.ruleSignatures[name],
          `${name} uses the same authored geometry, palette and opacity on both backends`,
        ).toBe(webglRun.ruleSignatures[name]);
      }
      expect(JSON.parse(canvasRun.ruleSignatures.exit).alpha).toBeCloseTo(0.9, 9);
      expect(JSON.parse(webglRun.ruleSignatures.exit).alpha).toBeCloseTo(0.9, 9);
      for (const name of ['move', 'target', 'area', 'rangeBonus', 'hover', 'path'] as const) {
        expect(
          canvasRun.contrastRules[name],
          `${name} emits a High Contrast Canvas rule`,
        ).toBeTruthy();
        expect(
          webglRun.contrastRules[name],
          `${name} emits a High Contrast Pixi rule`,
        ).toBeTruthy();
        expect(
          canvasRun.contrastRules[name],
          `${name} keeps the same High Contrast geometry, palette and opacity across backends`,
        ).toBe(webglRun.contrastRules[name]);
      }
      expect(canvasRun.contrastRules.move).not.toBe(canvasRun.ruleSignatures.move);
      expect(webglRun.contrastRules.move).not.toBe(webglRun.ruleSignatures.move);
      expect(canvasRun.cache.repeated, 'a warm repeated frame must reuse mark sources').toBe(
        canvasRun.cache.warm,
      );
      expect(canvasRun.cache.smallPan, 'a small camera pan must reuse mark sources').toBe(
        canvasRun.cache.warm,
      );
      expect(webglRun.cache.repeated, 'a warm repeated frame must reuse mark sources').toBe(
        webglRun.cache.warm,
      );
      expect(webglRun.cache.smallPan, 'a small camera pan must reuse mark sources').toBe(
        webglRun.cache.warm,
      );
      for (const [backend, cache] of [
        ['canvas', canvasRun.cache],
        ['pixi', webglRun.cache],
      ] as const) {
        expect(cache.spike.warmKey, `${backend} cached the enemy spike source`).toBeTruthy();
        expect(cache.spike.repeatedKey, `${backend} spike key is stable on a repeated frame`).toBe(
          cache.spike.warmKey,
        );
        expect(cache.spike.panKey, `${backend} spike key is stable after a 1 CSS px Y pan`).toBe(
          cache.spike.warmKey,
        );
        expect(cache.spike.repeatSameSource).toBe(true);
        expect(cache.spike.panSameSource).toBe(true);
      }
      expect(canvasRun.cache.entries).toBeGreaterThan(0);
      expect(webglRun.cache.entries).toBeGreaterThan(0);
      expect(canvasRun.cache.bytes).toBeGreaterThan(0);
      expect(webglRun.cache.bytes).toBeGreaterThan(0);
      test.info().annotations.push({
        type: 'pixel-overlay-timing',
        description: `DPR${dpr} zoom${zoom} Canvas warm=${canvasRun.cache.warmMs.toFixed(2)}ms repeat=${canvasRun.cache.repeatedMs.toFixed(2)}ms; Pixi warm=${webglRun.cache.warmMs.toFixed(2)}ms repeat=${webglRun.cache.repeatedMs.toFixed(2)}ms`,
      });
      test.info().annotations.push({
        type: 'pixel-overlay-cache',
        description: `DPR${dpr} zoom${zoom} Canvas raster=${canvasRun.cache.warm}/${canvasRun.cache.repeated}/${canvasRun.cache.smallPan} spike=${canvasRun.cache.spike.repeatSameSource}/${canvasRun.cache.spike.panSameSource}; Pixi raster=${webglRun.cache.warm}/${webglRun.cache.repeated}/${webglRun.cache.smallPan} spike=${webglRun.cache.spike.repeatSameSource}/${webglRun.cache.spike.panSameSource}`,
      });
      masks.canvas[String(zoom) as '1' | '2' | '3'] = {} as Record<MarkName, MarkMetric>;
      masks.webgl[String(zoom) as '1' | '2' | '3'] = {} as Record<MarkName, MarkMetric>;

      for (const name of MARK_NAMES) {
        const canvasCrop = canvasRun.crops[name];
        const webglCrop = webglRun.crops[name];
        for (const [backend, probe] of [
          ['Canvas', canvasRun.alphaProbes[name]],
          ['Pixi', webglRun.alphaProbes[name]],
        ] as const) {
          expect(probe.offsetCss).toBe(dpr === 2 ? 0.5 : 0);
          expect(
            probe.nonzero,
            `${backend} ${name} rendered onto a transparent target`,
          ).toBeGreaterThan(0);
          expect(
            probe.unexpected,
            `${backend} ${name} has only transparent or authored alpha at zoom ${zoom}, DPR ${dpr}; observed ${probe.observed}, allowed ${probe.allowed}`,
          ).toBe(0);
          expect(
            probe.partialBlocks,
            `${backend} ${name} has whole G1 pixel blocks at zoom ${zoom}, DPR ${dpr}`,
          ).toBe(0);
        }
        const canvasMask = maskMetrics(canvasCrop.before.dataUrl, canvasCrop.after.dataUrl);
        const webglMask = maskMetrics(webglCrop.before.dataUrl, webglCrop.after.dataUrl);
        masks.canvas[String(zoom) as '1' | '2' | '3'][name] = canvasMask;
        masks.webgl[String(zoom) as '1' | '2' | '3'][name] = webglMask;
        for (const [backend, crop] of [
          ['canvas', canvasCrop.after],
          ['webgl', webglCrop.after],
        ] as const) {
          writeFileSync(
            resolve(REVIEW_DIR, `mark-${backend}-dpr${dpr}-zoom${zoom}-${name}.png`),
            Buffer.from(crop.dataUrl.split(',')[1] ?? '', 'base64'),
          );
        }
        for (const [backend, crop] of [
          ['canvas', canvasCrop.before],
          ['webgl', webglCrop.before],
        ] as const) {
          writeFileSync(
            resolve(REVIEW_DIR, `mark-${backend}-dpr${dpr}-zoom${zoom}-${name}-before.png`),
            Buffer.from(crop.dataUrl.split(',')[1] ?? '', 'base64'),
          );
        }
        expect(
          canvasMask.pixels,
          `${name} is visible in the Canvas crop at zoom ${zoom}`,
        ).toBeGreaterThan(0);
        expect(
          webglMask.pixels,
          `${name} is visible in the Pixi crop at zoom ${zoom}`,
        ).toBeGreaterThan(0);
        if (name === 'talk') {
          const edge = zoom * dpr;
          for (const [backend, mask] of [
            ['Canvas', canvasMask],
            ['Pixi', webglMask],
          ] as const) {
            expect(
              mask.bounds.x,
              `${backend} talk pip stays inside the crop's left edge`,
            ).toBeGreaterThanOrEqual(edge);
            expect(
              mask.bounds.y,
              `${backend} talk pip stays inside the crop's top edge`,
            ).toBeGreaterThanOrEqual(edge);
            expect(
              mask.width - mask.bounds.x - mask.bounds.width,
              `${backend} talk pip stays inside the crop's right edge`,
            ).toBeGreaterThanOrEqual(edge);
            expect(
              mask.height - mask.bounds.y - mask.bounds.height,
              `${backend} talk pip stays inside the crop's bottom edge`,
            ).toBeGreaterThanOrEqual(edge);
            expect(
              Math.abs(mask.bounds.width - 9 * edge),
              `${backend} talk pip retains its full radius-4 circle`,
            ).toBeLessThanOrEqual(edge);
            expect(
              Math.abs(mask.bounds.height - 9 * edge),
              `${backend} talk pip retains its full radius-4 circle`,
            ).toBeLessThanOrEqual(edge);
          }
        }

        // One G1 pixel of edge allowance, represented in device pixels at this
        // actual CSS zoom and DPR; interior coverage must still agree closely.
        const tolerance = zoom * dpr;
        expect(
          Math.abs(canvasMask.bounds.width - webglMask.bounds.width),
          `${name} mask width agrees across backends at zoom ${zoom}`,
        ).toBeLessThanOrEqual(tolerance);
        expect(
          Math.abs(canvasMask.bounds.height - webglMask.bounds.height),
          `${name} mask height agrees across backends at zoom ${zoom}`,
        ).toBeLessThanOrEqual(tolerance);
        expect(
          maskCoverageWithin(canvasMask, webglMask, tolerance),
          `${name} Canvas pixels match a Pixi pixel within one G1 edge at zoom ${zoom}`,
        ).toBeGreaterThanOrEqual(0.98);
        expect(
          maskCoverageWithin(webglMask, canvasMask, tolerance),
          `${name} Pixi pixels match a Canvas pixel within one G1 edge at zoom ${zoom}`,
        ).toBeGreaterThanOrEqual(0.98);
      }

      for (const [backend, run] of [
        ['canvas', canvasRun],
        ['webgl', webglRun],
      ] as const) {
        const occlusion = maskMetrics(
          run.crops.occlusion.before.dataUrl,
          run.crops.occlusion.after.dataUrl,
        );
        const actorControl = maskMetrics(
          run.crops.occlusion.actorless.dataUrl,
          run.crops.occlusion.before.dataUrl,
          60,
        );
        const actorInterior = erodeMask(actorControl, 2 * zoom * dpr);
        const torsoBox = torsoInteriorBox(actorControl, zoom, dpr);
        const torsoPixels = maskPixelsInBox(actorInterior, torsoBox);
        expect(
          torsoPixels,
          `${backend} eroded torso interior remains a meaningful opaque control`,
        ).toBeGreaterThan(40 * zoom * zoom * dpr * dpr);
        expect(
          maskIntersectionPixelsInBox(actorInterior, occlusion, torsoBox),
          `${backend} move-range mask leaves the opaque torso interior unchanged`,
        ).toBe(0);
      }

      const blankCanvasMask = maskMetrics(
        canvasRun.crops.noOpBase.dataUrl,
        canvasRun.crops.plainReticle.dataUrl,
      );
      const blankWebglMask = maskMetrics(
        webglRun.crops.noOpBase.dataUrl,
        webglRun.crops.plainReticle.dataUrl,
      );
      expect(blankCanvasMask.pixels, 'null/false target cues do not draw a Canvas marker').toBe(0);
      expect(blankWebglMask.pixels, 'null/false target cues do not draw a Pixi marker').toBe(0);
    }

    for (const backend of ['canvas', 'webgl'] as const) {
      for (const name of ['selected', 'ko'] as const) {
        const atN1 = masks[backend]['1'][name].bounds;
        const atN2 = masks[backend]['2'][name].bounds;
        const atN3 = masks[backend]['3'][name].bounds;
        expect(atN1.width).toBeGreaterThan(0);
        expect(atN1.height).toBeGreaterThan(0);
        expect(atN2.width).toBeGreaterThan(0);
        expect(atN2.height).toBeGreaterThan(0);
        expect(atN3.width).toBeGreaterThan(0);
        expect(atN3.height).toBeGreaterThan(0);
        expect(
          Math.abs(atN2.width - 2 * atN1.width),
          `${backend} ${name} width preserves its world size at camera zoom 2`,
        ).toBeLessThanOrEqual(6 * dpr);
        expect(
          Math.abs(atN2.height - 2 * atN1.height),
          `${backend} ${name} height preserves its world size at camera zoom 2`,
        ).toBeLessThanOrEqual(6 * dpr);
        expect(
          Math.abs(atN3.width - 3 * atN1.width),
          `${backend} ${name} width preserves its world size at camera zoom 3`,
        ).toBeLessThanOrEqual(9 * dpr);
        expect(
          Math.abs(atN3.height - 3 * atN1.height),
          `${backend} ${name} height preserves its world size at camera zoom 3`,
        ).toBeLessThanOrEqual(9 * dpr);
      }
    }
    test.info().annotations.push({
      type: 'real-gameplay-draw-timing',
      description: `DPR${dpr} preview Canvas first=${canvas.gameplayTiming.firstDrawMs.toFixed(2)}ms repeat=${canvas.gameplayTiming.repeatedDrawMs.toFixed(2)}ms (${canvas.gameplayTiming.cues}); Pixi first=${webgl.gameplayTiming.firstDrawMs.toFixed(2)}ms repeat=${webgl.gameplayTiming.repeatedDrawMs.toFixed(2)}ms (${webgl.gameplayTiming.cues})`,
    });
  });
}

for (const backend of ['canvas', 'webgl'] as const) {
  test(`raised quarry top receives real mouse hover and touch pick on ${backend}`, async ({
    browser,
  }) => {
    allowSoftwareWebgl(test, backend);
    const context = await browser.newContext({
      baseURL: test.info().project.use.baseURL as string,
      viewport: VIEWPORT,
      deviceScaleFactor: 2,
      hasTouch: true,
    });
    const page = await context.newPage();
    try {
      await resetStorage(page, `?renderer=${backend}`);
      await startGame(page, ['Kaya'], ['kaya'], 'pixel-overlay-raised-pick');
      await enterNode(page, 'quarry_after_explore');
      await waitForIdle(page);
      const point = await page.evaluate((lift) => {
        type PickScene = {
          renderer: {
            camera: {
              scale: number;
              projection: string;
              centreOn(pos: { x: number; y: number }): void;
              project(pos: { x: number; y: number }): { x: number; y: number };
              pickTile(x: number, y: number, grid: MapView['grid']): { x: number; y: number };
            };
            lastView: MapView | null;
          };
          requestWalk(pos: { x: number; y: number }): void;
          hover: { x: number; y: number } | null;
        };
        const scene = (window.fnt!.app as unknown as { scene: PickScene }).scene;
        const camera = scene.renderer.camera;
        const grid = scene.renderer.lastView?.grid;
        if (!grid || camera.projection !== 'oblique')
          throw new Error('Missing oblique quarry view');
        camera.centreOn({ x: 5.5, y: 1.5 });
        const flat = camera.project({ x: 5.5, y: 1.5 });
        const drawn = { x: flat.x, y: flat.y - lift * 64 * camera.scale };
        const picked = camera.pickTile(drawn.x, drawn.y, grid);
        if (picked.x !== 5 || picked.y !== 1)
          throw new Error(`Raised top pick missed quarry stair: ${picked.x},${picked.y}`);
        const original = scene.requestWalk;
        (window as Window & { raisedTouchPick?: { x: number; y: number } }).raisedTouchPick =
          undefined;
        scene.requestWalk = function (pos) {
          (window as Window & { raisedTouchPick?: { x: number; y: number } }).raisedTouchPick = pos;
          original.call(scene, pos);
        };
        return { ...drawn, scale: camera.scale };
      }, TIER_LIFT);
      const box = await page.locator('.map-canvas').boundingBox();
      if (!box) throw new Error('Missing quarry canvas bounds');
      expect(point.x).toBeGreaterThan(0);
      expect(point.y).toBeGreaterThan(0);
      expect(point.x).toBeLessThan(box.width);
      expect(point.y).toBeLessThan(box.height);
      await page.mouse.move(box.x + point.x, box.y + point.y);
      await expect
        .poll(() =>
          page.evaluate(() => {
            const scene = (
              window.fnt!.app as unknown as {
                scene: {
                  hover: { x: number; y: number } | null;
                  renderer: { lastView: MapView | null };
                };
              }
            ).scene;
            return { hover: scene.hover, drawn: scene.renderer.lastView?.hoverTile ?? null };
          }),
        )
        .toEqual({ hover: { x: 5, y: 1 }, drawn: { x: 5, y: 1 } });
      const hovered = await page.evaluate(() => {
        const renderer = (
          window.fnt!.app as unknown as {
            scene: {
              renderer: {
                backendName: string;
                backend: { marksKey?: string };
                lastView: MapView | null;
                draw(view: MapView): void;
              };
            };
          }
        ).scene.renderer;
        const view = renderer.lastView;
        const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
        if (!view || !canvas) throw new Error('Missing drawn quarry hover view');
        const draw = (hoverTile: MapView['hoverTile']): string => {
          if (renderer.backendName === 'webgl') renderer.backend.marksKey = '';
          renderer.draw({ ...view, hoverTile, time: 640_000, reducedMotion: true });
          return canvas.toDataURL('image/png');
        };
        return { before: draw(null), after: draw({ x: 5, y: 1 }) };
      });
      const hoverMask = maskMetrics(hovered.before, hovered.after, 8);
      const x = point.x * 2;
      const y = point.y * 2;
      const radius = 64 * point.scale * 2;
      expect(
        maskPixelsInBox(hoverMask, {
          left: Math.floor(x - radius),
          top: Math.floor(y - radius),
          right: Math.ceil(x + radius),
          bottom: Math.ceil(y + radius),
        }),
        `${backend} paints the hover highlight around the raised stair's visible top`,
      ).toBeGreaterThan(0);
      mkdirSync(REVIEW_DIR, { recursive: true });
      for (const [phase, dataUrl] of [
        ['before', hovered.before],
        ['after', hovered.after],
      ] as const) {
        writeFileSync(
          resolve(REVIEW_DIR, `raised-quarry-${backend}-dpr2-hover-${phase}.png`),
          Buffer.from(dataUrl.split(',')[1] ?? '', 'base64'),
        );
      }
      await page.touchscreen.tap(box.x + point.x, box.y + point.y);
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as Window & { raisedTouchPick?: { x: number; y: number } }).raisedTouchPick ??
              null,
          ),
        )
        .toEqual({ x: 5, y: 1 });
      await page.locator('.map-canvas').screenshot({
        path: resolve(REVIEW_DIR, `raised-quarry-${backend}-dpr2-hover-touch.png`),
      });
    } finally {
      await context.close();
    }
  });
}
