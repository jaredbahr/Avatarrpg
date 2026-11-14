/** The node a fresh game starts on. */
export const STORY_ENTRY = 'act1_open';

/**
 * The flash-forward prologue (C-28). A new game from the title plays it first
 * and it leads into `STORY_ENTRY`; saves, the simulator and the fixtures start
 * at `STORY_ENTRY` itself, so none of them replays the storm.
 */
export const STORY_PROLOGUE = 'prologue_storm';
