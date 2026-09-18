import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SceneScenery, Vec2 } from '../core/types';
import { Camera } from './camera';
import type { Projection } from './projection';
import { sceneImages, sceneryOpacity, sceneryOpacities } from './scene';
import type { MapView, RenderUnit } from './view';

const SIZE = 128;
const origin = { x: 2, y: 2 };

function unit(pos: Vec2, extra: Partial<RenderUnit> = {}): RenderUnit {
  return {
    id: 'walker',
    pos,
    size: 1,
    sprite: 'unit.hero.kaya',
    name: 'Walker',
    faction: 'party',
    hp: 10,
    maxHp: 10,
    statuses: [],
    fallen: false,
    ...extra,
  };
}

function view(extra: Partial<MapView> = {}): MapView {
  return {
    grid: { width: 8, height: 8, tiles: [] },
    units: [],
    npcs: [],
    props: [],
    path: [],
    pathFrom: null,
    overlays: [],
    emitters: [],
    floaters: [],
    aimArc: null,
    cameraNudge: { x: 0, y: 0 },
    activeUnitId: null,
    selectedUnitId: null,
    hoverTile: null,
    exit: null,
    hatch: false,
    gridLines: false,
    crispOverlays: false,
    atmosphere: true,
    backdrop: null,
    time: 0,
    ...extra,
  };
}

function roof(camera: Camera): SceneScenery {
  const foot = camera.groundPoint({ x: 2.5, y: 2.5 });
  return {
    id: 'roof',
    url: 'test-roof.png',
    x: foot.x - 64,
    y: foot.y - 64,
    width: SIZE,
    height: SIZE,
    footprint: [{ x: 3, y: 3 }],
    depth: { x: 4, y: 4 },
    fadeWhenOccluding: true,
  };
}

/** Stub only raster readback; use the real alpha sampling, camera and cutaway logic. */
function installImage(alpha: (x: number, y: number) => number) {
  const pixels = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) pixels[(y * SIZE + x) * 4 + 3] = alpha(x, y);
  const image = { naturalWidth: 256, naturalHeight: 256 } as HTMLImageElement;
  const drawImage = vi.fn();
  const getImageData = vi.fn(() => ({ data: pixels }));
  const createElement = vi.fn(() => ({
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({ drawImage, getImageData })),
  }));
  vi.stubGlobal('document', { createElement });
  vi.spyOn(sceneImages, 'get').mockReturnValue(image);
  return { drawImage, getImageData, createElement };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

