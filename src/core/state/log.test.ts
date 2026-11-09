import { describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { DEFAULT_MAX_ROUNDS, STANDARD_PARTY, runCombat, seedFor } from '../sim/runCombat';
import type { BattleState, ElementId, GameEvent, Unit } from '../types';
import { createBattle, createGame } from './createGame';
import { describeEvent } from './log';
import * as reducer from './reducer';

type FixtureTable = {
  [T in GameEvent['type']]: {
    event: Extract<GameEvent, { type: T }>;
    expected: readonly string[] | null;
  };
};

function required<T>(value: T | undefined, context: string): T {
  if (value === undefined) throw new Error(`Missing real log fixture: ${context}`);
  return value;
}

function fixtures() {
  const game = createGame(CONTENT, {
    seed: 'combat-log-fixtures-487',
    party: [{ characterId: 'kaya', level: 5, autoChoose: true }],
    startNode: '',
  });
  const battle = createBattle(CONTENT, game, 'enc_forest_road', new RngCursor(game.rng));
  const actor = required(
    battle.units.find((u) => u.faction === 'party'),
    'party actor',
  );
  const target = required(
    battle.units.find((u) => u.faction === 'enemy'),
    'enemy target',
  );
  const prop = required(battle.props[0], 'authored forest prop');
  const propDef = required(CONTENT.props.get(prop.propId), 'placed prop definition');
  const fuel = required(CONTENT.props.get('hay_bale'), 'flammable prop');
  const ability = required(CONTENT.abilities.get('fire_jab'), 'Fire Jab');
  const status = required(CONTENT.statuses.get('wet'), 'Wet');
  const surface = required(CONTENT.surfaces.get('water'), 'Water');
  const discipline = required(
    CONTENT.disciplines.get(required(actor.disciplineId ?? undefined, 'chosen discipline')),
    'discipline',
  );
  const point = target.pos;
  const fuelId = 'prop_log_hay_bale';
  // Explicit existing silence: storyNodeEntered/dialogueAdvanced/flagSet,
  // battleStarted and screenChanged describe UI/story transitions, not log
  // prose. unitMoved/partyWalked/turnEnded avoid narrating every movement or
  // boundary. propDamaged avoids a second blow-by-blow prop line; xpGained
  // stays quiet while level and choice events carry progression messages.
  const table = {
    message: {
      event: { type: 'message', text: 'The path is blocked.' },
      expected: ['blocked'],
    },
    storyNodeEntered: {
      event: { type: 'storyNodeEntered', nodeId: 'after_forest' },
      expected: null,
    },
    dialogueAdvanced: { event: { type: 'dialogueAdvanced', lineIndex: 1 }, expected: null },
    flagSet: { event: { type: 'flagSet', key: 'ruon_traded', value: true }, expected: null },
    battleStarted: {
      event: { type: 'battleStarted', encounterId: 'enc_forest_road' },
      expected: null,
    },
    roundStarted: { event: { type: 'roundStarted', round: 2 }, expected: ['round', '2'] },
    turnStarted: {
      event: { type: 'turnStarted', unitId: actor.id, round: 2 },
      expected: [actor.name, 'turn'],
    },
    turnEnded: { event: { type: 'turnEnded', unitId: actor.id }, expected: null },
    unitMoved: {
      event: { type: 'unitMoved', unitId: actor.id, path: [actor.pos], cost: 1 },
      expected: null,
    },
    partyWalked: {
      event: { type: 'partyWalked', unitId: actor.id, from: actor.pos, path: [point] },
      expected: null,
    },
    abilityUsed: {
      event: {
        type: 'abilityUsed',
        unitId: actor.id,
        abilityId: ability.id,
        target: point,
        tiles: [point],
      },
      expected: [actor.name, ability.name],
    },
    attackMissed: {
      event: { type: 'attackMissed', unitId: actor.id, targetId: target.id },
      expected: [actor.name, target.name, 'miss'],
    },
    damaged: {
      event: {
        type: 'damaged',
        unitId: target.id,
        sourceId: actor.id,
        amount: 7,
        crit: true,
        damageType: 'fire',
      },
      expected: [actor.name, target.name, '7', 'critical'],
    },
    healed: {
      event: { type: 'healed', unitId: actor.id, amount: 4 },
      expected: [actor.name, '4', 'health'],
    },
    statusApplied: {
      event: { type: 'statusApplied', unitId: target.id, status: status.id, duration: 2 },
      expected: [target.name, status.name],
    },
    statusExpired: {
      event: { type: 'statusExpired', unitId: target.id, status: status.id },
      expected: [target.name, status.name, 'no longer'],
    },
    surfaceChanged: {
      event: {
        type: 'surfaceChanged',
        pos: point,
        from: null,
        to: surface.id,
        label: `${surface.name} spreads across the ground.`,
      },
      expected: [surface.name],
    },
    unitPushed: {
      event: { type: 'unitPushed', unitId: target.id, to: point },
      expected: [target.name, 'shov'],
    },
    unitDied: {
      event: { type: 'unitDied', unitId: target.id },
      expected: [target.name, 'down'],
    },
    propDamaged: {
      event: { type: 'propDamaged', propId: prop.id, name: propDef.name, amount: 2, pos: prop.pos },
      expected: null,
    },
    propDestroyed: {
      event: { type: 'propDestroyed', propId: prop.id, pos: prop.pos, label: propDef.breakLabel },
      expected: [propDef.breakLabel],
    },
    propIgnited: {
      event: {
        type: 'propIgnited',
        propId: fuelId,
        pos: point,
        label: `${fuel.name} catches fire!`,
      },
      expected: [fuel.name, 'fire'],
    },
    propDoused: {
      event: { type: 'propDoused', propId: fuelId, pos: point, label: `${fuel.name} is put out.` },
      expected: [fuel.name, 'out'],
    },
    propSpread: {
      event: { type: 'propSpread', propId: fuelId, label: `Flames spread from ${fuel.name}.` },
      expected: [fuel.name, 'spread'],
    },
    propPushed: {
      event: { type: 'propPushed', propId: prop.id, to: point },
      expected: [propDef.name, 'slides'],
    },
    standingChanged: {
      event: { type: 'standingChanged', nation: 'earth', value: 1, delta: 1 },
      expected: ['the Earth Kingdom', 'improves'],
    },
    xpGained: { event: { type: 'xpGained', unitId: actor.id, amount: 50 }, expected: null },
    leveledUp: {
      event: { type: 'leveledUp', unitId: actor.id, level: 2, unlocked: [ability.id] },
      expected: [actor.name, 'level', '2', ability.name],
    },
    levelChoiceOffered: {
      event: { type: 'levelChoiceOffered', unitId: actor.id, options: [ability.id] },
      expected: [actor.name, 'technique', 'choose'],
    },
    disciplineOffered: {
      event: { type: 'disciplineOffered', unitId: actor.id, options: [discipline.id] },
      expected: [actor.name, 'choose', 'path'],
    },
    disciplineChosen: {
      event: {
        type: 'disciplineChosen',
        unitId: actor.id,
        disciplineId: discipline.id,
        unlocked: [ability.id],
      },
      expected: [actor.name, discipline.name, ability.name],
    },
    battleEnded: {
      event: { type: 'battleEnded', outcome: 'victory' },
      expected: ['won'],
    },
    screenChanged: { event: { type: 'screenChanged', screen: 'explore' }, expected: null },
    phaseChanged: {
      event: { type: 'phaseChanged', from: 'night', to: 'dawn', day: 2 },
      expected: ['dawn'],
    },
  } satisfies FixtureTable;
  return { battle, actor, target, table };
}

// Only actual identifier tokens with a separate display name are forbidden.
// Ordinary prose such as "well-known" is not a raw-id failure.
const namedDefinitions = [
  ...CONTENT.characters.values(),
  ...CONTENT.enemies.values(),
  ...CONTENT.abilities.values(),
  ...CONTENT.statuses.values(),
  ...CONTENT.surfaces.values(),
  ...CONTENT.props.values(),
  ...CONTENT.disciplines.values(),
];
const rawContentIds = new Set(
  namedDefinitions.filter((d) => d.id !== d.name && /[-_]/.test(d.id)).map((d) => d.id),
);

function assertCleanLine(
  line: string,
  event: GameEvent,
  units: readonly Unit[],
  context: string,
): void {
  expect(line.trim(), context).not.toBe('');
  expect(line, context).not.toMatch(/undefined|NaN|null|\[object/);
  const rawIds = new Set([
    ...rawContentIds,
    ...units.filter((u) => u.id !== u.name).map((u) => u.id),
  ]);
  for (const token of line.match(/[\p{L}\p{N}_-]+/gu) ?? []) {
    expect(rawIds.has(token), `${context}: raw identifier ${token} in ${line}`).toBe(false);
  }
  const requiredNames: string[] = [];
  switch (event.type) {
    case 'turnStarted':
    case 'abilityUsed':
    case 'healed':
    case 'statusApplied':
    case 'statusExpired':
    case 'unitPushed':
    case 'unitDied':
    case 'leveledUp':
    case 'levelChoiceOffered':
    case 'disciplineOffered':
    case 'disciplineChosen':
      requiredNames.push(event.unitId);
      break;
    case 'attackMissed':
      requiredNames.push(event.unitId, event.targetId);
      break;
    case 'damaged':
      requiredNames.push(event.unitId);
      if (event.sourceId && event.cause !== 'ledgeDrop') requiredNames.push(event.sourceId);
      break;
  }
  for (const id of requiredNames) {
    const unit = required(
      units.find((u) => u.id === id),
      `${context}: actual roster name for ${id}`,
    );
    expect(line, context).toContain(unit.name);
  }
  if (event.type === 'abilityUsed')
    expect(line, context).toContain(required(CONTENT.abilities.get(event.abilityId), context).name);
  if (event.type === 'statusApplied' || event.type === 'statusExpired')
    expect(line, context).toContain(required(CONTENT.statuses.get(event.status), context).name);
}

/** Test meaning and data names without fixing editorial punctuation or a prefix. */
function assertTerms(line: string | null, terms: readonly string[]): string {
  const visible = required(line ?? undefined, `visible log for ${terms.join(', ')}`);
  expect(visible.trim()).not.toBe('');
  for (const term of terms) expect(visible.toLowerCase()).toContain(term.toLowerCase());
  return visible;
}

const sample = fixtures();

describe('player-facing event log', () => {
  it.each(Object.entries(sample.table))(
    'formats %s or explicitly keeps it silent',
    (type, fixture) => {
      expect(fixture.event.type).toBe(type);
      const line = describeEvent(CONTENT, sample.battle, fixture.event);
      if (fixture.expected === null) {
        expect(line).toBeNull();
      } else {
        const visible = assertTerms(line, fixture.expected);
        assertCleanLine(visible, fixture.event, sample.battle.units, type);
        // Authored text/labels are pass-through data, unlike formatter prose.
        if ('label' in fixture.event) expect(visible).toBe(fixture.event.label);
        if (fixture.event.type === 'message') expect(visible).toBe(fixture.event.text);
      }
    },
  );

  // Independent of conditions.ts and of element names: nations and bending
  // paths are different concepts. Include plural nations and non-benders.
  const nations = {
    fire: 'the Fire Nation',
    water: 'the Water Tribes',
    earth: 'the Earth Kingdom',
    air: 'the Air Nomads',
    nonbender: 'people who do not bend',
  } satisfies Record<ElementId, string>;
  const nationCases = Object.entries(nations).flatMap(([nation, words]) =>
    [-1, 1].map((delta) => ({ nation: nation as ElementId, words, delta })),
  );
  it.each(nationCases)(
    'names $nation standing correctly for delta $delta',
    ({ nation, words, delta }) => {
      const event: GameEvent = { type: 'standingChanged', nation, value: delta, delta };
      assertTerms(describeEvent(CONTENT, null, event), [words, delta > 0 ? 'improves' : 'worsens']);
    },
  );

  it('keeps generic, ledge, defeat and between-battle names meaningful', () => {
    const damage: Extract<GameEvent, { type: 'damaged' }> = {
      type: 'damaged',
      unitId: sample.target.id,
      amount: 3,
      crit: false,
      damageType: 'pure',
      sourceId: null,
    };
    assertTerms(describeEvent(CONTENT, sample.battle, damage), [sample.target.name, '3', 'damage']);
    assertTerms(describeEvent(CONTENT, sample.battle, { ...damage, cause: 'ledgeDrop' }), [
      sample.target.name,
      'ledge',
      '3',
      'damage',
    ]);
    const stumble = assertTerms(
      describeEvent(CONTENT, sample.battle, { ...damage, cause: 'ledgeDrop', amount: 0 }),
      [sample.target.name, 'ledge', 'stumble'],
    );
    expect(stumble).not.toMatch(/\bdamage\b/i);
    assertTerms(describeEvent(CONTENT, null, { type: 'battleEnded', outcome: 'defeat' }), [
      'overwhelmed',
    ]);
    assertTerms(
      describeEvent(CONTENT, null, sample.table.leveledUp.event, [sample.actor]),
      sample.table.leveledUp.expected,
    );
    assertTerms(
      describeEvent(CONTENT, { ...sample.battle, props: [] }, sample.table.propPushed.event),
      ['It', 'slides'],
    );
  });

  it('detects bad text, raw ids and missing actor names without banning hyphenated prose', () => {
    const event = sample.table.attackMissed.event;
    for (const text of ['undefined', 'NaN', 'null', '[object Object]', 'fire_jab', sample.actor.id])
      expect(() =>
        assertCleanLine(text, { type: 'message', text }, sample.battle.units, 'negative control'),
      ).toThrow();
    expect(() =>
      assertCleanLine('Someone misses someone.', event, sample.battle.units, 'names control'),
    ).toThrow();
    const text = 'The well-known path is blocked.';
    assertCleanLine(text, { type: 'message', text }, [], 'prose control');
  });

  it('formats every emitted event from twenty full seeded battles using their actual rosters', () => {
    const originalApply = reducer.apply;
    let currentContext = '';
    let observedEvents: GameEvent[] = [];
    let totalEvents = 0;
    let visibleLines = 0;
    let silentEvents = 0;
    const observer = vi.spyOn(reducer, 'apply').mockImplementation((content, before, command) => {
      const result = originalApply(content, before, command);
      const battle: BattleState | null = result.state.battle ?? before.battle;
      // Real pre/post units cover events emitted by a unit that leaves the
      // final roster; final names win. No ids are used as made-up names.
      const roster = [
        ...new Map(
          [
            ...before.party,
            ...(before.battle?.units ?? []),
            ...result.state.party,
            ...(result.state.battle?.units ?? []),
          ].map((unit) => [unit.id, unit]),
        ).values(),
      ];
      for (const event of result.events) {
        const context = `${currentContext}, step ${command.type}, event ${totalEvents} ${event.type}`;
        const line = describeEvent(content, battle, event, roster);
        if (sample.table[event.type].expected === null) {
          expect(line, context).toBeNull();
          silentEvents++;
        } else {
          expect(line, context).not.toBeNull();
          assertCleanLine(required(line ?? undefined, context), event, roster, context);
          visibleLines++;
        }
        observedEvents.push(event);
        totalEvents++;
      }
      return result;
    });
    let battles = 0;
    try {
      // Five seeds for each shipped encounter; the simulator retains its real
      // AI, expected levels, party, RNG, round cap and outcome rules.
      const encounterIds = [
        'enc_forest_road',
        'enc_quarry_gate',
        'enc_ambush',
        'enc_grumbler',
      ] as const;
      for (const encounterId of encounterIds) {
        required(CONTENT.encounters.get(encounterId), encounterId);
        for (let trial = 0; trial < 5; trial++) {
          const seed = seedFor(`combat-log-487-${encounterId}`, trial);
          currentContext = `${encounterId} seed ${seed}`;
          observedEvents = [];
          const result = runCombat(CONTENT, {
            encounterId,
            seed,
            party: STANDARD_PARTY,
            recordEvents: true,
          });
          expect(result.anomalies, currentContext).toEqual([]);
          expect(['victory', 'defeat'], currentContext).toContain(result.outcome);
          expect(result.rounds, currentContext).toBeGreaterThan(0);
          expect(result.rounds, currentContext).toBeLessThanOrEqual(DEFAULT_MAX_ROUNDS);
          expect(result.events, currentContext).toEqual(observedEvents);
          expect(
            result.events.some((event) => event.type === 'battleEnded'),
            currentContext,
          ).toBe(true);
          battles++;
        }
      }
      expect(battles).toBe(20);
      expect(observer).toHaveBeenCalled();
      expect(totalEvents).toBeGreaterThan(0);
      expect(visibleLines).toBeGreaterThan(0);
      expect(silentEvents).toBeGreaterThan(0);
      process.stdout.write(
        `${JSON.stringify({ kind: 'combat log coverage', battles, totalEvents, visibleLines, silentEvents })}\n`,
      );
    } finally {
      observer.mockRestore();
    }
  }, 20_000);
});
