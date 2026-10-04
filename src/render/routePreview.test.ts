import { describe, expect, it } from 'vitest';
import { createRoutePreview, displayedRoute, updateRoutePreview } from './routePreview';

describe('exploration route preview', () => {
  it('starts at the leader and drops every completed segment', () => {
    const path = [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 4, y: 3 },
    ];
    const preview = createRoutePreview({ x: 1, y: 2 }, path);
    updateRoutePreview(preview, { x: 3, y: 2.6 });
    expect(preview.origin).toEqual({ x: 3, y: 2.6 });
    expect(preview.startIndex).toBe(2);
    expect(preview.path).toBe(path);
  });

  it('treats a leader exactly on a waypoint as past the incoming segment', () => {
    const preview = createRoutePreview({ x: 1, y: 1 }, [
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
    ]);
    updateRoutePreview(preview, { x: 3, y: 1 });
    expect(preview.startIndex).toBe(2);
  });

  it('reuses the route and path objects throughout one walk', () => {
    const path = [
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ];
    const preview = createRoutePreview({ x: 1, y: 1 }, path);
    expect(updateRoutePreview(preview, { x: 1.4, y: 1 })).toBe(preview);
    expect(updateRoutePreview(preview, { x: 2.4, y: 1 }).path).toBe(path);
  });

  it('keeps showing the active route when another destination is queued', () => {
    const active = { path: [{ x: 2, y: 1 }] };
    const queued = { path: [{ x: 2, y: 2 }] };
    expect(displayedRoute(active, queued)).toBe(active);
    expect(displayedRoute(null, queued)).toBe(queued);
  });
});
