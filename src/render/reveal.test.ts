import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SceneScenery, Vec2 } from '../core/types';
import { Camera } from './camera';
import { REVEAL_MIN, revealBox, revealPixels, revealTint, revealsUnit } from './reveal';
import { sceneImages, sceneryOpacity } from './scene';
import type { MapView, RenderUnit } from './view';

const W = 8;
const H = 12;
/** A figure 4 px wide, columns 2..5, rows 2..11. */
const inFigure = (x: number, y: number) => x >= 2 && x < 6 && y >= 2;
function rgba(on: (x: number, y: number) => boolean): Uint8ClampedArray {
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (on(x, y)) out[(y * W + x) * 4 + 3] = 255;
  return out;
}
const alpha = (pixels: Uint8ClampedArray, x: number, y: number) => pixels[(y * W + x) * 4 + 3];

describe('revealPixels', () => {
  const figure = rgba(inFigure);

  it('draws all of a figure wholly behind a piece, rim at full strength, and nothing outside it', () => {
    const out = revealPixels(
      figure,
      rgba(() => true),
      W,
      H,
    );
    expect(out).not.toBeNull();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) expect(alpha(out!, x, y) !== 0, `${x},${y}`).toBe(inFigure(x, y));
    expect(alpha(out!, 2, 6)).toBe(255);
    expect(alpha(out!, 3, 6)).toBeLessThan(255);
  });

  it('draws only the covered part, so the piece paints everything else', () => {
    const out = revealPixels(
      figure,
      rgba((_x, y) => y >= 6),
      W,
      H,
    )!;
    for (let x = 0; x < W; x++) {
      expect(alpha(out, x, 4), `row 4, ${x}`).toBe(0);
      expect(alpha(out, x, 8) !== 0, `row 8, ${x}`).toBe(inFigure(x, 8));
    }
  });

  it('reveals nothing for less than REVEAL_MIN of the figure covered, and is steady at an edge', () => {
    // Rows 2..11 are 10 rows; one row is 10%, two are 20%, three 30%.
    expect(REVEAL_MIN).toBe(0.25);
    expect(
      revealPixels(
        figure,
        rgba((_x, y) => y >= 10),
        W,
        H,
      ),
    ).toBeNull();
    expect(
      revealPixels(
        figure,
        rgba((_x, y) => y >= 9),
        W,
        H,
      ),
    ).not.toBeNull();
    // One head pixel crossing a chimney's edge moves the fraction by 1/40, not from hidden to shown.
    expect(
      revealPixels(
        figure,
        rgba((x, y) => y === 2 && x === 2),
        W,
        H,
      ),
    ).toBeNull();
    expect(
      revealPixels(
        rgba(() => false),
        rgba(() => true),
        W,
        H,
      ),
    ).toBeNull();
  });
});

describe('who is revealed', () => {
  it('reveals the party, never an enemy or a fallen member', () => {
    expect(revealsUnit({ faction: 'party', fallen: false })).toBe(true);
    expect(revealsUnit({ faction: 'party', fallen: true })).toBe(false);
    expect(revealsUnit({ faction: 'enemy', fallen: false })).toBe(false);
  });

  it('mirrors a frame about its anchor, as both backends flip a sprite', () => {
    expect(revealBox({ x: 10, y: 0, w: 20, h: 40 }, 16, true)).toEqual({
      x: 2,
      y: 0,
      w: 20,
      h: 40,
    });
    expect(revealBox({ x: 10, y: 0, w: 20, h: 40 }, 16, false).x).toBe(10);
  });
});

describe('a house that reveals keeps its paint', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const house: SceneScenery = {
    id: 'house',
    url: 'house.webp',
    x: 0,
    y: 0,
    width: 256,
    height: 256,
    footprint: [{ x: 3, y: 3 }],
    depth: { x: 6, y: 6 },
    fadeWhenOccluding: true,
    revealOccluded: true,
  };
  const member = (pos: Vec2): RenderUnit => ({
    id: 'kaya',
    pos,
    size: 1,
    sprite: 'unit.hero.kaya',
    name: 'Kaya',
    faction: 'party',
    hp: 10,
    maxHp: 10,
    statuses: [],
    fallen: false,
  });
  const view = (extra: Partial<MapView>): MapView =>
    ({ units: [], npcs: [], ...extra }) as unknown as MapView;

  it('stays opaque with a party member or a resident wholly behind it', () => {
    // An image opaque everywhere: anyone behind it is covered head to foot.
    const pixels = new Uint8ClampedArray(128 * 128 * 4).fill(255);
    vi.stubGlobal('document', {
      createElement: () => ({
        getContext: () => ({ drawImage: () => {}, getImageData: () => ({ data: pixels }) }),
      }),
    });
    vi.spyOn(sceneImages, 'get').mockReturnValue({
      naturalWidth: 256,
      naturalHeight: 256,
    } as HTMLImageElement);
    const camera = new Camera(
      { width: 800, height: 600, dpr: 1 },
      { width: 8, height: 8 },
      'orthographic',
    );
    camera.scale = 1;
    camera.offsetX = camera.offsetY = 0;
    const behind = member({ x: 1, y: 1 });
    expect(camera.groundPoint({ x: 1.5, y: 1.5 }).y).toBeLessThan(
      camera.groundPoint(house.depth).y,
    );
    const fading = { ...house, revealOccluded: false };
    const piece = { ...fading, x: camera.groundPoint({ x: 1.5, y: 1.5 }).x - 128 };
    // The control: the same piece without the flag fades over this figure.
    expect(sceneryOpacity(piece, view({ units: [behind] }), camera)).toBe(0.28);
    expect(
      sceneryOpacity({ ...piece, revealOccluded: true }, view({ units: [behind] }), camera),
    ).toBe(1);
    const resident = { id: 'r', pos: { x: 1, y: 1 }, sprite: 'npc.villager', name: 'R' };
    expect(
      sceneryOpacity(
        { ...piece, revealOccluded: true },
        view({ units: [behind], npcs: [resident] }),
        camera,
      ),
    ).toBe(1);
  });
});

describe('the reveal tint per projection', () => {
  it('keeps the tint ADR 0096 shipped on the orthographic board and quiets the top-down one', () => {
    expect(revealTint('orthographic')).toEqual({
      rim: [255, 238, 196, 255],
      fill: [255, 226, 160, 120],
    });
    const topdown = revealTint('topdown');
    expect(topdown.rim.slice(0, 3)).toEqual([255, 238, 196]);
    expect(topdown.rim[3]).toBeLessThan(255);
    expect(topdown.fill[3]).toBeLessThan(120);
    expect(topdown.fill[3]).toBeGreaterThan(0);
  });
});
