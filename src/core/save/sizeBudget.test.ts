import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT, RETURNEE_IDS, STORY_ENTRY } from '../../content';
import {
  generateQuarryCheckpoints,
  loadQuarryCheckpoint,
  QUARRY_ROUTES,
} from '../../../scripts/e2e/quarry-checkpoints';
import { occupiedCells } from '../rules/grid';
import { createGame } from '../state/createGame';
import { apply } from '../state/reducer';
import type { GameState } from '../types';
import { deserialize, serialize, stateFromBlob } from './serialize';
import type { SaveMeta } from './serialize';

const SAVED_AT = 1_700_000_000_000;

// Compact UTF-8 bytes measured once on main
// 30815ebb817a410bae375df3c0f7ebc5473f53ce. Limits are literal
// ceil(original baseline * 1.5), never derived from current observed size.
// Provenance and the original measurement are recorded in the #567 handoff.
const BASELINES = {
  fresh: { utf8: 2397, limit: 3596 },
  'six-party-mid-driller': { utf8: 41404, limit: 62106 },
  postgame: { utf8: 4335, limit: 6503 },
} as const;

interface Fixture {
  readonly name: keyof typeof BASELINES;
  readonly state: GameState;
  readonly meta: SaveMeta;
}

/** Historical #486 saves are read, never regenerated or changed by this test. */
function goldenFixture(name: 'fresh' | 'postgame', checkpoint: 'new-game' | 'home'): Fixture {
  const json = readFileSync(
    new URL(`./fixtures/golden/v5/party-4-${checkpoint}.json`, import.meta.url),
    'utf8',
  );
  const parsed = deserialize(json);
  if (!parsed.ok) throw new Error(`Golden ${checkpoint}: ${parsed.error}`);
  // This shared loader performs the real App-order battle, discipline and
  // world reconciliation, rejecting battle-repair warnings.
  const state = loadQuarryCheckpoint(json);
  expect(state).toEqual(stateFromBlob(parsed.blob));
  expect(state.party).toHaveLength(4);
  expect(state.battle).toBeNull();
  if (name === 'fresh') {
    expect(state.screen).toBe('dialogue');
    expect(state.story.nodeId).toBe(STORY_ENTRY);
    expect(state.world.cleared).toEqual([]);
    expect(state.party.every((unit) => unit.level === 1 && unit.xp === 0)).toBe(true);
  } else {
    // #486 used an expressly permitted forced-victory adapter, then real
    // rewards, routing and homecoming. This is saved-state provenance, not a
    // claim that this historical four-player campaign won its fights legally.
    expect(state.screen).toBe('explore');
    expect(state.story.nodeId).toBe('village_return_explore');
    expect(state.location.mapId).toBe('ba_dan_village');
    expect(state.flags.act1_complete).toBe(true);
    expect(state.world.cleared).toEqual(
      expect.arrayContaining(['enc_forest_road', 'enc_quarry_gate', 'enc_ambush', 'enc_grumbler']),
    );
    for (const id of RETURNEE_IDS) expect(state.world.residentProfiles[id]).toBe('resting');
  }
  return {
    name,
    state,
    meta: {
      label: parsed.blob.label,
      summary: parsed.blob.summary,
      savedAt: SAVED_AT,
      session: parsed.blob.session,
    },
  };
}