for (const projection of ['orthographic', 'oblique'] as const satisfies readonly Projection[]) {
  describe(`${projection} scenery cutaway`, () => {
    const camera = new Camera(
      { width: 800, height: 600, dpr: 2 },
      { width: 8, height: 8 },
      projection,
    );
    beforeEach(() => {
      camera.scale = 1;
      camera.offsetX = 0;
      camera.offsetY = 0;
    });

    it('fades an opaque roof covering an upright actor, independently of pan and zoom', () => {
      installImage((x, y) => (x >= 32 && x < 96 && y >= 16 && y < 64 ? 255 : 0));
      const scene = roof(camera),
        state = view({ units: [unit(origin)] });
      expect(sceneryOpacity(scene, state, camera)).toBe(0.28);
      camera.scale = 2;
      camera.offsetX = 300;
      camera.offsetY = 150;
      expect(sceneryOpacity(scene, state, camera)).toBe(0.28);
    });

    it('does not fade for transparent padding even when the actor is inside the image rectangle', () => {
      installImage((x) => (x >= 32 && x < 96 ? 255 : 0));
      const scene = roof(camera);
      expect(
        sceneryOpacity({ ...scene, x: scene.x + 56 }, view({ units: [unit(origin)] }), camera),
      ).toBe(1);
    });

    it('does not fade for an actor in front of the roof or outside its rectangle', () => {
      installImage(() => 255);
      const scene = roof(camera);
      expect(
        sceneryOpacity(
          { ...scene, depth: { x: 0, y: 0 } },
          view({ units: [unit(origin)] }),
          camera,
        ),
      ).toBe(1);
      expect(sceneryOpacity(scene, view({ units: [unit({ x: 6, y: 1 })] }), camera)).toBe(1);
      expect(sceneryOpacity(scene, view({ units: [unit(origin, { fallen: true })] }), camera)).toBe(
        1,
      );
    });

    it('ignores distant NPCs but reveals a nearby conversation partner', () => {
      installImage(() => 255);
      const scene = roof(camera);
      const npc = { pos: origin, name: 'Villager', sprite: 'npc.elder' };
      expect(sceneryOpacity(scene, view({ npcs: [npc] }), camera)).toBe(1);
      expect(
        sceneryOpacity(scene, view({ npcs: [npc], units: [unit({ x: 7, y: 7 })] }), camera),
      ).toBe(1);
      // The party itself is outside the image; only the nearby NPC can fade it.
      expect(
        sceneryOpacity(scene, view({ npcs: [npc], units: [unit({ x: 5, y: 2 })] }), camera),
      ).toBe(0.28);
      expect(
        sceneryOpacity(scene, view({ npcs: [npc], units: [unit({ x: 5.01, y: 2 })] }), camera),
      ).toBe(1);
    });

    it('does not fade an unoccupied roof because a future path crosses it', () => {
      installImage((_x, y) => (y >= 62 && y <= 66 ? 255 : 0));
      const scene = roof(camera);
      expect(sceneryOpacity(scene, view({ units: [unit(origin)] }), camera)).toBe(1);
      expect(sceneryOpacity(scene, view({ path: [origin] }), camera)).toBe(1);
    });

    it('probes the actual scaled hero and nearby NPC height', () => {
      installImage((_x, y) => (y >= 10 && y <= 28 ? 255 : 0));
      const base = roof(camera);
      const scene = { ...base, y: base.y - 32 };
      expect(sceneryOpacity(scene, view({ units: [unit(origin)] }), camera)).toBe(1);
      expect(sceneryOpacity(scene, view({ units: [unit(origin, { scale: 1.25 })] }), camera)).toBe(
        0.28,
      );
      const state = view({
        units: [unit({ x: 5, y: 2 })],
        npcs: [{ pos: origin, sprite: 'npc.elder', name: 'Villager', scale: 1.5 }],
      });
      expect(sceneryOpacity(scene, state, camera)).toBe(0.28);
    });

    it('uses a two-cell encounter marker atlas footprint for roof overlap', () => {
      installImage((x) => (x >= 94 && x <= 98 ? 255 : 0));
      const scene = roof(camera);
      expect(
        sceneryOpacity(
          scene,
          view({
            units: [unit({ x: 5, y: 2 })],
            npcs: [{ pos: origin, sprite: 'unit.enemy.grumbler', name: 'Grumbler' }],
          }),
          camera,
        ),
      ).toBe(0.28);
    });

    it('uses the two-cell footprint centre and animated position', () => {
      installImage((x) => (x >= 94 && x <= 98 ? 255 : 0));
      const scene = roof(camera);
      expect(sceneryOpacity(scene, view({ units: [unit(origin)] }), camera)).toBe(1);
      expect(sceneryOpacity(scene, view({ units: [unit(origin, { size: 2 })] }), camera)).toBe(
        0.28,
      );
      expect(
        sceneryOpacity(
          scene,
          view({ units: [unit({ x: 7, y: 7 }, { size: 2, renderPos: origin })] }),
          camera,
        ),
      ).toBe(0.28);
    });
  });
}

it('reuses an image mask across frames and does not load an opted-out roof', () => {
  const raster = installImage(() => 255);
  const camera = new Camera(
    { width: 800, height: 600, dpr: 1 },
    { width: 8, height: 8 },
    'oblique',
  );
  const scene = roof(camera),
    state = view({ units: [unit(origin)] });
  expect(sceneryOpacity({ ...scene, fadeWhenOccluding: false }, state, camera)).toBe(1);
  expect(sceneImages.get).not.toHaveBeenCalled();
  expect(sceneryOpacity(scene, state, camera)).toBe(0.28);
  expect(sceneryOpacity(scene, state, camera)).toBe(0.28);
  expect(raster.drawImage).toHaveBeenCalledTimes(1);
  expect(raster.getImageData).toHaveBeenCalledTimes(1);
});

