import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { BA_DAN_DRESSING, BA_DAN_SCENE } from '../../src/content/scenes/baDan';
import { CAST_PER_PIXEL } from '../../src/render/lighting';
import { decodeWebp } from './lib/webp';
import { CONTACT_FEET } from './ba-dan-garden';
import {
  TREES,
  VILLAGE_VOLUMES,
  FEET,
  contactGround,
  contactMultiplier,
  litRgb,
  logicalToWorld,
  penumbra,
  shadowCover,
  volumeShadow,
  box as volumeBox,
  sunLift,
  worldToLogical,
} from './ba-dan-village-light';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const houses = BA_DAN_SCENE.scenery.filter((p) => p.id.endsWith('-house'));
const box = (piece: { footprint: readonly { x: number; y: number }[] }) => {
  const xs = piece.footprint.map((c) => c.x);
  const ys = piece.footprint.map((c) => c.y);
  return {
    x0: Math.min(...xs),
    x1: Math.max(...xs) + 1,
    y0: Math.min(...ys),
    y1: Math.max(...ys) + 1,
  };
};

it('builds its volumes from the live scene: every house, stall, planter, the bridge and the walls', () => {
  const kinds = new Set(VILLAGE_VOLUMES.map((v) => v.kind));
  expect([...kinds].sort()).toEqual([
    'bridge',
    'house',
    'planter',
    'prop',
    'roof',
    'stall',
    'wall',
  ]);
  for (const house of houses)
    expect(
      VILLAGE_VOLUMES.filter((v) => v.id.startsWith(house.id))
        .map((v) => v.kind)
        .sort(),
      house.id,
    ).toEqual(['house', 'house', 'house', 'roof']); // terrace, plinth, plaster walls, roof
  const stalls = BA_DAN_SCENE.scenery.filter((p) => /merchant-display(-[bc])?\.webp$/.test(p.url));
  expect(stalls.length).toBeGreaterThan(0);
  for (const stall of stalls)
    expect(VILLAGE_VOLUMES.some((v) => v.id.startsWith(stall.id) && v.kind === 'stall')).toBe(true);
  const planters = BA_DAN_SCENE.scenery.filter(
    (p) => /low-planter(-b)?\.webp$/.test(p.url) && p.id !== 'southeast-planter-far',
  );
  for (const planter of planters)
    expect(VILLAGE_VOLUMES.some((v) => v.id.startsWith(planter.id) && v.kind === 'planter')).toBe(
      true,
    );
  // The terrace planters share a sprite in the dressing atlas; each still has its own rim and bed.
  for (const piece of BA_DAN_SCENE.scenery.filter((p) => p.id.startsWith('north-terrace-')))
    expect(
      VILLAGE_VOLUMES.filter((v) => v.id.startsWith(piece.id) && v.kind === 'planter'),
      piece.id,
    ).toHaveLength(2);
  // Every piece of set dressing is built of parts (posts, roofs, rails, a bed and two wheels).
  for (const i of BA_DAN_DRESSING.keys())
    expect(
      VILLAGE_VOLUMES.filter((v) => v.id.startsWith(`d${i}-`) && v.kind === 'prop').length,
      `d${i}`,
    ).toBeGreaterThan(2);
});

it('casts down and to the right by the game key, and never toward the upper left', () => {
  for (const house of houses) {
    const b = box(house);
    const east = logicalToWorld(b.x1 - 0.04, (b.y0 + b.y1) / 2);
    const west = logicalToWorld(b.x0 + 0.04, (b.y0 + b.y1) / 2);
    // Wall top at h: the shadow of its east edge lands (0.42h, 0.27h) from the foot.
    // A point a third of the way along the cast is shadowed; the mirror point up-left is lit.
    const along = 25;
    const probe = {
      x: east.x + along * CAST_PER_PIXEL.x,
      y: east.y + along * CAST_PER_PIXEL.y,
    };
    expect(shadowCover(probe.x, probe.y), `${house.id} shadow east of the wall`).toBeGreaterThan(
      0.5,
    );
    const mirror = {
      x: west.x - along * CAST_PER_PIXEL.x,
      y: west.y - along * CAST_PER_PIXEL.y,
    };
    expect(shadowCover(mirror.x, mirror.y), `${house.id} up-left of the wall`).toBeLessThan(0.05);
  }
  // Nothing in the whole scene shades a ground point that lies up-left of every
  // volume's own base by more than the penumbra: sample up-left rings of each volume.
  // (The terraces: a plinth's up-left is its own terrace.)
  for (const v of VILLAGE_VOLUMES.filter((vol) => vol.id.endsWith('-terrace'))) {
    const s = v.section(1);
    if (!s) continue;
    const corner = logicalToWorld(s.x0, s.y0);
    for (const d of [8, 16, 30])
      expect(
        shadowCover(corner.x - d * CAST_PER_PIXEL.x, corner.y - d * CAST_PER_PIXEL.y),
        `${v.id} at ${d}`,
      ).toBeLessThan(0.05);
  }
});

