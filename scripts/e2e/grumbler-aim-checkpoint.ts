/** A real Grumbler turn earned by replaying the canonical trade campaign. */
import { CONTENT, STORY_ENTRY } from '../../src/content';
import {
  canUseAbility,
  isValidTarget,
  resolveAim,
  targetableTiles,
} from '../../src/core/rules/abilities';
import { occupiedCells, samePos } from '../../src/core/rules/grid';
import { activeUnit } from '../../src/core/rules/turnOrder';
import { serialize, type SessionMeta } from '../../src/core/save/serialize';
import { createGame } from '../../src/core/state/createGame';
import { apply } from '../../src/core/state/reducer';
import type { Command, GameState, Vec2 } from '../../src/core/types';
import {
  generateQuarryCheckpoints,
  loadQuarryCheckpoint,
  QUARRY_ROUTES,
} from './quarry-checkpoints';

export interface GrumblerAimCheckpoint {
  readonly state: GameState;
  readonly session: SessionMeta;
  readonly json: string;
  readonly transcript: readonly Command[];
  readonly casterId: string;
  readonly targetId: string;
  readonly abilityId: string;
  readonly far: Vec2;
  readonly near: Vec2;
}

export function grumblerAimCheckpoint(): GrumblerAimCheckpoint {
  const route = QUARRY_ROUTES.trade;
  const earned = generateQuarryCheckpoints('trade').afterDriller;
  const ability = CONTENT.abilities.get('fire_jab');
  if (!ability) throw new Error('Missing shipped Fire Jab');
  let state = createGame(CONTENT, {
    seed: route.seed,
    party: route.characters.map((characterId) => ({ characterId })),
    startNode: STORY_ENTRY,
  });
  const transcript: Command[] = [];

  for (const command of earned.transcript) {
    const battle = state.battle;
    const caster = battle && activeUnit(battle);
    const target = battle?.units.find(
      (unit) => unit.size === 2 && unit.faction === 'enemy' && unit.hp > 0,
    );
    if (
      battle?.encounterId === 'enc_grumbler' &&
      battle.phase === 'active' &&
      caster?.faction === 'party' &&
      target &&
      canUseAbility(CONTENT, caster, ability).ok
    ) {
      const targets = targetableTiles(CONTENT, battle, caster, ability);
      for (const far of occupiedCells(target)) {
        const near = resolveAim(CONTENT, battle, caster, ability, far);
        if (
          samePos(far, near) ||
          isValidTarget(CONTENT, battle, caster, ability, far).ok ||
          !isValidTarget(CONTENT, battle, caster, ability, near).ok ||
          !targets.some((cell) => samePos(cell, far))
        )
          continue;

        const json = serialize(state, {
          label: 'Legal Grumbler aim',
          summary: 'Canonical trade replay before a legal boss shot',
          savedAt: 1_700_000_000_000,
          session: earned.session,
        });
        if (JSON.stringify(loadQuarryCheckpoint(json)) !== JSON.stringify(state))
          throw new Error('Official save reconciliation changed the earned Grumbler turn');
        return {
          state,
          session: earned.session,
          json,
          transcript,
          casterId: caster.id,
          targetId: target.id,
          abilityId: ability.id,
          far,
          near,
        };
      }
    }

    const result = apply(CONTENT, state, command);
    if (
      result.state === state ||
      result.events.some(
        (event) =>
          event.type === 'message' &&
          /cannot|not open|unavailable|no way|not that unit|no battle|not exploring/i.test(
            event.text,
          ),
      )
    )
      throw new Error(`Canonical command refused: ${JSON.stringify(command)}`);
    state = result.state;
    transcript.push(command);
  }
  throw new Error('Canonical trade campaign no longer reaches the Grumbler aim checkpoint');
}
