import { describe, expect, it } from 'vitest';
import { Camera } from '../../render/camera';
import { actorBodyBounds } from '../../render/geometry/actorSilhouette';
import { frameVictoryParty, type VictoryActor } from './combatVictoryFrame';

function camera(dpr = 1, width = 1000, height = 600): Camera {
  const result = new Camera({ width, height, dpr }, { width: 20, height: 12 }, 'oblique');
  result.integerZoom = true;
  result.fit();
  return result;
}

function actor(x: number, y: number, extra: Partial<VictoryActor> = {}): VictoryActor {
  return { pos: { x, y }, size: 1, scale: 1.25, headroom: 0.2, lift: 0, ...extra };
}

function expectVisible(view: Camera, actors: readonly VictoryActor[]): void {
  for (const unit of actors) {
    const box = view.spriteBox(unit.pos, unit.size, true);
    box.y -= unit.lift * box.size;
    const bounds = actorBodyBounds(
      { ...box, width: box.size * unit.size },
      unit.size,
      unit.headroom,
      unit.scale,
    );
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.top).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(view.viewport.width);
    expect(bounds.bottom).toBeLessThanOrEqual(view.viewport.height);
  }
}

describe('victory party framing', () => {
  it.each([
    [1, 2],
    [2, 2.5],
  ])('fits the upright group at the closest stop at DPR %s', (dpr, expectedScale) => {
    const view = camera(dpr);
    const party = [actor(4, 4), actor(8, 4)];

    expect(frameVictoryParty(view, party)).toBe(true);

    expect(view.scale).toBe(expectedScale);
    expect(view.onWholeDevicePixels).toBe(true);
    expectVisible(view, party);
  });

  it('includes elevation, measured headroom and a two-cell upright in the frame', () => {
    const flat = camera(2, 1000, 400);
    const raised = camera(2, 1000, 400);
    const party = [actor(5, 5, { lift: 1.5, headroom: 1.2 }), actor(6, 5, { size: 2 })];
    frameVictoryParty(flat, [actor(5, 5), actor(6, 5)]);

    expect(frameVictoryParty(raised, party)).toBe(true);

    expect(raised.scale).toBeLessThan(flat.scale);
    expect(raised.onWholeDevicePixels).toBe(true);
    expectVisible(raised, party);
  });

  it('forgets accumulated manual pinch intent before choosing the group frame', () => {
    const clean = camera(2, 900, 600);
    const pinched = camera(2, 900, 600);
    const party = [actor(4, 4), actor(10, 4)];
    const at = { x: 450, y: 300 };
    pinched.zoomAt(at, 1.18);
    expect(pinched.scale).toBe(1);

    frameVictoryParty(clean, party);
    frameVictoryParty(pinched, party);

    expect(pinched.scale).toBe(clean.scale);
    expect(pinched.offsetX).toBe(clean.offsetX);
    expect(pinched.offsetY).toBe(clean.offsetY);
    expectVisible(pinched, party);
  });

  it('refits the complete silhouettes after a real viewport change', () => {
    const view = camera(2);
    const party = [actor(4, 4), actor(8, 4)];
    frameVictoryParty(view, party);
    const landscapeScale = view.scale;
    view.viewport = { width: 600, height: 400, dpr: 2 };

    expect(frameVictoryParty(view, party)).toBe(true);

    expect(view.scale).toBeLessThan(landscapeScale);
    expect(view.onWholeDevicePixels).toBe(true);
    expectVisible(view, party);
  });

  it('keeps the existing camera unchanged when no party member remains standing', () => {
    const view = camera(2);
    view.zoomAt({ x: 500, y: 300 }, 1.8);
    view.panBy(80, -40);
    const before = { scale: view.scale, x: view.offsetX, y: view.offsetY };

    expect(frameVictoryParty(view, [])).toBe(false);

    expect({ scale: view.scale, x: view.offsetX, y: view.offsetY }).toEqual(before);
  });

  it('reports an impossible narrow group fit without leaving the integer stops', () => {
    const view = camera(2, 390, 550);
    const party = [actor(0, 11), actor(19, 0)];

    expect(frameVictoryParty(view, party)).toBe(false);

    expect(view.scale).toBe(0.5);
    expect(view.onWholeDevicePixels).toBe(true);
    expect(Number.isFinite(view.offsetX)).toBe(true);
    expect(Number.isFinite(view.offsetY)).toBe(true);
  });

  it('widens an orthographic edge frame when the closest zoom is clamped', () => {
    const view = new Camera({ width: 390, height: 400, dpr: 2 }, { width: 20, height: 12 });
    const party = [actor(5, 0, { scale: 1 })];

    expect(frameVictoryParty(view, party)).toBe(true);

    expect(view.scale).toBeLessThan(2.5);
    expectVisible(view, party);
  });
});