it('lets a roof cast the shape of a roof, not a slab', () => {
  // The ridge's shadow lies further along the cast than the eaves'; so across
  // the house's width the shadow is wider under the eaves than at the ridge tip.
  const wall = VILLAGE_VOLUMES.find((v) => v.id === 'southwest-house-wall');
  const roof = VILLAGE_VOLUMES.find((v) => v.id === 'southwest-house-roof');
  expect(wall && roof).toBeTruthy();
  const eave = roof!.section(roof!.hMin)!;
  const ridge = roof!.section(roof!.hMax)!;
  expect(ridge.x1 - ridge.x0, 'the roof closes in toward its ridge').toBeLessThan(
    (eave.x1 - eave.x0) * 0.3,
  );
  // The v3 ridge runs the whole length of the roof, its stepped ornaments at both gable ends.
  expect(ridge.y1 - ridge.y0, 'the ridge runs the roof').toBeCloseTo(eave.y1 - eave.y0, 1);
  expect(eave.x1 - eave.x0, 'eaves overhang the walls').toBeGreaterThan(
    wall!.section(wall!.hMin)!.x1 - wall!.section(wall!.hMin)!.x0,
  );
});

it('is crisp at a caster base and soft at its tip', () => {
  expect(penumbra(2)).toBeLessThan(1.5 * 1.3);
  expect(penumbra(160)).toBeGreaterThan(penumbra(2) * 8);
  // Measured on a lone 100-pixel wall: along the cast the shadow's start (the
  // wall's base) falls from light to dark inside a couple of pixels, and its
  // far end (the wall's top edge) takes several times that.
  const wall = volumeBox('probe', 'wall', { x0: 40, x1: 40.5, y0: 40, y1: 44 }, 0, 100);
  const base = logicalToWorld(40.5, 42);
  const along = (t: number): number =>
    volumeShadow(wall, base.x + t * CAST_PER_PIXEL.x, base.y + t * CAST_PER_PIXEL.y);
  // Rising edge inside the wall's own base (starting from the lit side up-left).
  const up = (): number => {
    let t10 = NaN;
    let t90 = NaN;
    for (let t = -40; t < 40; t += 0.25) {
      const c = along(t);
      if (Number.isNaN(t10) && c > 0.1) t10 = t;
      if (Number.isNaN(t90) && c > 0.9) t90 = t;
    }
    return t90 - t10;
  };
  const down = (): number => {
    let t90 = NaN;
    let t10 = NaN;
    for (let t = 20; t < 160; t += 0.25) {
      const c = along(t);
      if (Number.isNaN(t90) && c < 0.9) t90 = t;
      if (Number.isNaN(t10) && c < 0.1) t10 = t;
    }
    return t10 - t90;
  };
  expect(up(), 'crisp at the base').toBeLessThan(6);
  expect(down(), 'soft at the tip').toBeGreaterThan(up() * 3);
});

it('dapples tree shade: light holes at leaf scale, denser near the trunk', () => {
  // The east court tree: its shade falls on open lawn. (The west one's falls on Gao's display.)
  const tree = BA_DAN_SCENE.scenery.find((p) => p.id === 'tree-21-2')!;
  const foot = { x: 1024 + (21 - 2) * 64, y: (21 + 2 + 1) * 32 };
  const share = (r0: number, r1: number): { dark: number; light: number; n: number } => {
    let dark = 0;
    let light = 0;
    let n = 0;
    for (let r = r0; r < r1; r += 3)
      for (let dx = -30; dx <= 30; dx += 3) {
        const c = shadowCover(
          foot.x + r * CAST_PER_PIXEL.x + dx,
          foot.y + r * CAST_PER_PIXEL.y + dx * 0.0,
        );
        n++;
        if (c > 0.7) dark++;
        if (c < 0.2) light++;
      }
    return { dark, light, n };
  };
  expect(tree).toBeTruthy();
  const near = share(20, 70);
  const far = share(100, 190);
  expect(far.light, 'light holes open in the canopy shade').toBeGreaterThan(far.n * 0.04);
  expect(far.dark, 'but there is real shade too').toBeGreaterThan(far.n * 0.1);
  expect(near.dark / near.n, 'denser near the trunk').toBeGreaterThan(far.dark / far.n);
});

