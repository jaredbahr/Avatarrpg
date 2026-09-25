import { describe as suite, expect, it } from 'vitest';
import { createGame } from '../../core/state/createGame';
import { buildGrid, posKey, tileAt } from '../../core/rules/grid';
import { RANK_CONVERSATION, resolveResidents } from '../../core/story/residents';
import { activeTriggers, visibleNpcs } from '../../core/story/world';
import { DAY_PHASES, RESIDENT_PROFILES } from '../../core/types';
import type { DayPhase, GameState, ResidentProfile } from '../../core/types';
import { ASSETS } from '../assets/manifest';
import { CONTENT, CONTENT_BUNDLE } from '../index';
import { validateContent } from '../schemas';
import { RETURNEE_IDS, RETURNEE_PRESENTATIONS, RETURNEE_RECORDS } from './returnees';

const FOREST = 'forest_road';
const VILLAGE = 'ba_dan_village';
const RIVERSIDE = 'ba_dan_riverside';
const MAPS = [FOREST, VILLAGE, RIVERSIDE] as const;

const map = (id: string) => {
  const found = CONTENT.maps.get(id);
  if (!found) throw new Error(`Missing map ${id}`);
  return found;
};

function state(
  phase: DayPhase,
  profiles: Readonly<Record<string, ResidentProfile>> = {},
  mapId = FOREST,
): GameState {
  const base = createGame(CONTENT, {
    seed: 'returnee-profiles',
    party: [{ characterId: 'kaya' }],
    startNode: 'forest_explore',
  });
  return {
    ...base,
    screen: 'explore',
    story: { ...base.story, nodeId: 'forest_explore', visited: ['mira_intro', 'after_forest'] },
    location: { mapId, pos: { x: 1, y: 4 } },
    world: {
      ...base.world,
      clock: { day: 1, phase },
      residentProfiles: profiles,
    },
  };
}

const all = (profile: ResidentProfile): Readonly<Record<string, ResidentProfile>> =>
  Object.fromEntries(RETURNEE_IDS.map((id) => [id, profile]));

const returneePlacements = (current: GameState) =>
  resolveResidents(CONTENT, current).placements.filter((placement) =>
    (RETURNEE_IDS as readonly string[]).includes(placement.id),
  );

const visibleReturnees = (current: GameState) =>
  MAPS.flatMap((mapId) =>
    visibleNpcs(CONTENT, map(mapId), current)
      .filter((npc) => npc.resident && (RETURNEE_IDS as readonly string[]).includes(npc.resident))
      .map((npc) => ({ id: npc.resident!, mapId, npcId: npc.id })),
  );

