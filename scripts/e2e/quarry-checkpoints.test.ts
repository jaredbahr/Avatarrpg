import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CONTENT, RETURNEE_IDS, STORY_ENTRY } from '../../src/content';
import { createGame } from '../../src/core/state/createGame';
import { apply } from '../../src/core/state/reducer';
import { deserialize, serialize, stateFromBlob } from '../../src/core/save/serialize';
import {
  QUARRY_ROUTES,
  generateQuarryCheckpoints,
  loadQuarryCheckpoint,
  quarryRouteBoundary,
} from './quarry-checkpoints';

const PINS = {
  trade: {
    gate: {
      save: '37f15908fa99d644bd1b433bb65e708ad39c7976ad88ad6f41e14237198c6776',
      commands: '88c77ab66ff1c75954adc4c6941e9bdfa3ac8e8ad470ff108fad717aa16719ac',
      count: 69,
      node: 'gate_trade_explore',
      map: 'quarry_gate',
      level: 3,
      xp: 400,
      cleared: ['enc_forest_road'],
    },
    afterDriller: {
      save: 'ca20515185e4903ffd277c7ded654521a4355d54d75535402acbff11bd96cd21',
      commands: '79b1ee1310071b115b6b0c805fe7660f6db51aebd81939e3f34db8029b621a14',
      count: 155,
      node: 'quarry_after_explore',
      map: 'quarry_floor',
      level: 4,
      xp: 570,
      cleared: ['enc_forest_road', 'enc_grumbler'],
    },
  },
  escort: {
    gate: {
      save: 'e3f553fa74d4532c4eb4dd6279ea63921206350f775fde67e924fdd5e7766491',
      commands: 'ec3785f624b43ca361ae35580cfcde9eba051a240152cb0a2be8f8fe4c73faaa',
      count: 98,
      node: 'gate_escort_explore',
      map: 'quarry_gate',
      level: 3,
      xp: 250,
      cleared: ['enc_forest_road'],
    },
    afterDriller: {
      save: '2d38241f15a50c7da2c21d50746a00056a9abf9c9e6632dc380eb187677f0de9',
      commands: 'dc7760a14e84cffa64c43941d3fae88e5050b3a243a558042af90b0dbdb7f9e3',
      count: 395,
      node: 'quarry_after_explore',
      map: 'quarry_floor',
      level: 4,
      xp: 570,
      cleared: ['enc_forest_road', 'enc_ambush', 'enc_grumbler'],
    },
  },
} as const;

const digest = (value: string) => createHash('sha256').update(value).digest('hex');

for (const custody of ['trade', 'escort'] as const) {
  describe(`${custody} quarry checkpoints`, () => {
    const route = QUARRY_ROUTES[custody];
    const checkpoints = generateQuarryCheckpoints(custody);

    for (const stage of ['gate', 'afterDriller'] as const) {
      const fixture = checkpoints[stage];
      const pin = PINS[custody][stage];

      it(`pins the entire ${stage} save and legal command transcript`, () => {
        expect(digest(fixture.json)).toBe(pin.save);
        expect(digest(JSON.stringify(fixture.transcript))).toBe(pin.commands);
        expect(fixture.transcript).toHaveLength(pin.count);
        expect(fixture.projection).toEqual(quarryRouteBoundary(fixture.state));
        expect(fixture.projection.story.nodeId).toBe(pin.node);
        expect(fixture.projection.location.mapId).toBe(pin.map);
        expect(fixture.projection.world.cleared).toEqual(pin.cleared);
        expect(fixture.projection.party.map((unit) => unit.level)).toEqual(
          route.names.map(() => pin.level),
        );
        expect(fixture.projection.party.map((unit) => unit.xp)).toEqual(
          route.names.map(() => pin.xp),
        );
        expect(fixture.projection.party.map((unit) => unit.id)).toEqual(
          route.names.map((_, index) => `p${index}`),
        );
        expect(fixture.projection.party.map((unit) => unit.name)).toEqual(route.names);
        expect(fixture.projection.party.map((unit) => unit.characterId)).toEqual(route.characters);
        expect(fixture.projection.flags.gate_talked_through).toBe(true);
        expect(fixture.projection.flags.ruon_respects_you).toBe(true);
        expect(fixture.projection.flags.ruon_traded === true).toBe(custody === 'trade');
        expect(fixture.projection.flags.ruon_paid === true).toBe(custody === 'trade');
        // Jin takes the satchel with Ruon on the trade; a won ambush keeps it (C-10).
        expect(fixture.projection.flags.jin_has_satchel === true).toBe(custody === 'trade');
        expect(fixture.projection.flags.ruon_spared === true).toBe(custody === 'escort');
        expect(fixture.projection.flags.act1_complete === true).toBe(stage === 'afterDriller');
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
