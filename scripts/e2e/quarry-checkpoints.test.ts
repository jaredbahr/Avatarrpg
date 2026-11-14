import { describe, expect, it } from 'vitest';
import { CONTENT, RETURNEE_IDS, STORY_ENTRY } from '../../src/content';
import { createGame } from '../../src/core/state/createGame';
import { apply } from '../../src/core/state/reducer';
import { deserialize, serialize, stateFromBlob } from '../../src/core/save/serialize';
import {
  CUSTODIES,
  STAGES,
  diffFacts,
  factsReport,
  fightSummaries,
  quarryCheckpointFacts,
  type QuarryCheckpointFacts,
} from './checkpoint-facts';
import { readPinnedFacts } from './checkpoint-pins';
import {
  QUARRY_ROUTES,
  generateQuarryCheckpoints,
  loadQuarryCheckpoint,
  quarryRouteBoundary,
} from './quarry-checkpoints';

/*
 * No digest is pinned here (#795). `quarry-checkpoints.facts.json` holds the
 * facts an AI retune must not move, a failure lists the ones that moved by
 * path, and `npm run checkpoints -- --write` re-pins them. How the fights were
 * played (the transcript, the RNG cursor, the log) is free to change; it is
 * held by rules instead: every command is legal and replays, every fight is
 * won inside the round cap, and the same seed gives the same bytes twice.
 */

const checkpoints = {
  trade: generateQuarryCheckpoints('trade'),
  escort: generateQuarryCheckpoints('escort'),
};
// A second, independent run. Both are made while the file loads, so no test
// here has a deadline that a busy machine could miss.
const again = {
  trade: generateQuarryCheckpoints('trade'),
  escort: generateQuarryCheckpoints('escort'),
};
const facts = quarryCheckpointFacts((custody) => checkpoints[custody]);
/**
 * Work bounds, not clocks, and not pins: about twice what each route takes
 * today (59, 145, 88 and 385 commands; the longest fight runs 8 rounds). An AI
 * retune moves the counts freely underneath them. A route that needs twice the
 * commands, or a fight past 20 rounds, has stopped being the route these were
 * written for: fights are meant to end in about six minutes at the table.
 */
const COMMAND_BUDGET = {
  trade: { gate: 120, afterDriller: 300 },
  escort: { gate: 180, afterDriller: 800 },
} as const;
const CANONICAL_FIGHT_ROUND_CAP = 20;
const pinned = readPinnedFacts() as Partial<QuarryCheckpointFacts>;

/** Fails with the moved facts by path and the one command that re-pins them. */
function expectPinned(label: string, was: unknown, is: unknown, path: string): void {
  const differences = diffFacts(was, is, path);
  if (differences.length > 0) expect.fail(factsReport(label, differences));
}

describe('quarry checkpoint save format', () => {
  it('keeps the shape of a save at a route boundary', () => {
    expectPinned(
      'The save shape while exploring',
      pinned.saveShape?.exploring,
      facts.saveShape.exploring,
      'saveShape.exploring',
    );
  });

  it('keeps the shape of a save in a fight that has just opened', () => {
    expectPinned(
      'The save shape at a battle opening',
      pinned.saveShape?.battleOpening,
      facts.saveShape.battleOpening,
      'saveShape.battleOpening',
    );
  });
});

