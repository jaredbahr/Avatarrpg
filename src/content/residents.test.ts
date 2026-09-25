/**
 * `validateContent`'s resident rules (ADR 0047 §2, W4a): the zod shapes, the
 * structural rules, and the W0 identity register applied to resident records
 * (the five returnees W2 released, Hesh and Miri, `FORBIDDEN_BINDINGS`). Every
 * fixture is synthetic: one resident bound to Elder Mira's NpcDef in place of
 * the real Mira; Ba Dan's other records (W5a) stay as they are.
 */

import { describe, expect, it } from 'vitest';
import { CONTENT_BUNDLE } from './index';
import { validateContent } from './schemas';
import type { ContentBundle } from './schemas';
import { EXCLUDED_RESIDENTS, RELEASED_RESIDENTS } from './identity';
import type { IdentityEntry } from './identity';
import { ASSETS } from './assets/manifest';
import type {
  BackgroundRole,
  MapDef,
  NpcDef,
  ResidentDef,
  ResidentSlot,
  WorldAnchor,
} from '../core/types';

const VILLAGE = 'ba_dan_village';
const TABLE: ResidentSlot = {
  anchor: 'test.table',
  activity: 'idle',
  npc: 'elder_mira',
  interrupt: 'talk',
};

const ANCHORS: readonly WorldAnchor[] = [
  { id: 'test.table', place: 'TEST', site: { kind: 'map', mapId: VILLAGE, pos: { x: 11, y: 5 } } },
  { id: 'test.yard', place: 'TEST', site: { kind: 'map', mapId: VILLAGE, pos: { x: 3, y: 8 } } },
  {
    id: 'test.home',
    place: 'TEST',
    site: { kind: 'private', door: { mapId: VILLAGE, pos: { x: 12, y: 3 } } },
  },
];

const ELDER: ResidentDef = {
  id: 'test.elder',
  name: 'Test Elder',
  source: { runtimeNpcIds: ['elder_mira'] },
  home: 'test.home',
  fallback: TABLE,
  schedule: {
    dawn: TABLE,
    morning: TABLE,
    midday: TABLE,
    afternoon: TABLE,
    evening: TABLE,
    night: 'home',
  },
  overrides: [
    {
      id: 'intro',
      tier: 'mission',
      when: { kind: 'visited', nodeId: 'mira_intro' },
      slots: {},
      all: TABLE,
    },
  ],
};

const HELPER: BackgroundRole = {
  id: 'bg.test_helper',
  label: 'A helper',
  sprite: 'npc.guard',
  slots: { dawn: { anchor: 'test.yard', activity: 'sweep', interrupt: 'observe' } },
};

/** Rebinds (or adds) an NpcDef on the village map. */
function withNpc(npcs: readonly NpcDef[], npc: NpcDef): readonly NpcDef[] {
  return npcs.some((n) => n.id === npc.id)
    ? npcs.map((n) => (n.id === npc.id ? npc : n))
    : [...npcs, npc];
}

function bundle(
  change: {
    residents?: readonly ResidentDef[];
    roles?: readonly BackgroundRole[];
    anchors?: readonly WorldAnchor[];
    npc?: Partial<NpcDef> & { id: string };
    npcs?: readonly NpcDef[];
    map?: string;
  } = {},
): ContentBundle {
  const mapId = change.map ?? VILLAGE;
  const maps: readonly MapDef[] = CONTENT_BUNDLE.maps.map((raw) => {
    // The synthetic elder replaces the real Mira: her riverside NpcDef stands unbound.
    const map = {
      ...raw,
      npcs: raw.npcs.map((n) =>
        n.id === 'riverside_mira' ? { ...n, resident: undefined, pos: { x: 15, y: 9 } } : n,
      ),
    };
    if (map.id !== mapId) return map;
    const mira = map.npcs.find((n) => n.id === 'elder_mira');
    let npcs =
      mira && mapId === VILLAGE ? withNpc(map.npcs, { ...mira, resident: 'test.elder' }) : map.npcs;
    if (change.npc) {
      const base = npcs.find((n) => n.id === change.npc?.id) ?? npcs[0];
      if (!base) throw new Error(`No npc to base "${change.npc.id}" on`);
      npcs = withNpc(npcs, { ...base, ...change.npc });
    }
    for (const extra of change.npcs ?? []) npcs = withNpc(npcs, extra);
    return { ...map, npcs };
  });
  return {
    ...CONTENT_BUNDLE,
    maps,
    // Ba Dan's real records stay (W5a), all but Mira's, which the synthetic elder replaces.
    anchors: [...CONTENT_BUNDLE.anchors, ...(change.anchors ?? ANCHORS)],
    residents: [
      ...CONTENT_BUNDLE.residents.filter((r) => r.id !== 'lw.npc.mira'),
      ...(change.residents ?? [ELDER]),
    ],
    backgroundRoles: [...CONTENT_BUNDLE.backgroundRoles, ...(change.roles ?? [HELPER])],
  };
}

