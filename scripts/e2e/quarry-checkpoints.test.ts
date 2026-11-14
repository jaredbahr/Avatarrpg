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
      save: '71951c7d743bd08e1ab4417c87f9ce3ea5fce6e2c052914e94defc3ef2ce3b43',
      commands: '2986b8bd2cb798c780d0bdd23a0c9f3384f6a3898ec27c228d1ac97b27416e98',
      count: 62,
      node: 'gate_trade_explore',
      map: 'quarry_gate',
      level: 3,
      xp: 400,
      cleared: ['enc_forest_road'],
    },
    afterDriller: {
      save: 'd50551c30bd72440b911383a45c09cc2d05590a0a112f638d5fcdc2666708a49',
      commands: '359fa02033cdb4fe950aa2b02a45b781fa9927e6bcf4a77e4a281ee9817c39b6',
      count: 148,
      node: 'quarry_after_explore',
      map: 'quarry_floor',
      level: 4,
      xp: 570,
      cleared: ['enc_forest_road', 'enc_grumbler'],
    },
  },
  escort: {
    gate: {
      save: 'd86e46aa535b080b46ee97a6fe015cc11314729a98f7c37d61d023d4477da307',
      commands: '80f2dc38ba8abea391d05855e3375b02c7a090d429457235fd4ddce689d62b1b',
      count: 88,
      node: 'gate_escort_explore',
      map: 'quarry_gate',
      level: 3,
      xp: 250,
      cleared: ['enc_forest_road'],
    },
    afterDriller: {
      save: '0735c2591ce375c04e7b2cfcde4ff8322c2a260f8b26de28f87bf89c300cc94e',
      commands: 'e6725e73fcb6dc7b686e6fcc221d454cdc4439b25843d4af6a1265738ecfdc09',
      count: 385,
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
