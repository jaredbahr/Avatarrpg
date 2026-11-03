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
      save: '7ac3897704929fd4462bcd9b4252382ff9df2d311f2908a857e1730d2a0e46a1',
      commands: '7a9f72a0ae5af23b6e8fb5faa5fe3db163a9b018f3f4f1996cf18b07387d88a9',
      count: 62,
      node: 'gate_trade_explore',
      map: 'quarry_gate',
      level: 3,
      xp: 400,
      cleared: ['enc_forest_road'],
    },
    afterDriller: {
      save: 'aeee6bd55046a40755ddb60da7d808c7f240fc65c0baa6b4c9d0be742ce058b3',
      commands: '63c52fff9e70456ebcae022dcc1c3f764a486ad3441cd7e15d53798a5740a80c',
      count: 149,
      node: 'quarry_after_explore',
      map: 'quarry_floor',
      level: 4,
      xp: 570,
      cleared: ['enc_forest_road', 'enc_grumbler'],
    },
  },
  escort: {
    gate: {
      save: '26f85ad46094162ca9c9e62b468b23d01a0f820659f1a451dfaec4cfd349cd2a',
      commands: '5375bcf1e3aeeff44b19c044242fdb8f2b4ecbf6633604363d7b67f0509d17bf',
      count: 96,
      node: 'gate_escort_explore',
      map: 'quarry_gate',
      level: 3,
      xp: 250,
      cleared: ['enc_forest_road'],
    },
    afterDriller: {
      save: '0bb3309442bcfd15f7aab483d43ef72f96fd00d8bd20ba93292bfb79899f17d2',
      commands: 'b29b7096c97d82af9b78e9c981504ef54691333038a4dde7a6b3dd3ee080bcc7',
      count: 401,
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