for (const custody of CUSTODIES) {
  describe(`${custody} quarry checkpoints`, () => {
    const route = QUARRY_ROUTES[custody];

    it('opens the first fight with the pinned roster, places and turn order', () => {
      expectPinned(
        `The ${custody} route's first fight`,
        pinned[custody]?.firstBattleOpening,
        facts[custody].firstBattleOpening,
        `${custody}.firstBattleOpening`,
      );
    });

    it('generates the same saves and transcripts every time', () => {
      for (const stage of STAGES) {
        expect(again[custody][stage].transcript, stage).toEqual(
          checkpoints[custody][stage].transcript,
        );
        expect(again[custody][stage].json, stage).toBe(checkpoints[custody][stage].json);
      }
    });

    for (const stage of STAGES) {
      const fixture = checkpoints[custody][stage];

      it(`reaches the ${stage} boundary with the pinned story, party, flags and world`, () => {
        expectPinned(
          `The ${custody} ${stage} checkpoint`,
          pinned[custody]?.[stage],
          facts[custody][stage],
          `${custody}.${stage}`,
        );
      });

      it(`stands at the ${stage} boundary as the route intends`, () => {
        expect(fixture.projection).toEqual(quarryRouteBoundary(fixture.state));
        expect(fixture.projection.stage).toBe(stage);
        expect(fixture.projection.custody).toBe(custody);
        expect(fixture.projection.party.map((unit) => unit.id)).toEqual(
          route.names.map((_, index) => `p${index}`),
        );
        expect(fixture.projection.party.map((unit) => unit.name)).toEqual(route.names);
        expect(fixture.projection.party.map((unit) => unit.characterId)).toEqual(route.characters);
        expect(fixture.projection.flags.gate_talked_through).toBe(true);
        expect(fixture.projection.flags.ruon_respects_you).toBe(true);
        expect(fixture.projection.flags.ruon_traded === true).toBe(custody === 'trade');
        expect(fixture.projection.flags.ruon_paid === true).toBe(custody === 'trade');
        expect(fixture.projection.flags.ruon_spared === true).toBe(custody === 'escort');
        expect(fixture.projection.flags.act1_complete === true).toBe(stage === 'afterDriller');
        expect(fixture.projection.world.cleared).toEqual([
          'enc_forest_road',
          ...(stage === 'afterDriller' && custody === 'escort' ? ['enc_ambush'] : []),
          ...(stage === 'afterDriller' ? ['enc_grumbler'] : []),
        ]);
        expect(fixture.projection.screen).toBe('explore');
        expect(fixture.projection.pendingChoices).toEqual([]);
        expect(fixture.projection.battle).toBeNull();
        expect(fixture.projection.world.talk).toBeNull();
        expect(
          RETURNEE_IDS.map((id) => fixture.state.world.residentProfiles[id] ?? 'missing'),
        ).toEqual(RETURNEE_IDS.map(() => (stage === 'afterDriller' ? 'returning' : 'missing')));
        expect(fixture.state.world.clock.phase).toBe(
          stage === 'afterDriller' ? 'evening' : 'midday',
        );
      });

      it(`wins every fight on the way to ${stage} inside its work budget`, () => {
        const fights = fightSummaries(custody, fixture.transcript);
        const budget = COMMAND_BUDGET[custody][stage];
        if (fixture.transcript.length > budget)
          expect.fail(
            `The ${custody} route needs ${fixture.transcript.length} commands to reach ${stage}; ` +
              `its budget is ${budget}. Fights by commands and rounds: ` +
              fights.map((f) => `${f.encounterId} ${f.commands}/${f.rounds}`).join(', ') +
              '. Compare with `npm run checkpoints -- --diff` against a dump from main.',
          );
        expect(fights.map((fight) => fight.encounterId)).toEqual(fixture.projection.world.cleared);
        for (const fight of fights) {
          expect(fight.rounds, `${fight.encounterId} rounds`).toBeGreaterThan(0);
          expect(fight.rounds, `${fight.encounterId} rounds`).toBeLessThanOrEqual(
            CANONICAL_FIGHT_ROUND_CAP,
          );
          expect(fight.partyHpLeft, `${fight.encounterId} party HP`).toBeGreaterThan(0);
        }
      });

      it(`replays every ${stage} command through the reducer`, () => {
        let state = createGame(CONTENT, {
          seed: route.seed,
          party: route.characters.map((characterId) => ({ characterId })),
          startNode: STORY_ENTRY,
        });
        for (const [index, command] of fixture.transcript.entries()) {
          const before = state;
          const result = apply(CONTENT, state, command);
          state = result.state;
          expect(state, `command ${index}: ${JSON.stringify(command)}`).not.toBe(before);
          if (command.type === 'move') {
            expect(
              result.events.some(
                (event) => event.type === 'unitMoved' && event.unitId === command.unitId,
              ),
              `move ${index}`,
            ).toBe(true);
          }
          if (command.type === 'useAbility') {
            expect(
              result.events.some(
                (event) =>
                  event.type === 'abilityUsed' &&
                  event.unitId === command.unitId &&
                  event.abilityId === command.abilityId,
              ),
              `ability ${index}`,
            ).toBe(true);
          }
        }
        expect(state).toEqual(fixture.state);
      });

      it(`survives the App load reconciliation chain at ${stage}`, () => {
        const parsed = deserialize(fixture.json);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.blob.session).toEqual(fixture.session);
        expect(stateFromBlob(parsed.blob)).toEqual(fixture.state);
        const loaded = loadQuarryCheckpoint(fixture.json);
        expect(loaded).toEqual(fixture.state);
        const again = loadQuarryCheckpoint(
          serialize(loaded, {
            label: 'Slot 1',
            summary: `Quarry ${stage}`,
            savedAt: 1_700_000_000_000,
            session: fixture.session,
          }),
        );
        expect(again).toEqual(loaded);
      });
    }
  });
}
