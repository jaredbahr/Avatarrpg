/**
 * Continuity across a save.
 *
 * `serialize.test.ts` pins what a blob holds, field by field. This asks the
 * player's question instead: if I save here, close the tab and come back, is it
 * still the same run? Every load runs the load-time repairs — `reconcile`
 * rebuilds a unit's kit from its discipline — so the property that matters is
 * that a load *settles*: loading a save of a loaded save is the run you saved
 * rather than a drift of it. Nothing in the schema catches a repair that grants
 * or recomputes something on every read; a player who reloads would just watch
 * their numbers move.
 *
 * The route is the other half. A save taken on the way home has to come back on
 * the way home: the same objective, and the same scenes offered by the same
 * NPCs. Both Driller outcomes are in the table because they are two different
 * routes afterwards — Gao has an objection on one and a cold greeting on the
 * other — so a load path that lost a custody flag would show up as the wrong
 * village.
 */

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { apply } from '../state/reducer';
import { createBattle, createGame } from '../state/createGame';
import { npcNode, resolveDialogue } from '../story/storyEngine';
import { worldObjective } from '../story/world';
import type { GameState } from '../types';
import { reconcileDisciplines, reconcileWorld } from './reconcile';
import { deserialize, serialize, stateFromBlob } from './serialize';

const META = {
  label: 'Slot 1',
  summary: 'Continuity save',
  savedAt: 1_700_000_000_000,
  session: { players: [{ name: 'Lorelai', unitId: 'p0' }], soloPlay: false },
};

/** The app's real load path: parse the blob, then run the load-time repairs. */
function load(state: GameState): GameState {
  const result = deserialize(serialize(state, META));
  if (!result.ok) throw new Error(result.error);
  return reconcileWorld(CONTENT, reconcileDisciplines(CONTENT, stateFromBlob(result.blob)));
}

/** A party that has finished the quarry, standing somewhere on the way home. */
function homeward(flags: GameState['flags'], mapId: string, nodeId: string, level = 3): GameState {
  const base = createGame(CONTENT, {
    seed: 'route-continuity',
    party: [
      { characterId: 'wen', level },
      { characterId: 'kaya', level },
    ],
    startNode: 'village_explore',
  });
  return {
    ...base,
    flags: { ...base.flags, act1_complete: true, ...flags },
    location: { ...base.location, mapId, pos: { x: 1, y: 1 } },
    story: { ...base.story, nodeId },
  };
}

/** A game paused mid-fight: the state with the most for a repair to touch. */
function midBattle(): GameState {
  const seeded = createGame(CONTENT, {
    seed: 'continuity-battle',
    party: [
      { characterId: 'kaya', level: 2, autoChoose: true },
      { characterId: 'bo', level: 2, autoChoose: true },
    ],
    startNode: 'battle_quarry_gate',
    flags: { ruon_spared: true },
  });
  const rng = new RngCursor(seeded.rng);
  const battle = createBattle(CONTENT, seeded, 'enc_quarry_gate', rng);
  let state: GameState = {
    ...seeded,
    screen: 'combat',
    rng: rng.state,
    battle: {
      ...battle,
      // As in the headless simulator, lend the party an AI profile, or
      // `runAiTurn` refuses the first human turn and the fixture never moves.
      units: battle.units.map((unit) =>
        unit.faction === 'party' ? { ...unit, ai: 'aggressive' } : unit,
      ),
    },
  };
  for (let i = 0; i < 3 && state.battle?.phase === 'active'; i++) {
    state = apply(CONTENT, state, { type: 'runAiTurn' }).state;
  }
  return state;
}

const CUSTODY = [
  { name: 'spared', flags: { ruon_spared: true }, gao: 'gao_home' },
  { name: 'traded', flags: { ruon_traded: true }, gao: 'gao_home_cold' },
] as const;

