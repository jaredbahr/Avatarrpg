import { createGame } from '../../core/state/createGame';
import type { ContentIndex, GameState } from '../../core/types';
import { RIVERSIDE_ENTRY } from '../../content/maps/riverside';

/**
 * The title screen's riverside preview: a fresh game at the river (ADR 0047
 * §1). It is set after Mira's briefing (`riverside_mira` greets the party as
 * people she knows), so its start state records `mira_intro` as visited;
 * otherwise her pre-intro hold would keep her at her table in the village
 * and, through the supervision rule, Pella with her. The preview's clock is
 * W7's.
 */
export function villagePreviewState(content: ContentIndex): GameState {
  const fresh = createGame(content, {
    seed: 'riverside-first-afternoon',
    party: [{ characterId: 'sura' }, { characterId: 'kaya' }],
    startNode: RIVERSIDE_ENTRY,
  });
  return { ...fresh, story: { ...fresh.story, visited: ['mira_intro'] } };
}
