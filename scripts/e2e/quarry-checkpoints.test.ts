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

// The trade pins were re-pinned for #846: the Forest Road and the quarry gate lost a body each, so the
// scripted fights play out differently. The escort pins are unchanged.
const PINS = {
  trade: {
    gate: {
      save: '8bc16f4b95685b12ce2c3c8f98fd7984073cb46153aa56e4c09bca3a58535b04',
      commands: 'eecef9f6363a9332ace47ac39f96796c1913295a59ac5082ceac889bdcc21d18',
      count: 64,
      node: 'gate_trade_explore',
      map: 'quarry_gate',
      level: 3,
      xp: 400,
      cleared: ['enc_forest_road'],
    },
    afterDriller: {
      save: '4a5c1f7319f5cc7978e6ebe8ba44b4a3de9b4c45c33fffb7cbcc2ba3cffa43ac',
      commands: 'fa9a48628fb57ef427c047a7bc63b77fe00b0d885227262873213e82cf7fd0e3',
      count: 162,
      node: 'quarry_after_explore',
      map: 'quarry_floor',
      level: 4,
      xp: 570,
      cleared: ['enc_forest_road', 'enc_grumbler'],
    },
  },
  escort: {
    gate: {
      save: '0bf03a196eed0f15baa65efb5e25010c464f49cb3b223d28ed3719c131c91a3b',
      commands: 'ec3785f624b43ca361ae35580cfcde9eba051a240152cb0a2be8f8fe4c73faaa',
      count: 98,
      node: 'gate_escort_explore',
      map: 'quarry_gate',
      level: 3,
      xp: 250,
      cleared: ['enc_forest_road'],
    },
    afterDriller: {
      save: 'f7f6d4f1b6d97c3854ed504c923c6788436d5af95c3a7463a1a56e73a854cf44',
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