const problemsOf = (b: ContentBundle): string[] => validateContent(b);

/**
 * A synthetic record and bound NpcDef for a released identity, written the way
 * the per-person work will write it: the design key is the record, the runtime
 * slug is the NpcDef, and the two name the same person through `resident`.
 */
function released(entry: IdentityEntry): { resident: ResidentDef; npc: NpcDef } {
  const slug = entry.runtimeSlugs[0];
  if (!slug) throw new Error(`${entry.id} has no runtime slug`);
  const slot: ResidentSlot = {
    anchor: 'test.table',
    activity: 'idle',
    npc: slug,
    interrupt: 'talk',
  };
  return {
    resident: {
      id: entry.id,
      name: entry.name,
      source: { runtimeNpcIds: [slug] },
      home: 'test.home',
      fallback: slot,
      schedule: {
        dawn: slot,
        morning: slot,
        midday: slot,
        afternoon: slot,
        evening: slot,
        night: 'home',
      },
    },
    npc: {
      id: slug,
      name: entry.name,
      sprite: 'npc.elder',
      node: 'mira_intro',
      resident: entry.id,
    },
  };
}

describe('validateContent: resident records (ADR 0047 W4a)', () => {
  it('accepts a well-formed synthetic resident, anchor set and background role', () => {
    expect(problemsOf(bundle())).toEqual([]);
  });

  it('accepts a record for each of the five released returnees (W2)', () => {
    for (const entry of RELEASED_RESIDENTS) {
      const { resident, npc } = released(entry);
      const problems = problemsOf(bundle({ residents: [ELDER, resident], npcs: [npc] }));
      expect(problems, `${entry.id} should be claimable`).toEqual([]);
    }
  });

  it('still rejects a record for Hesh or Miri, by key, by runtime id and by name', () => {
    for (const entry of EXCLUDED_RESIDENTS) {
      const claims: ResidentDef[] = [
        { ...ELDER, id: entry.id },
        { ...ELDER, id: 'test.other', source: { runtimeNpcIds: [...entry.runtimeSlugs] } },
        { ...ELDER, id: 'test.other', name: entry.name },
      ];
      for (const claim of claims) {
        const problems = problemsOf(
          bundle({ residents: [ELDER, { ...claim, source: { ...claim.source } }] }),
        );
        expect(
          problems.some((p) => p.includes(`claims "${entry.id}"`)),
          `${entry.id} via ${claim.id}/${claim.name}`,
        ).toBe(true);
      }
    }
  });

  it('keeps lw.npc.senn_messenger the one canonical messenger record and blocks the legacy key', () => {
    const messenger = RELEASED_RESIDENTS.find((entry) => entry.id === 'lw.npc.senn_messenger');
    if (!messenger) throw new Error('The messenger is not in the release list');
    const { resident, npc } = released(messenger);
    expect(problemsOf(bundle({ residents: [ELDER, resident], npcs: [npc] }))).toEqual([]);

    // The superseded W0 key can never sit beside the canonical record as a
    // second Senn (ADR 0047 §8): it is a key, not a person.
    const legacy: ResidentDef = { ...ELDER, id: 'lw.npc.senn', source: { runtimeNpcIds: [] } };
    expect(problemsOf(bundle({ residents: [ELDER, resident, legacy], npcs: [npc] }))).toContain(
      'resident "lw.npc.senn" claims "lw.npc.senn", excluded until released',
    );
  });

  it('never binds `dema` to lw.npc.dema_cook or `rest_keeper` to lw.npc.sen_tea (FORBIDDEN_BINDINGS)', () => {
    const cases = [
      { map: 'forest_road', npcId: 'dema', resident: 'lw.npc.dema_cook' },
      { map: 'rest_stop', npcId: 'rest_keeper', resident: 'lw.npc.sen_tea' },
    ];
    for (const { map, npcId, resident } of cases) {
      const owner = CONTENT_BUNDLE.maps.find((m) => m.npcs.some((n) => n.id === npcId));
      expect(owner, `${npcId} is a real NpcDef`).toBeDefined();
      const record: ResidentDef = {
        ...ELDER,
        id: resident,
        name: resident,
        source: { runtimeNpcIds: [npcId] },
      };
      const problems = problemsOf(
        bundle({ residents: [ELDER, record], npc: { id: npcId, resident }, map: owner?.id ?? map }),
      );
      expect(problems).toContain(`resident "${resident}" must never bind runtime npc "${npcId}"`);
      expect(problems).toContain(`map "${owner?.id}" npc "${npcId}" must never bind "${resident}"`);
    }
  });

  it('allows the road-keeper binding the register does not forbid', () => {
    const owner = CONTENT_BUNDLE.maps.find((m) => m.npcs.some((n) => n.id === 'dema'));
    const record: ResidentDef = {
      ...ELDER,
      id: 'lw.npc.dema_roadkeeper',
      name: 'Dema, road keeper',
      source: { runtimeNpcIds: ['dema'] },
    };
    const problems = problemsOf(
      bundle({
        residents: [ELDER, record],
        npc: { id: 'dema', resident: record.id },
        map: owner?.id,
      }),
    );
    // Only the binding is under test: the borrowed slots still name the elder.
    expect(problems.filter((p) => p.includes('must never bind'))).toEqual([]);
    expect(problems.filter((p) => p.includes('claims'))).toEqual([]);
  });

  it('enforces the slot rules: npc means not observe, npc bound to its owner, mission takes talk', () => {
    const observing: ResidentDef = {
      ...ELDER,
      schedule: { ...ELDER.schedule, dawn: { ...TABLE, interrupt: 'observe' } },
    };
    expect(problemsOf(bundle({ residents: [observing] }))).toContain(
      'resident "test.elder" dawn: names an npc but only observes',
    );

    const stranger: ResidentDef = {
      ...ELDER,
      schedule: { ...ELDER.schedule, dawn: { ...TABLE, npc: 'shopkeeper_gao' } },
    };
    expect(problemsOf(bundle({ residents: [stranger] }))).toContain(
      'resident "test.elder" dawn: npc "shopkeeper_gao" is not an NpcDef bound to "test.elder" on the anchor\'s map',
    );

    const lax: ResidentDef = {
      ...ELDER,
      overrides: [
        {
          id: 'intro',
          tier: 'mission',
          when: { kind: 'visited', nodeId: 'mira_intro' },
          slots: {},
          all: { ...TABLE, interrupt: 'finish-then-talk' },
        },
      ],
    };
    expect(problemsOf(bundle({ residents: [lax] }))).toContain(
      'resident "test.elder" override "intro" all: a mission slot must name an npc and take \'talk\'',
    );
  });

  describe('a mission hold can never lose its required conversation', () => {
    const hold = (
      override: Partial<NonNullable<ResidentDef['overrides']>[number]>,
    ): ResidentDef => ({
      ...ELDER,
      overrides: [
        {
          id: 'intro',
          tier: 'mission',
          when: { kind: 'visited', nodeId: 'mira_intro' },
          slots: {},
          ...override,
        },
      ],
    });
    const intro = 'resident "test.elder" override "intro"';

    it('accepts all six phases in `slots` without `all`', () => {
      const six = hold({
        slots: {
          dawn: TABLE,
          morning: TABLE,
          midday: TABLE,
          afternoon: TABLE,
          evening: TABLE,
          night: TABLE,
        },
      });
      expect(problemsOf(bundle({ residents: [six] }))).toEqual([]);
    });

    it('rejects a hold with neither `all` nor every phase', () => {
      const partial = hold({ slots: { dawn: TABLE, morning: TABLE } });
      expect(problemsOf(bundle({ residents: [partial] }))).toContain(
        `${intro}: a mission hold must cover every phase`,
      );
    });

    it("rejects 'home' in a hold", () => {
      const home = hold({ slots: { night: 'home' }, all: TABLE });
      expect(problemsOf(bundle({ residents: [home] }))).toContain(
        `${intro} night: a mission hold can't be "home"`,
      );
    });

    it("rejects 'absent' in a hold", () => {
      const absent = hold({ all: 'absent' });
      expect(problemsOf(bundle({ residents: [absent] }))).toContain(
        `${intro} all: a mission hold can't be "absent"`,
      );
    });

    it('rejects a hold slot that names no npc', () => {
      const mute = hold({ all: { anchor: 'test.table', activity: 'idle', interrupt: 'talk' } });
      expect(problemsOf(bundle({ residents: [mute] }))).toContain(
        `${intro} all: a mission slot must name an npc and take 'talk'`,
      );
    });

    it('rejects a hold slot on a private anchor', () => {
      const hidden = hold({ all: { ...TABLE, anchor: 'test.home' } });
      expect(problemsOf(bundle({ residents: [hidden] }))).toContain(
        `${intro} all: a mission slot must be public`,
      );
    });
  });

  it('enforces the fallback and home rules', () => {
    const silent: ResidentDef = {
      ...ELDER,
      fallback: { anchor: 'test.table', activity: 'idle', interrupt: 'talk' },
    };
    expect(problemsOf(bundle({ residents: [silent] }))).toContain(
      'resident "test.elder": the fallback slot must name an npc and take \'talk\'',
    );
    const publicHome: ResidentDef = { ...ELDER, home: 'test.yard' };
    expect(problemsOf(bundle({ residents: [publicHome] }))).toContain(
      'resident "test.elder": home "test.yard" is not a private anchor',
    );
  });

  it('rejects unknown anchors, loops over two tiles and blocked anchor tiles', () => {
    const lost: ResidentDef = {
      ...ELDER,
      schedule: { ...ELDER.schedule, dawn: { ...TABLE, anchor: 'nowhere' } },
    };
    expect(problemsOf(bundle({ residents: [lost] }))).toContain(
      'resident "test.elder" dawn: unknown anchor "nowhere"',
    );

    const wander: ResidentDef = {
      ...ELDER,
      schedule: { ...ELDER.schedule, dawn: { ...TABLE, loop: [{ x: 14, y: 5 }] } },
    };
    expect(problemsOf(bundle({ residents: [wander] }))).toContain(
      'resident "test.elder" dawn: loop point 14,5 is over 2 tiles from its anchor',
    );

    const walled = ANCHORS.map((a) =>
      a.id === 'test.yard'
        ? { ...a, site: { kind: 'map' as const, mapId: VILLAGE, pos: { x: 0, y: 0 } } }
        : a,
    );
    expect(problemsOf(bundle({ anchors: walled }))).toContain(
      'anchor "test.yard" stands on a blocked tile',
    );
  });

  it("checks a background role's sprite against the asset manifest", () => {
    const withAssets = (roles: readonly BackgroundRole[]): ContentBundle => ({
      ...bundle({ roles }),
      assets: ASSETS,
    });
    expect(problemsOf(withAssets([HELPER]))).toEqual([]);
    expect(problemsOf(withAssets([{ ...HELPER, sprite: 'npc.nobody' }]))).toContain(
      'background role bg.test_helper: sprite "npc.nobody" has no entry in the asset manifest',
    );
  });

  it('never lets a background role wear a resident-bound NpcDef’s sprite', () => {
    // The W5 data before the review: riverside Dorin in `npc.guard`, the
    // sprite the unnamed relief watch also wears.
    const before: ContentBundle = {
      ...CONTENT_BUNDLE,
      maps: CONTENT_BUNDLE.maps.map((map) => ({
        ...map,
        npcs: map.npcs.map((n) => (n.id === 'riverside_dorin' ? { ...n, sprite: 'npc.guard' } : n)),
      })),
    };
    const clash =
      'background role "bg.relief_watch" wears "npc.guard", the sprite of resident-bound npc ba_dan_riverside:riverside_dorin';
    expect(problemsOf(before)).toContain(clash);
    expect(problemsOf(CONTENT_BUNDLE)).not.toContain(clash);
    expect(problemsOf(bundle({ roles: [{ ...HELPER, sprite: 'npc.elder' }] }))).toContain(
      'background role "bg.test_helper" wears "npc.elder", the sprite of resident-bound npc ba_dan_village:elder_mira',
    );
  });

  it('keeps background roles unnamed and non-interactive', () => {
    const named: BackgroundRole = { ...HELPER, id: 'lw.npc.bo' };
    expect(problemsOf(bundle({ roles: [named] }))).toContain(
      'background role "lw.npc.bo" uses a registered identity',
    );
    const talking: BackgroundRole = {
      ...HELPER,
      slots: { dawn: { anchor: 'test.yard', activity: 'sweep', interrupt: 'talk' } },
    };
    expect(problemsOf(bundle({ roles: [talking] }))).toContain(
      'background role "bg.test_helper" dawn: a background role only observes',
    );
  });

  it('rejects `when` on a bound NpcDef: its conditions belong in overrides', () => {
    const gated = bundle({
      npc: { id: 'elder_mira', resident: 'test.elder', when: { kind: 'phase', in: ['dawn'] } },
    });
    expect(problemsOf(gated)).toContain(
      'map "ba_dan_village" npc "elder_mira" is bound, so its conditions belong in overrides',
    );
  });

  it('checks the NpcDef side of a binding', () => {
    const unlisted: ResidentDef = { ...ELDER, source: { runtimeNpcIds: [] } };
    expect(problemsOf(bundle({ residents: [unlisted] }))).toContain(
      'map "ba_dan_village" npc "elder_mira" is not listed in "test.elder"\'s runtimeNpcIds',
    );
    expect(problemsOf(bundle({ residents: [] }))).toContain(
      'map "ba_dan_village" npc "elder_mira" is bound to unknown resident "test.elder"',
    );
  });

  it('rejects a bad shape through zod', () => {
    const badTier = {
      ...ELDER,
      overrides: [
        { id: 'x', tier: 'urgent', when: { kind: 'visited', nodeId: 'mira_intro' }, slots: {} },
      ],
    } as unknown as ResidentDef;
    expect(
      problemsOf(bundle({ residents: [badTier] })).some((p) =>
        p.startsWith('resident "test.elder": overrides.0.tier'),
      ),
    ).toBe(true);
  });
});
