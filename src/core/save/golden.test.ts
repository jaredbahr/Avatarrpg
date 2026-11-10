/**
 * Persistent compatibility corpus, generated with scripts/saves/make-golden.ts.
 * When the save schema version bumps, generate a NEW version folder and keep
 * every old folder/fixture forever. Do not regenerate old saves to make a
 * migration failure pass. Forced victories are fixture setup, not balance or
 * legally won campaign evidence; routing/rewards and mid-boss turns use core.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CONTENT, RETURNEE_IDS } from '../../content';
import type { Command, GameState } from '../types';
import { apply } from '../state/reducer';
import { optionAvailable } from '../story/storyEngine';
import { backgroundFigures, visibleNpcs } from '../story/world';
import { cachedGrid, DIRECTIONS, findPath, posKey, tileAt } from '../rules/grid';
import { generateGoldenSaves } from '../../../scripts/saves/make-golden';
import { deserialize, SAVE_FORMAT_VERSION, stateFromBlob } from './serialize';
import { reconcileBattleResult, reconcileDisciplines, reconcileWorld } from './reconcile';

const ROOT = fileURLToPath(new URL('./fixtures/golden/', import.meta.url));
const CHECKPOINT_NODES = {
  'new-game': 'act1_open',
  'ba-dan': 'village_explore',
  'before-forest': 'battle_forest_road',
  'after-forest': 'after_forest',
  'quarry-gate': 'gate_parley',
  cutting: 'cutting_explore',
  'driller-mid': 'battle_grumbler',
  'driller-won': 'act1_epilogue',
  home: 'village_return_explore',
} as const;

function fixturePaths(): string[] {
  if (!existsSync(ROOT)) return [];
  return readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^v\d+$/.test(entry.name))
    .flatMap((version) =>
      readdirSync(join(ROOT, version.name))
        .filter((name) => name.endsWith('.json'))
        .map((name) => `${version.name}/${name}`),
    )
    .sort();
}

const paths = fixturePaths();

function load(json: string): GameState {
  const parsed = deserialize(json);
  if (!parsed.ok) throw new Error(`Golden save did not deserialize: ${parsed.error}`);
  // Match App.adoptSave's real order. A lost battle/map is not silent success.
  const battle = reconcileBattleResult(CONTENT, stateFromBlob(parsed.blob));
  expect(battle.warnings).toEqual([]);
  return reconcileWorld(CONTENT, reconcileDisciplines(CONTENT, battle.state));
}

/** Choose an action the player or actual enemy controller can take here. */
function nextCommand(state: GameState): Command {
  const pending = state.pendingChoices[0];
  if (pending) {
    if (pending.kind === 'ability') {
      const abilityId = pending.options[0];
      if (!abilityId) throw new Error('Empty saved ability reward');
      return { type: 'chooseLevelUp', unitId: pending.unitId, abilityId };
    }
    const disciplineId = pending.options.find((id) => {
      const definition = CONTENT.disciplines.get(id);
      return (
        definition && (!definition.requiresFlag || state.flags[definition.requiresFlag] === true)
      );
    });
    if (!disciplineId) throw new Error('No available saved discipline choice');
    return { type: 'chooseDiscipline', unitId: pending.unitId, disciplineId };
  }
  if (state.battle) {
    if (state.battle.phase !== 'active') return { type: 'resolveBattle' };
    const actor = state.battle.units.find(
      (unit) => unit.id === state.battle?.order[state.battle.turnIndex],
    );
    if (!actor || actor.hp <= 0) throw new Error('No living active actor after reconciliation');
    return actor.ai === 'none' ? { type: 'endTurn', unitId: actor.id } : { type: 'runAiTurn' };
  }
  const node = CONTENT.story.get(state.story.nodeId ?? '');
  if (!node) throw new Error('Saved story node is missing');
  if (node.kind === 'dialogue') return { type: 'advanceDialogue' };
  if (node.kind === 'choice') {
    const optionIndex = node.options.findIndex((option) => optionAvailable(state, option));
    if (optionIndex < 0) throw new Error('No available saved story choice');
    return { type: 'chooseOption', optionIndex };
  }
  if (node.kind === 'explore') {
    const map = CONTENT.maps.get(state.location.mapId);
    if (!map) throw new Error('No saved exploration map');
    const grid = cachedGrid(map);
    const blocked = new Set(
      [...visibleNpcs(CONTENT, map, state), ...backgroundFigures(CONTENT, map, state)].map(
        (person) => posKey(person.pos),
      ),
    );
    for (const direction of DIRECTIONS) {
      const pos = {
        x: state.location.pos.x + direction.x,
        y: state.location.pos.y + direction.y,
      };
      const tile = tileAt(grid, pos);
      if (!tile || tile.blocked || blocked.has(posKey(pos))) continue;
      const route = findPath(
        { grid, blocked, surfaces: CONTENT.surfaces, size: 1, climbCost: CONTENT.tuning.climbCost },
        state.location.pos,
        pos,
        grid.width * grid.height,
      );
      if (route) return { type: 'walkTo', pos };
    }
    throw new Error('No reachable saved exploration continuation');
  }
  if (node.kind === 'end' && node.next) {
    // This is the summary's authored Continue exploring control, not a jump.
    return { type: 'enterNode', nodeId: node.next };
  }
  throw new Error(`No supported legal continuation at ${node.id}/${node.kind}`);
}