it('registers a shadow at the painted base of every house', () => {
  // The wall volume sits on the house's footprint, and the painted plinth's
  // lowest pixels (the sprite's real foot) lie on it, so the shadow starts where
  // the sprite stands, not a tile off.
  for (const house of houses) {
    const b = box(house);
    // The terrace and plinth together stand on the whole footprint; the plaster walls on its east part.
    const own = FEET.filter((f) => f.piece === house.id);
    const s = {
      x0: Math.min(...own.map((f) => f.rect.x0)),
      x1: Math.max(...own.map((f) => f.rect.x1)),
      y0: Math.min(...own.map((f) => f.rect.y0)),
      y1: Math.max(...own.map((f) => f.rect.y1)),
    };
    expect(s.x0).toBeCloseTo(b.x0, 0);
    expect(s.x1).toBeCloseTo(b.x1, 0);
    expect(s.y0).toBeCloseTo(b.y0, 0);
    expect(s.y1).toBeCloseTo(b.y1, 0);
    const feet = CONTACT_FEET.filter((f) => f.piece === house.id);
    expect(feet.length).toBeGreaterThan(50);
    let inside = 0;
    for (const f of feet) {
      const p = worldToLogical(f.x, f.y);
      // The plinth's steps may reach a third of a tile past the footprint.
      if (p.x > s.x0 - 0.36 && p.x < s.x1 + 0.36 && p.y > s.y0 - 0.36 && p.y < s.y1 + 0.36)
        inside++;
    }
    expect(inside / feet.length, `${house.id} feet on the wall's footprint`).toBeGreaterThan(0.9);
  }
});

it('is a pure function of the world pixel, so overlapping plates agree', () => {
  const rgb = [150, 160, 90];
  for (const [x, y] of [
    [1204.5, 700.5],
    [1500.5, 400.5],
    [900.5, 900.5],
  ] as const) {
    expect(litRgb(x, y, rgb)).toEqual(litRgb(x, y, rgb));
    // Any point inside a pixel is the same sample.
    expect(litRgb(x + 0.3, y - 0.3, rgb)).toEqual(litRgb(x, y, rgb));
  }
});

it('agrees across plate seams: neighbourhood plates against the garden under them', async () => {
  const dir = 'public/art/maps/ba-dan-scene/';
  const garden = await decodeWebp(new Uint8Array(readFileSync(`${dir}garden-0.webp`)));
  const plate = BA_DAN_SCENE.ground.find((p) => p.url.endsWith('south-house-court-ground.webp'))!;
  const image = await decodeWebp(new Uint8Array(readFileSync(`public/${plate.url}`)));
  let diff = 0;
  let shaded = 0;
  let n = 0;
  for (let py = 0; py < image.height; py += 2)
    for (let px = 0; px < image.width; px += 2) {
      const i = (py * image.width + px) * 4;
      if (image.data[i + 3] !== 255) continue;
      const wx = plate.x + px;
      const wy = plate.y + py;
      if (wx >= 1280) continue;
      const g = (wy * garden.width + wx) * 4;
      // Paving over lawn is a different material, not a seam; compare lawn only.
      const lawn = (image.data[i + 1] ?? 0) >= (image.data[i] ?? 0);
      if (!lawn) continue;
      if ((garden.data[g + 3] ?? 0) !== 255) continue;
      for (let c = 0; c < 3; c++)
        diff += Math.abs((image.data[i + c] ?? 0) - (garden.data[g + c] ?? 0));
      if (shadowCover(wx + 0.5, wy + 0.5) > 0.5) shaded++;
      n++;
    }
  // The door landings, their trails and the worn soil at the feet are not lawn and are not compared.
  expect(n).toBeGreaterThan(15_000);
  expect(shaded, 'the compared lawn includes real shadow').toBeGreaterThan(500);
  expect(diff / (n * 3), 'mean difference is encoder noise').toBeLessThan(4);
});