/** Earn the six-player battle by replaying the canonical public-command prefix. */
function sixPartyMidDriller(): Fixture {
  const route = QUARRY_ROUTES.escort;
  // The producer plays unmodified encounters legally and returns its complete
  // transcript. It runs once. Replay starts fresh, never from its postgame save.
  const earned = generateQuarryCheckpoints('escort').afterDriller;
  let state = createGame(CONTENT, {
    seed: route.seed,
    party: route.characters.map((characterId) => ({ characterId })),
    startNode: STORY_ENTRY,
  });
  expect(earned.transcript[0]).toEqual({ type: 'enterNode', nodeId: STORY_ENTRY });
  let battleCommands = 0;
  let moved = false;
  let cast = false;
  let captured = false;

  for (const [index, command] of earned.transcript.entries()) {
    const before = state;
    const step = apply(CONTENT, state, command);
    expect(step.state, `canonical command ${index}: ${JSON.stringify(command)}`).not.toBe(before);
    expect(step.events.length, `canonical command ${index}`).toBeGreaterThan(0);
    if (command.type === 'move') {
      expect(
        step.events.some((event) => event.type === 'unitMoved' && event.unitId === command.unitId),
        `canonical move ${index}`,
      ).toBe(true);
    } else if (command.type === 'useAbility') {
      expect(
        step.events.some(
          (event) =>
            event.type === 'abilityUsed' &&
            event.unitId === command.unitId &&
            event.abilityId === command.abilityId,
        ),
        `canonical cast ${index}`,
      ).toBe(true);
    } else if (command.type === 'endTurn') {
      expect(
        step.events.some((event) => event.type === 'turnEnded' && event.unitId === command.unitId),
        `canonical end turn ${index}`,
      ).toBe(true);
    }
    state = step.state;
    if (before.battle?.encounterId === 'enc_grumbler' && before.battle.phase === 'active') {
      battleCommands++;
      moved ||= step.events.some((event) => event.type === 'unitMoved' && event.path.length > 0);
      cast ||= step.events.some((event) => event.type === 'abilityUsed');
    }
    if (
      state.battle?.encounterId === 'enc_grumbler' &&
      state.battle.phase === 'active' &&
      state.battle.round >= 2 &&
      state.party.length === 6 &&
      state.battle.units.filter((unit) => unit.faction === 'party').length === 6 &&
      state.battle.units.some(
        (unit) =>
          unit.enemyId === 'grumbler' &&
          unit.hp > 0 &&
          unit.size === 2 &&
          occupiedCells(unit).length === 4,
      ) &&
      battleCommands >= 3 &&
      moved &&
      cast
    ) {
      captured = true;
      break;
    }
  }

  expect(captured, 'canonical escort must supply an active battle after real round progress').toBe(
    true,
  );
  const battle = state.battle;
  expect(state.screen).toBe('combat');
  expect(state.story.nodeId).toBe('battle_grumbler');
  expect(state.flags.act1_complete).not.toBe(true);
  expect(state.flags.ruon_spared).toBe(true);
  expect(state.world.cleared).toEqual(expect.arrayContaining(['enc_forest_road', 'enc_ambush']));
  expect(state.party).toHaveLength(6);
  expect(state.party.map((unit) => unit.characterId)).toEqual([...route.characters]);
  expect(state.party.every((unit) => unit.level >= 3 && unit.xp > 0)).toBe(true);
  expect(state.pendingChoices).toEqual([]);
  expect(battle?.encounterId).toBe('enc_grumbler');
  expect(battle?.phase).toBe('active');
  expect(battle?.round).toBeGreaterThanOrEqual(2);
  expect(battle?.units.filter((unit) => unit.faction === 'party')).toHaveLength(6);
  const boss = battle?.units.find((unit) => unit.enemyId === 'grumbler');
  if (!boss) throw new Error('Earned six-player checkpoint lost its Driller');
  expect(boss.hp).toBeGreaterThan(0);
  expect(boss.size).toBe(2);
  expect(occupiedCells(boss)).toHaveLength(4);
  expect(state.log.length).toBeGreaterThan(0);
  return {
    name: 'six-party-mid-driller',
    state,
    meta: {
      label: 'Save size: six-party mid-Driller',
      summary: 'Canonical escort campaign; active round-two Driller',
      savedAt: SAVED_AT,
      session: earned.session,
    },
  };
}

/** Key + colon + value bytes, excluding surrounding braces and sibling commas. */
function largestFields(object: Record<string, unknown>) {
  return Object.entries(object)
    .map(([field, value]) => ({
      field,
      utf8: Buffer.byteLength(JSON.stringify({ [field]: value }), 'utf8') - 2,
    }))
    .sort((a, b) => b.utf8 - a.utf8 || a.field.localeCompare(b.field))
    .slice(0, 5);
}

