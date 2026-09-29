import { describe, expect, it } from 'vitest';
import {
  HEADINGS,
  KO_HEADING,
  KO_HEADINGS,
  authoredForBothSides,
  clipDurationMs,
  koClip,
} from './clips';

describe('G knockout clip names (ADR 0059)', () => {
  it('falls a diagonal on itself and an orthogonal 45 degrees clockwise of it', () => {
    for (const heading of KO_HEADINGS) expect(KO_HEADING[heading]).toBe(heading);
    // Clockwise on screen, from east: the next heading in `HEADINGS`.
    for (const [index, heading] of HEADINGS.entries()) {
      if ((KO_HEADINGS as readonly string[]).includes(heading)) continue;
      expect(KO_HEADING[heading]).toBe(HEADINGS[(index + 1) % HEADINGS.length]);
    }
    expect(koClip('east')).toBe('koSouthEast');
    expect(koClip('north')).toBe('koNorthEast');
    expect(new Set(HEADINGS.map(koClip)).size).toBe(4);
  });

  it('never mirrors a G knockout, and still mirrors the legacy hit and knockout', () => {
    for (const heading of HEADINGS) expect(authoredForBothSides(koClip(heading))).toBe(true);
    expect(authoredForBothSides('hit')).toBe(false);
    expect(authoredForBothSides('ko')).toBe(false);
    expect(authoredForBothSides('cast')).toBe(false);
  });

  it('times a clip by its holds, or its frames at its rate', () => {
    expect(clipDurationMs({ frames: ['a', 'b'], fps: 4, loop: false })).toBe(500);
    expect(clipDurationMs({ frames: ['a', 'b'], fps: 4, loop: false, frameMs: [40, 150] })).toBe(
      190,
    );
  });
});