it('seats every true piece with baked contact all the way round, never a black rim', () => {
  // The true pieces opt out of the runtime's footprint ring: it is a whole-tile box, a grey mat
  // under a table's open legs, so what seats them is the baked line and falloff from the feet.
  const pieces = BA_DAN_SCENE.scenery.filter((p) => p.url.includes('/true-'));
  expect(pieces.length).toBeGreaterThanOrEqual(20);
  for (const piece of pieces) expect(piece.contactShadow, piece.id).toBe(false);
  let sides = 0;
  let darkest = 1;
  for (const foot of FEET) {
    const r = foot.rect;
    const cx = (r.x0 + r.x1) / 2;
    const cy = (r.y0 + r.y1) / 2;
    // The four sides, lit ones included: a point d ground pixels out from the middle of each.
    for (const [nx, ny, mx, my] of [
      [1, 0, r.x1, cy],
      [-1, 0, r.x0, cy],
      [0, 1, cx, r.y1],
      [0, -1, cx, r.y0],
    ] as const) {
      const out = (d: number) => {
        const p = logicalToWorld(mx + (nx * d) / 90.5, my + (ny * d) / 90.5);
        return contactMultiplier(p.x, p.y);
      };
      const line = out(1.2);
      const far = out(48);
      // A side with a neighbour's foot within reach adds its own: measure open sides only.
      if (far < 0.99) continue;
      // A leg or a low terrace keeps less of the line than a plinth, but every foot has one.
      expect(line, `${foot.id} line at ${nx},${ny}`).toBeLessThan(0.9);
      darkest = Math.min(darkest, line);
      sides++;
    }
  }
  expect(sides).toBeGreaterThan(60);
  // A plinth's own line is the specified 0.55 of the ground, and a falloff to 0.85 follows it.
  expect(contactGround(1), 'the line').toBeCloseTo(0.55, 2);
  expect(contactGround(14.6), 'the falloff ends at 0.85').toBeCloseTo(0.85, 2);
  expect(
    contactGround(2.6 + 12 / 2),
    'and has recovered most of the way by its middle',
  ).toBeGreaterThan(0.75);
  expect(darkest, 'a rim, never black').toBeGreaterThanOrEqual(0.36);
});

it('lights open ground warm and drifts slowly, with no vignette', () => {
  const samples: number[] = [];
  for (let x = 0; x < 2560; x += 40)
    for (let y = 0; y < 1280; y += 40) {
      const l = sunLift(x + 0.5, y + 0.5);
      samples.push(l[0]);
      expect(l[0], 'warm').toBeGreaterThan(l[2]);
    }
  expect(Math.max(...samples) - Math.min(...samples), 'at most a few percent').toBeLessThan(0.16);
  // Slow: neighbouring pixels differ by a hair, so the drift never reads as texture.
  expect(Math.abs(sunLift(1000.5, 500.5)[0] - sunLift(1001.5, 500.5)[0])).toBeLessThan(0.002);
});