function diagnostics(json: string) {
  const envelope = JSON.parse(json) as Record<string, unknown>;
  const state = envelope.state;
  return {
    topEnvelopeFields: largestFields(envelope),
    topStateFields:
      state !== null && typeof state === 'object' && !Array.isArray(state)
        ? largestFields(state as Record<string, unknown>)
        : [],
  };
}

function enforceBudget(
  name: string,
  json: string,
  baseline: { utf8: number; limit: number },
): void {
  const actual = Buffer.byteLength(json, 'utf8');
  if (baseline.limit !== Math.ceil(baseline.utf8 * 1.5)) {
    throw new Error(`${name}: frozen limit must equal ceil(frozen baseline * 1.5)`);
  }
  if (actual > baseline.limit) {
    throw new Error(
      `${name}: compact save is ${actual} UTF-8 bytes; frozen baseline ${baseline.utf8}; limit ${baseline.limit}. ${JSON.stringify(diagnostics(json))}`,
    );
  }
}

describe('compact save size budgets', () => {
  it('bounds fresh, earned six-party mid-Driller and postgame saves', () => {
    const fixtures = [
      goldenFixture('fresh', 'new-game'),
      sixPartyMidDriller(),
      goldenFixture('postgame', 'home'),
    ];
    const measurements = fixtures.map((fixture) => {
      expect(fixture.meta.savedAt).toBe(SAVED_AT);
      expect(fixture.meta.session?.players.map((player) => player.unitId)).toEqual(
        fixture.state.party.map((unit) => unit.id),
      );
      expect(fixture.meta.session?.players.every((player) => player.name.trim().length > 0)).toBe(
        true,
      );
      const json = serialize(fixture.state, fixture.meta);
      expect(serialize(fixture.state, fixture.meta)).toBe(json);
      const parsed = deserialize(json);
      if (!parsed.ok) throw new Error(`${fixture.name}: ${parsed.error}`);
      expect(parsed.blob.savedAt).toBe(SAVED_AT);
      expect(parsed.blob.session).toEqual(fixture.meta.session);
      expect(stateFromBlob(parsed.blob)).toEqual(fixture.state);
      expect(loadQuarryCheckpoint(json)).toEqual(fixture.state);
      return {
        fixture,
        json,
        utf8: Buffer.byteLength(json, 'utf8'),
        // A string-storage proxy only: this is not measured browser quota use.
        utf16StringProxy: json.length * 2,
      };
    });
    // Report all three before enforcing limits, so a failure retains every size.
    console.log(
      'Compact save sizes (UTF-8 bytes; UTF-16 is a string-storage proxy):',
      JSON.stringify(
        measurements.map(({ fixture, utf8, utf16StringProxy }) => ({
          fixture: fixture.name,
          utf8,
          utf16StringProxy,
          frozenBaseline: BASELINES[fixture.name].utf8,
          limit: BASELINES[fixture.name].limit,
        })),
      ),
    );
    for (const { fixture, json } of measurements) {
      enforceBudget(fixture.name, json, BASELINES[fixture.name]);
    }
  });

  it('rejects growth and names the largest envelope and state fields', () => {
    // This diagnostic control is intentionally synthetic, not a save fixture.
    const json = JSON.stringify({
      state: { log: ['x'.repeat(1000)], party: [], world: {} },
      session: { players: [] },
      summary: 'Oversize diagnostic control',
      label: 'Control',
      savedAt: SAVED_AT,
      format: 5,
      magic: 'four-nations-tactics',
    });
    expect(() => enforceBudget('oversize-control', json, { utf8: 100, limit: 150 })).toThrow(
      /oversize-control: compact save is \d+ UTF-8 bytes; frozen baseline 100; limit 150/,
    );
    expect(() => enforceBudget('oversize-control', json, { utf8: 100, limit: 150 })).toThrow(
      /topEnvelopeFields.*state.*topStateFields.*log/,
    );
    expect(diagnostics(json).topEnvelopeFields).toHaveLength(5);
  });
});