suite('returnee profile ownership', () => {
  it.each(RESIDENT_PROFILES)(
    'resolves every %s profile in every phase without diagnostics',
    (profile) => {
      for (const phase of DAY_PHASES) {
        const resolution = resolveResidents(CONTENT, state(phase, all(profile)));
        expect(resolution.diagnostics, `${profile}, ${phase}`).toEqual([]);
        expect(returneePlacements(state(phase, all(profile))), `${profile}, ${phase}`).toHaveLength(
          5,
        );
      }
    },
  );

  it('treats absent keys and explicit missing alike: five placements, no visible actors', () => {
    for (const phase of DAY_PHASES) {
      for (const profiles of [{}, all('missing')]) {
        const placements = returneePlacements(state(phase, profiles));
        expect(
          placements.map((placement) => placement.anchor),
          phase,
        ).toEqual([null, null, null, null, null]);
        expect(visibleReturnees(state(phase, profiles)), phase).toEqual([]);
      }
    }
  });

  it('owns the forest only while returning and private homes only while resting', () => {
    const returningAnchors = RETURNEE_RECORDS.map((record) => record.returning);
    const homes = RETURNEE_RECORDS.map((record) => record.home);
    for (const phase of DAY_PHASES) {
      const returning = state(phase, all('returning'));
      expect(returneePlacements(returning).map((placement) => placement.anchor)).toEqual(
        returningAnchors,
      );
      expect(visibleReturnees(returning).map(({ id, mapId }) => ({ id, mapId }))).toEqual(
        RETURNEE_IDS.map((id) => ({ id, mapId: FOREST })),
      );

      const resting = state(phase, all('resting'));
      expect(returneePlacements(resting).map((placement) => placement.anchor)).toEqual(homes);
      expect(visibleReturnees(resting)).toEqual([]);
    }
  });

  it('keeps recovering appearances limited and ready appearances neutral', () => {
    for (const profile of ['recovering', 'ready'] as const) {
      for (const phase of DAY_PHASES) {
        const placements = returneePlacements(state(phase, all(profile)));
        for (const [index, record] of RETURNEE_RECORDS.entries()) {
          const publicPhases =
            profile === 'recovering' ? record.recoveryPhases : record.readyPhases;
          expect(placements[index]?.anchor, `${profile}, ${record.id}, ${phase}`).toBe(
            publicPhases.includes(phase) ? record.recovery : record.home,
          );
        }
      }
    }
  });

  it('never draws more than one copy of a resident across the three maps', () => {
    for (const profile of RESIDENT_PROFILES) {
      for (const phase of DAY_PHASES) {
        const seen = visibleReturnees(state(phase, all(profile)));
        for (const id of RETURNEE_IDS) {
          expect(
            seen.filter((entry) => entry.id === id).length,
            `${profile}, ${phase}, ${id}`,
          ).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('pins a returning speaker through the last line when the profile changes', () => {
    const base = state('evening', all('returning'));
    for (const record of RETURNEE_RECORDS) {
      const changed: GameState = {
        ...base,
        screen: 'dialogue',
        world: {
          ...base.world,
          residentProfiles: { ...base.world.residentProfiles, [record.id]: 'resting' },
          talk: { npcId: record.npc, mapId: FOREST, anchor: record.returning },
        },
      };
      const placement = returneePlacements(changed).find((entry) => entry.id === record.id);
      expect(placement?.rank, record.id).toBe(RANK_CONVERSATION);
      expect(placement?.anchor, record.id).toBe(record.returning);
      expect(placement?.mapId, record.id).toBe(FOREST);
    }
  });
});

suite('returnee placeholder contract', () => {
  it('leaves every visible returnee a reachable free approach tile', () => {
    for (const profile of ['returning', 'recovering', 'ready'] as const) {
      for (const phase of DAY_PHASES) {
        const current = state(phase, all(profile));
        for (const mapId of MAPS) {
          const definition = map(mapId);
          const grid = buildGrid(definition);
          const npcs = visibleNpcs(CONTENT, definition, current);
          const forbidden = new Set(
            [
              ...definition.partySpawns,
              ...(definition.exits ?? []).map((exit) => exit.pos),
              ...(definition.exit ? [definition.exit.pos] : []),
              ...(definition.restSpots ?? []).map((spot) => spot.pos),
              ...activeTriggers(definition, current).flatMap((trigger) => trigger.area),
              ...npcs.map((npc) => npc.pos),
            ].map(posKey),
          );
          for (const npc of npcs.filter(
            (entry) =>
              entry.resident && (RETURNEE_IDS as readonly string[]).includes(entry.resident),
          )) {
            const approachable = [-1, 0, 1].some((dx) =>
              [-1, 0, 1].some((dy) => {
                if (dx === 0 && dy === 0) return false;
                const next = { x: npc.pos.x + dx, y: npc.pos.y + dy };
                return tileAt(grid, next)?.blocked === false && !forbidden.has(posKey(next));
              }),
            );
            expect(approachable, `${profile}, ${phase}, ${mapId}, ${npc.id}`).toBe(true);
          }
        }
      }
    }
  });
  it('routes every NpcDef through the central table and existing manifest keys', () => {
    for (const record of RETURNEE_RECORDS) {
      const presentation = RETURNEE_PRESENTATIONS[record.id];
      expect(presentation.placeholder).toBe(true);
      expect(presentation.portrait).toBe('portrait.narrator');
      expect(ASSETS[presentation.npcSprite], record.id).toBeDefined();

      const definitions = MAPS.flatMap((mapId) =>
        map(mapId).npcs.filter((npc) => npc.resident === record.id),
      );
      expect(definitions.length, record.id).toBe(record.id === 'lw.npc.senn_messenger' ? 2 : 2);
      expect(
        definitions.every((npc) => npc.sprite === presentation.npcSprite),
        record.id,
      ).toBe(true);
    }
  });

  it("rejects a resident override that reads somebody else's profile", () => {
    const resident = CONTENT_BUNDLE.residents.find((entry) => entry.id === 'lw.npc.bo_shan');
    if (!resident) throw new Error('Missing Bo-shan');
    const returning = resident.overrides?.find((override) => override.id === 'bo_shan_returning');
    if (!returning) throw new Error('Missing Bo-shan returning override');
    const changed = {
      ...resident,
      overrides: (resident.overrides ?? []).map((override) =>
        override === returning
          ? {
              ...override,
              when: {
                kind: 'residentProfile' as const,
                residentId: 'lw.npc.leto',
                in: ['returning' as const],
              },
            }
          : override,
      ),
    };
    const problems = validateContent({
      ...CONTENT_BUNDLE,
      residents: CONTENT_BUNDLE.residents.map((entry) =>
        entry.id === changed.id ? changed : entry,
      ),
    });
    expect(problems).toContain(
      'resident "lw.npc.bo_shan" reads "lw.npc.leto" instead of its own profile "lw.npc.bo_shan"',
    );
  });
});