it('gives every upright piece a shadow caster at the place it is DRAWN', () => {
  const volumesOf = (id: string) =>
    VILLAGE_VOLUMES.filter((v) => v.id === id || v.id.startsWith(`${id}-`));
  const rootOf = (id: string): string | undefined => {
    if (id.startsWith('canal-bridge')) return 'bridge';
    // The far slice of the turned planter is cut from the same planter.
    if (id === 'southeast-planter-far') return 'southeast-planter';
    // A backdrop is foliage behind its wall run; the run casts for both.
    const backdrop = /^(north|west)-backdrop/.exec(id);
    return backdrop ? `${backdrop[1]}-wall` : undefined;
  };
  let checked = 0;
  for (const piece of BA_DAN_SCENE.scenery) {
    if (piece.id.startsWith('tree-')) {
      // A clump is drawn at one depth but is several trees: each casts from its own root, as it
      // did when it was a piece of its own, and the clump's sprite contains every one of them.
      const members = TREES.filter((t) =>
        piece.footprint.some(
          (c) => c.x === t.piece.footprint[0]?.x && c.y === t.piece.footprint[0]?.y,
        ),
      );
      expect(members.length, `${piece.id} has a silhouette caster per tree`).toBe(
        piece.footprint.length,
      );
      for (const caster of members) {
        const tree = caster.piece;
        expect(tree.x, `${tree.id} in ${piece.id}`).toBeGreaterThanOrEqual(piece.x);
        expect(tree.y, `${tree.id} in ${piece.id}`).toBeGreaterThanOrEqual(piece.y);
        expect(tree.x + tree.width, `${tree.id} in ${piece.id}`).toBeLessThanOrEqual(
          piece.x + piece.width,
        );
        expect(tree.y + tree.height, `${tree.id} in ${piece.id}`).toBeLessThanOrEqual(
          piece.y + piece.height,
        );
        // Rooted on the drawn tile, not the footprint: a crown moved off its cells
        // must cast from where it stands, or its old cells hold an orphan shadow.
        const root = tree.depth ?? tree.footprint[0];
        expect(caster.footX, `${tree.id} root x`).toBe(
          1024 + ((root?.x ?? 0) - (root?.y ?? 0)) * 64,
        );
        expect(caster.footY, `${tree.id} root y`).toBe(((root?.x ?? 0) + (root?.y ?? 0) + 1) * 32);
        // ... and the image really is drawn on that root.
        expect(
          Math.abs(tree.y + tree.height - caster.footY),
          `${tree.id} drawn root`,
        ).toBeLessThanOrEqual(tree.width / 28 + 2);
        expect(
          Math.abs(tree.x + tree.width / 2 - caster.footX),
          `${tree.id} drawn trunk`,
        ).toBeLessThan(tree.width * 0.4);
        expect(
          caster.alpha.some((a) => a > 128),
          `${tree.id} silhouette`,
        ).toBe(true);
        // The shade falls down-right of the drawn root.
        let best = 0;
        for (let dx = -10; dx <= 0.42 * caster.rise; dx += 4)
          for (let dy = 0; dy <= 0.27 * caster.rise; dy += 4)
            best = Math.max(best, shadowCover(caster.footX + dx + 0.5, caster.footY + dy + 0.5));
        expect(best, `${tree.id} casts shade at its drawn root`).toBeGreaterThan(0.2);
      }
      checked++;
      continue;
    }
    if (/^wall-\d$/.test(piece.id)) {
      // A strip of the wall: the wall's volumes stand inside its drawn box.
      const inside = VILLAGE_VOLUMES.filter((v) => {
        const r = v.kind === 'wall' ? v.section(1) : null;
        if (!r) return false;
        const w = logicalToWorld((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2);
        return (
          w.x >= piece.x - 40 &&
          w.x <= piece.x + piece.width + 40 &&
          w.y >= piece.y - 40 &&
          w.y <= piece.y + piece.height + 40
        );
      });
      expect(inside.length, `${piece.id} has a shadow volume`).toBeGreaterThan(0);
      checked++;
      continue;
    }
    const owner = rootOf(piece.id) ?? piece.id;
    const volumes = volumesOf(owner);
    expect(volumes.length, `${piece.id} has a shadow volume`).toBeGreaterThan(0);
    // Each volume stands over the piece's own cells (or, for a surround run, its band).
    const xs = piece.footprint.map((c) => c.x);
    const ys = piece.footprint.map((c) => c.y);
    const slack = piece.exterior && /wall|backdrop/.test(piece.id) ? 30 : 0.6;
    for (const v of volumes) {
      const s = v.section(v.hMin);
      if (!s) continue;
      const cx = (s.x0 + s.x1) / 2;
      const cy = (s.y0 + s.y1) / 2;
      expect(cx, `${v.id} x on ${piece.id}`).toBeGreaterThanOrEqual(Math.min(...xs) - slack);
      expect(cx, `${v.id} x on ${piece.id}`).toBeLessThanOrEqual(Math.max(...xs) + 1 + slack);
      expect(cy, `${v.id} y on ${piece.id}`).toBeGreaterThanOrEqual(Math.min(...ys) - slack);
      expect(cy, `${v.id} y on ${piece.id}`).toBeLessThanOrEqual(Math.max(...ys) + 1 + slack);
    }
    checked++;
  }
  expect(checked).toBe(BA_DAN_SCENE.scenery.length);
});