const STOPS = [
  {
    name: 'on the quarry floor after the Driller',
    mapId: 'quarry_floor',
    nodeId: 'quarry_after_explore',
  },
  { name: 'on the walk home in Ba Dan', mapId: 'ba_dan_village', nodeId: 'village_return_explore' },
] as const;

describe('a continued run is the same run', () => {
  it('settles: a save of a loaded save is the run that was saved', () => {
    // A party at the discipline gate with no pick taken is the one state the
    // load-time repair actually rewrites, so it is the one a repair that is not
    // idempotent would show up in: a second read would owe the pick twice.
    const gated = homeward({ ruon_spared: true }, 'ba_dan_village', 'village_return_explore', 5);

    for (const state of [
      midBattle(),
      homeward({ ruon_spared: true }, 'quarry_floor', 'quarry_after_explore'),
      homeward({ ruon_traded: true }, 'ba_dan_village', 'village_return_explore'),
      gated,
    ]) {
      const once = load(state);
      expect(load(once)).toEqual(once);
    }

    // Without this the check above could pass by never running the repair.
    expect(load(gated).pendingChoices.some((choice) => choice.kind === 'discipline')).toBe(true);
  });

  for (const custody of CUSTODY) {
    for (const stop of STOPS) {
      it(`keeps the ${custody.name} route from ${stop.name}`, () => {
        const saved = homeward(custody.flags, stop.mapId, stop.nodeId);
        const reloaded = load(saved);

        // Nothing the player is holding moved: seats, coin, standing, kit.
        expect(reloaded.flags).toEqual(saved.flags);
        expect(reloaded.party).toEqual(saved.party);
        expect(reloaded.story).toEqual(saved.story);

        // And the route they are on is still that route, not just equal fields.
        expect(worldObjective(CONTENT, reloaded)).toBe(worldObjective(CONTENT, saved));
        expect(worldObjective(CONTENT, reloaded)).toBeTruthy();
        expect(npcNode(CONTENT, reloaded, 'ba_dan_village', 'shopkeeper_gao')).toBe(custody.gao);
        expect(npcNode(CONTENT, reloaded, 'ba_dan_village', 'shopkeeper_gao')).toBe(
          npcNode(CONTENT, saved, 'ba_dan_village', 'shopkeeper_gao'),
        );

        const mira = CONTENT.story.get('mira_epilogue');
        if (mira?.kind !== 'dialogue') throw new Error('Missing Mira return');
        expect(resolveDialogue(reloaded, mira).lines).toEqual(resolveDialogue(saved, mira).lines);
        expect(resolveDialogue(reloaded, mira).lines.join(' ')).toContain('maker-plate rubbing');
      });
    }
  }

  it('keeps the two custody outcomes apart after a reload', () => {
    const spared = load(
      homeward({ ruon_spared: true }, 'ba_dan_village', 'village_return_explore'),
    );
    const traded = load(
      homeward({ ruon_traded: true }, 'ba_dan_village', 'village_return_explore'),
    );

    expect(npcNode(CONTENT, spared, 'ba_dan_village', 'shopkeeper_gao')).toBe('gao_home');
    expect(npcNode(CONTENT, traded, 'ba_dan_village', 'shopkeeper_gao')).toBe('gao_home_cold');

    const mira = CONTENT.story.get('mira_epilogue');
    if (mira?.kind !== 'dialogue') throw new Error('Missing Mira return');
    expect(resolveDialogue(spared, mira).lines).not.toEqual(resolveDialogue(traded, mira).lines);
  });

  it('still settles now that reconcileWorld runs in the load path (ADR 0047 §5)', () => {
    // `load` now runs `reconcileWorld` after `reconcileDisciplines`, so this is
    // the whole load path the app uses. A second load of an already-loaded save
    // must still be that same run: `reconcileWorld` is idempotent.
    const saved = homeward({ ruon_spared: true }, 'ba_dan_village', 'village_return_explore');
    expect(load(load(saved))).toEqual(load(saved));
  });
});
