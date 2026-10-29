export interface ExploreObjectivePresentation {
  readonly key: string | null;
  readonly expanded: boolean;
  readonly walked: boolean;
}

export function createExploreObjectivePresentation(): ExploreObjectivePresentation {
  return { key: null, expanded: true, walked: false };
}

/** A new objective always receives its first, expanded presentation. */
export function syncExploreObjective(
  state: ExploreObjectivePresentation,
  objective: string | null,
): ExploreObjectivePresentation {
  if (state.key === objective) return state;
  return { key: objective, expanded: Boolean(objective), walked: false };
}

/** Collapse once after the party's first walk for this same objective. */
export function walkExploreObjective(
  state: ExploreObjectivePresentation,
  objective: string | null,
): ExploreObjectivePresentation {
  const synced = syncExploreObjective(state, objective);
  if (synced !== state || !objective || state.walked) return synced;
  return { ...state, expanded: false, walked: true };
}

export function toggleExploreObjective(
  state: ExploreObjectivePresentation,
  objective: string | null,
): ExploreObjectivePresentation {
  const synced = syncExploreObjective(state, objective);
  return objective ? { ...synced, expanded: !synced.expanded } : synced;
}