describe('versioned golden save compatibility', () => {
  it('includes all eighteen current-schema checkpoint files without excluding legacy folders', () => {
    const current = paths.filter((path) => path.startsWith(`v${SAVE_FORMAT_VERSION}/`));
    const expected = [1, 4].flatMap((size) =>
      Object.keys(CHECKPOINT_NODES).map(
        (checkpoint) => `v${SAVE_FORMAT_VERSION}/party-${size}-${checkpoint}.json`,
      ),
    );
    expect(current).toEqual(expected.sort());
    expect(paths.length).toBeGreaterThanOrEqual(18);
  });

  it.each(paths)('loads, reconciles and legally continues %s', (path) => {
    const json = readFileSync(join(ROOT, path), 'utf8');
    expect(Buffer.byteLength(json, 'utf8')).toBeLessThan(200_000);
    const parsed = deserialize(json);
    if (!parsed.ok) throw new Error(`${path}: ${parsed.error}`);
    const state = load(json);
    expect(CONTENT.story.has(state.story.nodeId ?? '')).toBe(true);
    expect(load(json)).toEqual(state);
    const again = reconcileBattleResult(CONTENT, state);
    expect(again.warnings).toEqual([]);
    expect(reconcileWorld(CONTENT, reconcileDisciplines(CONTENT, again.state))).toEqual(state);

    const session = parsed.blob.session;
    expect(session?.players.map((player) => player.unitId)).toEqual(
      state.party.map((unit) => unit.id),
    );
    expect(session?.players.every((player) => player.name.trim().length > 0)).toBe(true);
    const match = /^party-(1|4)-(.+)\.json$/.exec(path.split('/').at(-1) ?? '');
    if (match) {
      const size = Number(match[1]);
      const checkpoint = match[2] as keyof typeof CHECKPOINT_NODES;
      expect(state.party).toHaveLength(size);
      expect(session?.soloPlay).toBe(size === 1);
      expect(state.story.nodeId).toBe(CHECKPOINT_NODES[checkpoint]);
      if (checkpoint === 'before-forest' || checkpoint === 'driller-mid') {
        expect(state.battle?.phase).toBe('active');
        expect(state.battle?.encounterId).toBe(
          checkpoint === 'before-forest' ? 'enc_forest_road' : 'enc_grumbler',
        );
        expect(Number.isInteger(state.battle?.turnIndex)).toBe(true);
        if (checkpoint === 'before-forest') expect(state.battle?.round).toBe(1);
        else
          expect((state.battle?.round ?? 0) > 1 || (state.battle?.turnIndex ?? 0) > 0).toBe(true);
      }
      if (checkpoint === 'after-forest') {
        expect(state.battle).toBeNull();
        expect(state.world.cleared).toContain('enc_forest_road');
        expect(state.party.every((unit) => unit.xp > 0)).toBe(true);
      }
      if (checkpoint === 'cutting') {
        expect(state.world.cleared).toContain('enc_quarry_gate');
        expect(state.flags.ruon_spared).toBe(true);
        expect(state.flags.ruon_traded).not.toBe(true);
      }
      if (checkpoint === 'driller-won' || checkpoint === 'home') {
        expect(state.battle).toBeNull();
        expect(state.flags.act1_complete).toBe(true);
        expect(state.world.cleared).toEqual(
          expect.arrayContaining([
            'enc_forest_road',
            'enc_quarry_gate',
            'enc_ambush',
            'enc_grumbler',
          ]),
        );
        for (const id of RETURNEE_IDS)
          expect(state.world.residentProfiles[id]).toBe(
            checkpoint === 'home' ? 'resting' : 'returning',
          );
      }
    }

    const command = nextCommand(state);
    const result = apply(CONTENT, state, command);
    expect(result.state).not.toBe(state);
    expect(result.events.length).toBeGreaterThan(0);
    if (command.type === 'chooseLevelUp' || command.type === 'chooseDiscipline') {
      const offered = state.pendingChoices[0];
      if (!offered) throw new Error('Continuation did not have an offered reward');
      expect(
        result.state.pendingChoices.some(
          (choice) =>
            choice.kind === offered.kind &&
            choice.unitId === offered.unitId &&
            choice.level === offered.level,
        ),
      ).toBe(false);
      const member = result.state.party.find((unit) => unit.id === command.unitId);
      if (command.type === 'chooseLevelUp') expect(member?.abilities).toContain(command.abilityId);
      else expect(member?.disciplineId).toBe(command.disciplineId);
    } else {
      expect(result.events.every((event) => event.type === 'message')).toBe(false);
    }
    expect({
      location: result.state.location,
      story: result.state.story,
      clock: result.state.world.clock,
      battle: result.state.battle,
      choices: result.state.pendingChoices,
    }).not.toEqual({
      location: state.location,
      story: state.story,
      clock: state.world.clock,
      battle: state.battle,
      choices: state.pendingChoices,
    });
  });

  it('generates byte-identical saves in memory without writing or replacing the corpus', async () => {
    const before = paths.map((path) => readFileSync(join(ROOT, path), 'utf8'));
    const first = await generateGoldenSaves();
    const second = await generateGoldenSaves();
    expect(first).toHaveLength(18);
    expect(first).toEqual(second);
    expect(new Set(first.map((save) => save.filename)).size).toBe(18);
    for (const save of first) expect(Buffer.byteLength(save.json, 'utf8')).toBeLessThan(200_000);
    expect(paths.map((path) => readFileSync(join(ROOT, path), 'utf8'))).toEqual(before);
  });
});