it('leaves an unloaded image opaque without rasterizing', () => {
  const raster = installImage(() => 255);
  vi.mocked(sceneImages.get).mockReturnValue(null);
  const camera = new Camera(
    { width: 800, height: 600, dpr: 1 },
    { width: 8, height: 8 },
    'oblique',
  );
  expect(sceneryOpacity(roof(camera), view({ units: [unit(origin)] }), camera)).toBe(1);
  expect(raster.createElement).not.toHaveBeenCalled();
});

it('cuts away only the opaque slice on a shared page and reuses each cropped mask', () => {
  const raster = installImage(() => 255);
  const opaque = new Uint8ClampedArray(SIZE * SIZE * 4).fill(255);
  const clear = new Uint8ClampedArray(SIZE * SIZE * 4);
  raster.drawImage.mockImplementation((_image: unknown, sourceX: number) => {
    raster.getImageData.mockReturnValue({ data: sourceX === 2 ? opaque : clear });
  });
  const camera = new Camera(
    { width: 800, height: 600, dpr: 1 },
    { width: 8, height: 8 },
    'oblique',
  );
  const base = roof(camera),
    state = view({ units: [unit(origin)] });
  const a = { ...base, sourceRect: { x: 2, y: 2, width: 32, height: 64 } };
  const b = { ...base, sourceRect: { x: 38, y: 2, width: 32, height: 64 } };
  for (let i = 0; i < 3; i++) {
    expect(sceneryOpacity(a, state, camera)).toBe(0.28);
    expect(sceneryOpacity(b, state, camera)).toBe(1);
  }
  expect(raster.drawImage).toHaveBeenCalledTimes(2);
  expect(raster.drawImage).toHaveBeenCalledWith(expect.anything(), 2, 2, 32, 64, 0, 0, SIZE, SIZE);
  expect(raster.drawImage).toHaveBeenCalledWith(expect.anything(), 38, 2, 32, 64, 0, 0, SIZE, SIZE);
  vi.mocked(sceneImages.get).mockReturnValue({
    naturalWidth: 256,
    naturalHeight: 256,
  } as HTMLImageElement);
  expect(sceneryOpacity(a, state, camera)).toBe(0.28);
  expect(raster.drawImage).toHaveBeenCalledTimes(3);
});

it('bounds masks to 32 slice regions per decoded page', () => {
  const raster = installImage(() => 255);
  const camera = new Camera(
    { width: 800, height: 600, dpr: 1 },
    { width: 8, height: 8 },
    'oblique',
  );
  const base = roof(camera),
    state = view({ units: [unit(origin)] });
  const slice = (x: number) => ({ ...base, sourceRect: { x, y: 0, width: 16, height: 64 } });
  for (let x = 0; x < 33; x++) expect(sceneryOpacity(slice(x), state, camera)).toBe(0.28);
  expect(raster.getImageData).toHaveBeenCalledTimes(33);
  expect(sceneryOpacity(slice(32), state, camera)).toBe(0.28);
  expect(raster.getImageData).toHaveBeenCalledTimes(33);
  expect(sceneryOpacity(slice(0), state, camera)).toBe(0.28);
  expect(raster.getImageData).toHaveBeenCalledTimes(34);
});

it('fades connected slices together only while an actual occupant occludes a member', () => {
  installImage(() => 255);
  const camera = new Camera(
    { width: 800, height: 600, dpr: 1 },
    { width: 8, height: 8 },
    'oblique',
  );
  const a = { ...roof(camera), fadeGroup: 'west' };
  const b = { ...a, id: 'distant-slice', x: a.x + 1000 };
  const other = { ...b, id: 'other-mass', fadeGroup: 'east' };
  const optOut = { ...b, id: 'opt-out', fadeWhenOccluding: false };
  const pieces = [a, b, other, optOut];
  const state = view({ units: [unit(origin)] });
  expect(sceneryOpacity(b, state, camera)).toBe(1);
  expect([...sceneryOpacities(pieces, state, camera).values()]).toEqual([0.28, 0.28, 1, 1]);
  const moved = view({ units: [unit(origin, { renderPos: { x: 7, y: 7 } })], path: [origin] });
  expect([...sceneryOpacities(pieces, moved, camera).values()]).toEqual([1, 1, 1, 1]);
  expect(sceneryOpacities([b], state, camera).get(b)).toBe(1);
  vi.mocked(sceneImages.get).mockReturnValue(null);
  expect([...sceneryOpacities(pieces, state, camera).values()]).toEqual([1, 1, 1, 1]);
});
