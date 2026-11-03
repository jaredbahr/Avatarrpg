import { describe, expect, it } from 'vitest';
import {
  createExploreObjectivePresentation,
  syncExploreObjective,
  toggleExploreObjective,
  walkExploreObjective,
} from './exploreObjective';

describe('exploration objective presentation', () => {
  it('shows a new objective in full, then collapses it once after walking', () => {
    const initial = createExploreObjectivePresentation();
    const first = syncExploreObjective(initial, 'Talk to Mira');
    expect(first).toEqual({ key: 'Talk to Mira', expanded: true, walked: false });
    expect(walkExploreObjective(first, 'Talk to Mira')).toEqual({
      key: 'Talk to Mira',
      expanded: false,
      walked: true,
    });
  });

  it('keeps user expansion and opens changed objectives in full again', () => {
    const collapsed = walkExploreObjective(
      syncExploreObjective(createExploreObjectivePresentation(), 'Talk to Mira'),
      'Talk to Mira',
    );
    const expanded = toggleExploreObjective(collapsed, 'Talk to Mira');
    expect(expanded.expanded).toBe(true);
    expect(walkExploreObjective(expanded, 'Talk to Mira')).toBe(expanded);

    expect(syncExploreObjective(expanded, 'Take the east road')).toEqual({
      key: 'Take the east road',
      expanded: true,
      walked: false,
    });
  });

  it('does not collapse a changed objective on the same walking event', () => {
    const previous = syncExploreObjective(createExploreObjectivePresentation(), 'Talk to Mira');
    const changedWhileWalking = walkExploreObjective(previous, 'Take the east road');
    expect(changedWhileWalking).toEqual({
      key: 'Take the east road',
      expanded: true,
      walked: false,
    });
    expect(walkExploreObjective(changedWhileWalking, 'Take the east road')).toEqual({
      key: 'Take the east road',
      expanded: false,
      walked: true,
    });
  });

  it('is idempotent for unchanged state, repeatable when toggled, and fresh per scene', () => {
    const empty = createExploreObjectivePresentation();
    expect(syncExploreObjective(empty, null)).toBe(empty);
    const first = syncExploreObjective(empty, 'Talk to Mira');
    expect(syncExploreObjective(first, 'Talk to Mira')).toBe(first);
    const toggledTwice = toggleExploreObjective(
      toggleExploreObjective(first, 'Talk to Mira'),
      'Talk to Mira',
    );
    expect(toggledTwice).toEqual(first);
    const collapsed = walkExploreObjective(first, 'Talk to Mira');
    expect(walkExploreObjective(collapsed, 'Talk to Mira')).toBe(collapsed);
    expect(createExploreObjectivePresentation()).toEqual({
      key: null,
      expanded: true,
      walked: false,
    });
  });

  it('resets an objective after it disappears and later returns', () => {
    const initial = createExploreObjectivePresentation();
    const collapsed = walkExploreObjective(
      syncExploreObjective(initial, 'Talk to Mira'),
      'Talk to Mira',
    );
    const cleared = syncExploreObjective(collapsed, null);
    expect(cleared).toEqual({ key: null, expanded: false, walked: false });
    expect(syncExploreObjective(cleared, 'Talk to Mira')).toEqual({
      key: 'Talk to Mira',
      expanded: true,
      walked: false,
    });
  });
});
