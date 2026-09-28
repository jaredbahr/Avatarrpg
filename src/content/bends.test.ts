import { describe, expect, it } from 'vitest';
import { HEADINGS } from './assets/clips';
import type { Heading } from './assets/clips';
import {
  bendAttackCueSchema,
  bendEffectDefSchema,
  bendEffectLayerSchema,
  bendFrameSocketsSchema,
  bendKeyFrameSchema,
  bendReleaseSchema,
  bendResidueSchema,
  bendSetDefSchema,
  bendTrajectorySchema,
  headingBendDefSchema,
  validateBendSets,
} from './bends';
import type {
  BendAttackCue,
  BendEffectDef,
  BendEffectLayer,
  BendFrameSockets,
  BendKeyFrame,
  BendPhase,
  BendRelease,
  BendResidue,
  BendSetDef,
  BendTrajectory,
  HeadingBendDef,
} from './bends';
import { R9_EARTH, R9_FIRE, R9_TAKES, R9_WATER, r9FrameNames, r9Heading } from './bends.fixture';

/**
 * The bend contract is data, so it is validated like content (ADR 0055): every
 * rule gets its own failing case, and the approved r9 takes must pass untouched.
 */

const KNOWN_UNIT_ASSETS = ['unit.fire.kaya', 'unit.earth.bo', 'unit.water.sura'];
const KNOWN_FRAMES = ['bend/0', 'bend/1', 'bend/2'];
const SOURCE_SIZE = { width: 128, height: 128 };
const FRAME_SIZE = { width: 96, height: 96 };

function releaseOf(overrides: Partial<BendRelease> = {}): BendRelease {
  return {
    frame: 1,
    launchFrame: 1,
    socket: 'LW',
    launchHoldMs: 40,
    impactHoldMs: 80,
    flash: 0.6,
    shakeTiles: 0.1,
    ...overrides,
  };
}

function attackOf(overrides: Partial<BendAttackCue> = {}): BendAttackCue {
  return {
    id: 'jab',
    effectId: 'fx.fire.jab',
    releases: [releaseOf()],
    damageRelease: 0,
    ...overrides,
  };
}

function straight(speed: number): BendTrajectory {
  return { kind: 'straight', speedTilesPerSecond: speed };
}

function arc(speed: number, heightTiles = 1, spin = 1): BendTrajectory {
  return { kind: 'arc', speedTilesPerSecond: speed, heightTiles, spin };
}

function whipBolt(fraction: number, maxTiles: number, boltSpeed: number): BendTrajectory {
  return {
    kind: 'whipBolt',
    whipFraction: fraction,
    whipMaxTiles: maxTiles,
    boltSpeedTilesPerSecond: boltSpeed,
  };
}

function layerOf(phase: BendPhase, sequence: string): BendEffectLayer {
  return { phase, z: 'overActor', sequence, frameMs: [90], origin: 'socket', blend: 'add' };
}

function facingOf(overrides: Partial<HeadingBendDef> = {}): HeadingBendDef {
  return {
    frames: [...KNOWN_FRAMES],
    frameMs: [80, 80, 120],
    sourceSize: SOURCE_SIZE,
    root: { x: 64, y: 117 },
    scale: 0.75,
    frameSize: FRAME_SIZE,
    anchor: { x: 0.5, y: 0.9 },
    keyFrames: { gather: { frame: 0, role: 'anticipation' }, hit: { frame: 1, role: 'contact' } },
    smearFrame: 1,
    attacks: [attackOf()],
    socketsPerFrame: [
      { frame: 0, sockets: { LA: { x: 40, y: 90 }, RA: { x: 56, y: 90 } } },
      { frame: 1, sockets: { LW: { x: 24, y: 48 }, RW: { x: 72, y: 48 } } },
      { frame: 2, sockets: { LW: { x: 20, y: 44 }, RW: { x: 70, y: 44 } } },
    ],
    ...overrides,
  };
}

function setOf(
  options: {
    id?: string;
    unitAsset?: string;
    element?: BendSetDef['element'];
    headings?: Partial<Record<Heading, Partial<HeadingBendDef>>>;
    omit?: Heading;
  } = {},
): BendSetDef {
  const facings: Partial<Record<Heading, HeadingBendDef>> = {};
  for (const heading of HEADINGS) {
    if (heading === options.omit) continue;
    facings[heading] = facingOf(options.headings?.[heading] ?? {});
  }
  return {
    id: options.id ?? 'kaya.bend',
    unitAsset: options.unitAsset ?? 'unit.fire.kaya',
    element: options.element ?? 'fire',
    facings,
  } as BendSetDef;
}

function effectOf(overrides: Partial<BendEffectDef> = {}): BendEffectDef {
  return {
    id: 'fx.fire.jab',
    element: 'fire',
    layers: [
      layerOf('gather', 'bend-gather'),
      layerOf('impact', 'bend-burst'),
      layerOf('residue', 'bend-scorch'),
    ],
    trajectory: straight(6),
    impact: { sequence: 'bend-burst', flash: 0.4, shakeTiles: 0.1 },
    residue: { sequence: 'bend-scorch', durationMs: 600, gameplaySurface: false },
    ...overrides,
  };
}

const EFFECTS = [effectOf()];

function expectSchemaFailure(
  schema: { safeParse(value: unknown): { success: boolean } },
  value: unknown,
) {
  expect(schema.safeParse(value).success).toBe(false);
}

function problemsFor(
  sets: readonly BendSetDef[],
  effects: readonly BendEffectDef[] = EFFECTS,
  knownFrames?: readonly string[],
): string {
  return validateBendSets(sets, effects, KNOWN_UNIT_ASSETS, knownFrames).join('\n');
}

/** Every heading carries the take's south-east numbers, as the packer will. */
function r9Set(take: (typeof R9_TAKES)[number]): BendSetDef {
  const heading = r9Heading(take);
  const facings = Object.fromEntries(HEADINGS.map((key) => [key, heading]));
  return {
    id: `${take.take}.bend`,
    unitAsset: take.unitAsset,
    element: take.element,
    facings: facings as Record<Heading, HeadingBendDef>,
  };
}

function r9Effect(take: (typeof R9_TAKES)[number]): BendEffectDef {
  return effectOf({ id: take.attack.effectId, element: take.element });
}

describe('bend data contract', () => {
  it('accepts a minimal fixture with eight headings, three cels and one attack', () => {
    const set = setOf();
    const effect = effectOf();
    expect(validateBendSets([set], [effect], KNOWN_UNIT_ASSETS)).toEqual([]);
    expect(bendSetDefSchema.safeParse(set).success).toBe(true);
    expect(bendEffectDefSchema.safeParse(effect).success).toBe(true);
  });

  it('rejects a set missing one of the eight headings', () => {
    const set = setOf({ omit: 'southEast' });
    expect(problemsFor([set])).toContain('missing the southEast facing');
  });

  it('rejects a facing the headings do not name', () => {
    const set = setOf();
    const bent = { ...set, facings: { ...set.facings, sideways: set.facings.east } };
    expect(problemsFor([bent as unknown as BendSetDef])).toContain('unknown facing "sideways"');
  });

  it('rejects a heading with no cels', () => {
    const set = setOf({ headings: { east: { frames: [], frameMs: [], socketsPerFrame: [] } } });
    expect(problemsFor([set])).toContain('needs 1..16');
  });

  it('rejects a heading with more than sixteen cels', () => {
    const frames = Array.from({ length: 17 }, (_, index) => `bend/${index}`);
    const sockets = frames.map((_, frame): BendFrameSockets => ({ frame, sockets: {} }));
    const set = setOf({
      headings: { east: { frames, frameMs: frames.map(() => 80), socketsPerFrame: sockets } },
    });
    expect(problemsFor([set])).toContain('needs 1..16');
  });

  it('rejects a heading whose cel lists disagree in length', () => {
    const set = setOf({ headings: { east: { frameMs: [80, 80] } } });
    expect(problemsFor([set])).toContain('cel counts differ');
  });

  it('rejects a frameMs below sixteen', () => {
    const set = setOf({ headings: { east: { frameMs: [8, 80, 120] } } });
    expect(problemsFor([set])).toContain('frameMs[0] 8 is outside 16..1000');
  });

  it('rejects a frameMs above a thousand', () => {
    const set = setOf({ headings: { east: { frameMs: [80, 80, 2000] } } });
    expect(problemsFor([set])).toContain('frameMs[2] 2000 is outside 16..1000');
  });

  it('rejects socketsPerFrame that are not indexed in order', () => {
    const sockets: readonly BendFrameSockets[] = [{ frame: 1, sockets: {} }];
    const set = setOf({ headings: { east: { socketsPerFrame: sockets } } });
    expect(problemsFor([set])).toContain('socketsPerFrame[0] is frame 1, expected 0');
  });

  it('rejects a keyFrames entry outside the clip', () => {
    const keyFrames = { gather: { frame: 3, role: 'anticipation' } } as const;
    const set = setOf({ headings: { east: { keyFrames } } });
    expect(problemsFor([set])).toContain('keyFrames "gather" is frame 3 of 3');
  });

  it('rejects a keyFrames role outside the shared vocabulary', () => {
    const keyFrames = { F1: { frame: 1, role: 'strike' } as unknown as BendKeyFrame };
    const set = setOf({ headings: { east: { keyFrames } } });
    expect(problemsFor([set])).toContain('keyFrames "F1" has unknown role "strike"');
  });

  it('rejects a smearFrame outside the clip', () => {
    const set = setOf({ headings: { east: { smearFrame: 3 } } });
    expect(problemsFor([set])).toContain('smearFrame 3 is outside 0..2');
  });

  it('rejects a release frame outside the clip', () => {
    const attack = attackOf({ releases: [releaseOf({ frame: 3 })] });
    const set = setOf({ headings: { east: { attacks: [attack] } } });
    expect(problemsFor([set])).toContain('attack "jab" release 0 frame 3 is outside 0..2');
  });

  it('rejects a release launchFrame outside the clip', () => {
    const attack = attackOf({ releases: [releaseOf({ frame: 2, launchFrame: 3 })] });
    const set = setOf({ headings: { east: { attacks: [attack] } } });
    expect(problemsFor([set])).toContain('attack "jab" release 0 launchFrame 3 is outside 0..2');
  });

  it('rejects a release that launches after its contact frame', () => {
    const attack = attackOf({ releases: [releaseOf({ frame: 1, launchFrame: 2 })] });
    const set = setOf({ headings: { east: { attacks: [attack] } } });
    expect(problemsFor([set])).toContain('launchFrame 2 is after its frame 1');
  });

  it('accepts a release that launches before its contact frame', () => {
    const attack = attackOf({ releases: [releaseOf({ frame: 2, launchFrame: 1 })] });
    const set = setOf({
      headings: Object.fromEntries(HEADINGS.map((h) => [h, { attacks: [attack] }])),
    });
    expect(problemsFor([set])).toBe('');
  });

  it('checks every release socket against its own frames, not only the first', () => {
    const attack = attackOf({
      releases: [releaseOf(), releaseOf({ frame: 2, launchFrame: 2, socket: 'LA' })],
      damageRelease: 1,
    });
    const set = setOf({ headings: { east: { attacks: [attack] } } });
    const problems = problemsFor([set]);
    expect(problems).toContain('attack "jab" release 1 needs socket LA on frame 2');
    expect(problems).not.toContain('release 0 needs socket');
  });

  it('checks a release socket on its launch frame and its contact frame', () => {
    const attack = attackOf({ releases: [releaseOf({ frame: 1, launchFrame: 0 })] });
    const set = setOf({ headings: { east: { attacks: [attack] } } });
    expect(problemsFor([set])).toContain('release 0 needs socket LW on frame 0');
  });

  it('rejects an attack with no releases', () => {
    const set = setOf({ headings: { east: { attacks: [attackOf({ releases: [] })] } } });
    expect(problemsFor([set])).toContain('attack "jab" has no releases');
  });

  it('rejects a damage release that is not the last release', () => {
    const attack = attackOf({
      releases: [releaseOf(), releaseOf({ frame: 2, launchFrame: 2 })],
      damageRelease: 0,
    });
    const set = setOf({ headings: { east: { attacks: [attack] } } });
    expect(problemsFor([set])).toContain('damageRelease 0 must be the last, 1');
  });

  it('rejects releases out of play order', () => {
    const attack = attackOf({
      releases: [releaseOf({ frame: 2, launchFrame: 2 }), releaseOf()],
      damageRelease: 1,
    });
    const set = setOf({ headings: { east: { attacks: [attack] } } });
    expect(problemsFor([set])).toContain('release 1 frame 1 is before 2');
  });

  it('accepts two releases on one frame from different sockets', () => {
    const attack = attackOf({
      releases: [releaseOf(), releaseOf({ socket: 'RW' })],
      damageRelease: 1,
    });
    const set = setOf({
      headings: Object.fromEntries(HEADINGS.map((h) => [h, { attacks: [attack] }])),
    });
    expect(problemsFor([set])).toBe('');
  });

  it('rejects two releases on one frame from the same socket', () => {
    const attack = attackOf({ releases: [releaseOf(), releaseOf()], damageRelease: 1 });
    const set = setOf({ headings: { east: { attacks: [attack] } } });
    expect(problemsFor([set])).toContain('release 1 repeats socket LW on frame 1');
  });

  it('rejects two attacks with one id in a heading', () => {
    const set = setOf({ headings: { east: { attacks: [attackOf(), attackOf()] } } });
    expect(problemsFor([set])).toContain('attack id "jab" repeats');
  });

  it.each([
    ['a different id', { id: 'cross' }],
    ['a different effect', { effectId: 'fx.fire.other' }],
    [
      'a different release count',
      { releases: [releaseOf(), releaseOf({ frame: 2, launchFrame: 2 })], damageRelease: 1 },
    ],
  ])('rejects a heading whose attack has %s', (_label, override) => {
    const effects = [...EFFECTS, effectOf({ id: 'fx.fire.other' })];
    const set = setOf({ headings: { west: { attacks: [attackOf(override)] } } });
    expect(problemsFor([set], effects)).toContain('west: attacks [');
    expect(problemsFor([set], effects)).toContain('differ from east');
  });

  it('rejects a heading with a different attack count', () => {
    const set = setOf({ headings: { west: { attacks: [] } } });
    expect(problemsFor([set])).toContain('west: attacks [] differ from east [jab/fx.fire.jab/1/0]');
  });

  it('rejects a socket outside the packed frame', () => {
    const sockets: readonly BendFrameSockets[] = [
      { frame: 0, sockets: {} },
      { frame: 1, sockets: { LW: { x: 200, y: 48 } } },
      { frame: 2, sockets: {} },
    ];
    const set = setOf({ headings: { east: { socketsPerFrame: sockets } } });
    expect(problemsFor([set])).toContain('socket LW at 200,48 is outside 96x96');
  });

  it('rejects a scale outside (0,1]', () => {
    const set = setOf({ headings: { east: { scale: 1.5 } } });
    expect(problemsFor([set])).toContain('scale 1.5 must be in (0,1]');
  });

  it('skips only the effect check while the effects are not authored', () => {
    const attack = attackOf({ effectId: 'fx.none.thing' });
    const everywhere = Object.fromEntries(HEADINGS.map((h) => [h, { attacks: [attack] }]));
    expect(validateBendSets([setOf({ headings: everywhere })], null, KNOWN_UNIT_ASSETS)).toEqual(
      [],
    );
    const late = attackOf({ effectId: 'fx.none.thing', releases: [releaseOf({ frame: 3 })] });
    const bad = setOf({ headings: { east: { attacks: [late] } } });
    const problems = validateBendSets([bad], null, KNOWN_UNIT_ASSETS).join('\n');
    expect(problems).toContain('release 0 frame 3 is outside 0..2');
    expect(problems).toContain('differ from east [jab/fx.none.thing/1/0]');
    expect(problems).not.toContain('unknown effect');
  });

  it('rejects an attack pointing at an unknown effect', () => {
    const attack = attackOf({ effectId: 'fx.none.thing' });
    const set = setOf({ headings: { east: { attacks: [attack] } } });
    expect(problemsFor([set])).toContain('uses unknown effect "fx.none.thing"');
  });

  it('rejects an attack whose effect bends another element', () => {
    const attack = attackOf({ effectId: 'fx.water.whip' });
    const set = setOf({ headings: { east: { attacks: [attack] } } });
    const effects = [effectOf(), effectOf({ id: 'fx.water.whip', element: 'water' })];
    expect(problemsFor([set], effects)).toContain('uses water effect "fx.water.whip"');
  });

  it('rejects a unit asset the content does not know', () => {
    const set = setOf({ unitAsset: 'unit.fire.nobody' });
    expect(problemsFor([set])).toContain('uses unknown unit asset "unit.fire.nobody"');
  });

  it('rejects two bend sets on one unit asset', () => {
    const set = setOf();
    const repeat = setOf({ id: 'kaya.bend.two' });
    expect(problemsFor([set, repeat])).toContain('repeats unit asset "unit.fire.kaya"');
  });

  it('rejects two bend sets with one id', () => {
    const set = setOf();
    const repeat = setOf({ unitAsset: 'unit.earth.bo', element: 'earth' });
    expect(problemsFor([set, repeat])).toContain('bend id "kaya.bend" repeats');
  });

  it('rejects two effects with one id', () => {
    expect(problemsFor([], [effectOf(), effectOf()])).toContain('effect id "fx.fire.jab" repeats');
  });

  it.each([
    ['launchHoldMs', { launchHoldMs: 400 }, 'launchHoldMs 400 is outside 0..300'],
    ['impactHoldMs', { impactHoldMs: 301 }, 'impactHoldMs 301 is outside 0..300'],
    ['flash', { flash: 1.5 }, 'flash 1.5 is outside 0..1'],
    ['shakeTiles', { shakeTiles: 0.8 }, 'shakeTiles 0.8 is outside 0..0.5'],
    ['infinite shakeTiles', { shakeTiles: Infinity }, 'shakeTiles Infinity is outside 0..0.5'],
  ])('rejects a release %s out of range', (_label, override, message) => {
    const attack = attackOf({ releases: [releaseOf(override)] });
    const set = setOf({ headings: { east: { attacks: [attack] } } });
    expect(problemsFor([set])).toContain(message);
  });

  it('rejects an impact flash or shake out of range', () => {
    const effect = effectOf({ impact: { sequence: 'bend-burst', flash: 2, shakeTiles: 1 } });
    const problems = problemsFor([], [effect]);
    expect(problems).toContain('impact flash 2 is outside 0..1');
    expect(problems).toContain('impact shakeTiles 1 is outside 0..0.5');
  });

  it('rejects an effect layer cel outside 16..1000 ms', () => {
    const effect = effectOf({ layers: [{ ...layerOf('travel', 'bolt'), frameMs: [8] }] });
    expect(problemsFor([], [effect])).toContain('layer 0 frameMs[0] 8 is outside 16..1000');
  });

  it('rejects a residue that claims to be a gameplay surface', () => {
    const residue = {
      sequence: 'bend-scorch',
      durationMs: 600,
      gameplaySurface: true,
    } as unknown as BendResidue;
    const effect = effectOf({ residue });
    expect(problemsFor([], [effect])).toContain('residue gameplaySurface must be false');
  });

  it('rejects a residue that lingers too long', () => {
    const residue: BendResidue = {
      sequence: 'bend-scorch',
      durationMs: 5000,
      gameplaySurface: false,
    };
    expect(problemsFor([], [effectOf({ residue })])).toContain(
      'residue durationMs 5000 is outside 0..3000',
    );
  });

  it('rejects a residue no residue layer draws', () => {
    const effect = effectOf({
      layers: [layerOf('gather', 'bend-gather'), layerOf('residue', 'bend-smoke')],
    });
    expect(problemsFor([], [effect])).toContain('residue "bend-scorch" has no residue layer');
  });

  it('rejects a residue layer without a residue', () => {
    const { residue: _dropped, ...rest } = effectOf();
    expect(problemsFor([], [rest])).toContain('has a residue layer but no residue');
  });

  it('accepts an effect with neither residue nor residue layer', () => {
    const { residue: _dropped, ...rest } = effectOf({ layers: [layerOf('impact', 'bend-burst')] });
    expect(problemsFor([], [rest])).toBe('');
  });

  it('rejects a whipFraction outside (0,1]', () => {
    const effect = effectOf({ trajectory: whipBolt(0, 2, 5) });
    expect(problemsFor([], [effect])).toContain('whipFraction 0 must be in (0,1]');
  });

  it('rejects a whipMaxTiles that does not reach or reaches too far', () => {
    expect(problemsFor([], [effectOf({ trajectory: whipBolt(0.5, 0, 5) })])).toContain(
      'whipMaxTiles 0 must be above 0',
    );
    expect(problemsFor([], [effectOf({ trajectory: whipBolt(0.5, 17, 5) })])).toContain(
      'whipMaxTiles 17 must be above 0 and at most 16',
    );
  });

  it('rejects a straight trajectory that does not travel', () => {
    const effect = effectOf({ trajectory: straight(0) });
    expect(problemsFor([], [effect])).toContain('speedTilesPerSecond 0 must be above 0');
  });

  it('rejects an infinite speed', () => {
    const effect = effectOf({ trajectory: straight(Infinity) });
    expect(problemsFor([], [effect])).toContain('speedTilesPerSecond Infinity must be above 0');
  });

  it('rejects an arc trajectory that does not travel', () => {
    const effect = effectOf({ trajectory: arc(0) });
    expect(problemsFor([], [effect])).toContain('speedTilesPerSecond 0 must be above 0');
  });

  it('rejects an arc height or spin out of range', () => {
    const problems = problemsFor([], [effectOf({ trajectory: arc(4, Infinity, -9) })]);
    expect(problems).toContain('heightTiles Infinity is outside 0..4');
    expect(problems).toContain('spin -9 is outside -8..8');
  });

  it('rejects a whipBolt whose bolt does not travel', () => {
    const effect = effectOf({ trajectory: whipBolt(0.5, 2, 0) });
    expect(problemsFor([], [effect])).toContain('boltSpeedTilesPerSecond 0 must be above 0');
  });

  it('checks frame names against the unit atlas when the caller knows them', () => {
    expect(problemsFor([setOf()], EFFECTS, KNOWN_FRAMES)).toBe('');
    const problems = problemsFor([setOf()], EFFECTS, ['bend/0', 'bend/1']);
    expect(problems).toContain('"bend/2" is unknown');
  });
});

describe('the approved r9 bends', () => {
  it.each(R9_TAKES.map((take) => [take.take, take] as const))(
    'validate as data and against the schemas: %s',
    (_label, take) => {
      const set = r9Set(take);
      const effect = r9Effect(take);
      expect(validateBendSets([set], [effect], KNOWN_UNIT_ASSETS, r9FrameNames(take))).toEqual([]);
      expect(bendSetDefSchema.safeParse(set).success).toBe(true);
    },
  );

  it('all validate together, each character with its own clip', () => {
    const sets = R9_TAKES.map(r9Set);
    const effects = R9_TAKES.map(r9Effect);
    const frames = R9_TAKES.flatMap(r9FrameNames);
    expect(validateBendSets(sets, effects, KNOWN_UNIT_ASSETS, frames)).toEqual([]);
  });

  it('draws fire as one attack of two releases, damage on the cross', () => {
    const heading = r9Heading(R9_FIRE);
    expect(heading.frames).toHaveLength(13);
    expect(heading.attacks).toHaveLength(1);
    const [attack] = heading.attacks;
    expect(attack?.releases.map((r) => [r.socket, r.launchFrame, r.launchHoldMs])).toEqual([
      ['LW', 2, 60],
      ['RW', 6, 100],
    ]);
    expect(attack?.damageRelease).toBe(1);
  });

  it('draws earth as one attack of two releases, damage on the drive', () => {
    const [attack] = r9Heading(R9_EARTH).attacks;
    expect(attack?.releases.map((r) => [r.socket, r.launchFrame, r.launchHoldMs])).toEqual([
      ['LA', 4, 50],
      ['LW', 6, 110],
    ]);
    expect(attack?.damageRelease).toBe(1);
  });

  it('draws water as one attack of one release', () => {
    const [attack] = r9Heading(R9_WATER).attacks;
    expect(attack?.releases).toHaveLength(1);
    expect(attack?.damageRelease).toBe(0);
  });

  it('keys every strike as a contact, the same way in all three elements', () => {
    for (const take of R9_TAKES) {
      const heading = r9Heading(take);
      const contacts = Object.values(heading.keyFrames)
        .filter((key) => key.role === 'contact')
        .map((key) => key.frame);
      const strikes = heading.attacks.flatMap((attack) => attack.releases.map((r) => r.frame));
      expect(contacts, take.take).toEqual(strikes);
    }
  });

  it('maps the root-lock point onto the foot anchor at the G scale', () => {
    for (const take of R9_TAKES) {
      const heading = r9Heading(take);
      const foot = {
        x: heading.anchor.x * heading.frameSize.width,
        y: heading.anchor.y * heading.frameSize.height,
      };
      expect(heading.root.x * heading.scale).toBeCloseTo(foot.x, 6);
      expect(heading.root.y * heading.scale).toBeCloseTo(foot.y, 6);
      // The stance cel's corner, (64, 64) in the source, lands where the G
      // packer puts it: 8 px left of and 31 px below a 128x192 cel's corner,
      // whose foot anchor is (64, 163.2).
      expect(64 * heading.scale - foot.x).toBeCloseTo(-8 - 64, 6);
      expect(64 * heading.scale - foot.y).toBeCloseTo(31 - 163.2, 6);
    }
  });

  it('rejects fire if its damage moves to the jab', () => {
    const set = r9Set(R9_FIRE);
    const heading = r9Heading(R9_FIRE);
    const attacks = [{ ...R9_FIRE.attack, damageRelease: 0 }];
    const bent = { ...set, facings: { ...set.facings, southEast: { ...heading, attacks } } };
    const problems = validateBendSets([bent], [r9Effect(R9_FIRE)], KNOWN_UNIT_ASSETS).join('\n');
    expect(problems).toContain('damageRelease 0 must be the last, 1');
    expect(problems).toContain('southEast: attacks [');
  });

  it('rejects earth if the drive leaves from a socket frame 6 does not carry', () => {
    const heading = r9Heading(R9_EARTH);
    const socketsPerFrame = heading.socketsPerFrame.map((entry) =>
      entry.frame === 6 ? { frame: 6, sockets: { RA: { x: 129, y: 230 } } } : entry,
    );
    const set = r9Set(R9_EARTH);
    const bent = {
      ...set,
      facings: { ...set.facings, southEast: { ...heading, socketsPerFrame } },
    };
    const problems = validateBendSets([bent], [r9Effect(R9_EARTH)], KNOWN_UNIT_ASSETS).join('\n');
    expect(problems).toContain('attack "earth-strike" release 1 needs socket LW on frame 6');
    expect(problems).not.toContain('release 0 needs socket');
  });
});

describe('bend schemas', () => {
  it('requires all eight literal heading keys', () => {
    expectSchemaFailure(bendSetDefSchema, setOf({ omit: 'southEast' }));
  });

  it.each([
    ['frame below zero', { frame: -1 }],
    ['fractional frame', { frame: 1.5 }],
    ['launchFrame below zero', { launchFrame: -1 }],
    ['fractional launchFrame', { launchFrame: 0.5 }],
    ['launch hold below zero', { launchHoldMs: -1 }],
    ['launch hold above 300', { launchHoldMs: 301 }],
    ['impact hold below zero', { impactHoldMs: -1 }],
    ['impact hold above 300', { impactHoldMs: 301 }],
    ['flash above one', { flash: 1.01 }],
    ['negative flash', { flash: -0.1 }],
    ['shake above half a tile', { shakeTiles: 0.51 }],
    ['infinite shake', { shakeTiles: Infinity }],
  ])('rejects a release with %s', (_label, override) => {
    expectSchemaFailure(bendReleaseSchema, releaseOf(override));
  });

  it('accepts a release without flash or shake', () => {
    const { flash: _flash, shakeTiles: _shake, ...bare } = releaseOf();
    expect(bendReleaseSchema.safeParse(bare).success).toBe(true);
  });

  it.each([
    ['no releases', { releases: [] }],
    ['a fractional damage release', { damageRelease: 0.5 }],
    ['a negative damage release', { damageRelease: -1 }],
  ])('rejects an attack cue with %s', (_label, override) => {
    expectSchemaFailure(bendAttackCueSchema, attackOf(override));
  });

  it('rejects a key frame role outside the vocabulary', () => {
    expectSchemaFailure(bendKeyFrameSchema, { frame: 1, role: 'strike' });
  });

  it.each([
    ['no frames', { frames: [] }],
    ['more than sixteen frames', { frames: Array.from({ length: 17 }, () => 'bend/0') }],
    ['frameMs below sixteen', { frameMs: [15, 80, 120] }],
    ['frameMs above one thousand', { frameMs: [80, 80, 1001] }],
    ['fractional frameMs', { frameMs: [80, 80.5, 120] }],
    ['fractional key frame', { keyFrames: { hit: { frame: 1.5, role: 'contact' } } }],
    ['negative key frame', { keyFrames: { hit: { frame: -1, role: 'contact' } } }],
    ['a bare-number key frame', { keyFrames: { hit: 1 } }],
    ['fractional smear frame', { smearFrame: 1.5 }],
    ['negative smear frame', { smearFrame: -1 }],
    ['an infinite root', { root: { x: Infinity, y: 0 } }],
    ['a zero scale', { scale: 0 }],
    ['a scale above one', { scale: 1.5 }],
    ['a fractional frame size', { frameSize: { width: 96.5, height: 96 } }],
  ])('rejects a heading with %s', (_label, override) => {
    expectSchemaFailure(headingBendDefSchema, facingOf(override as Partial<HeadingBendDef>));
  });

  it.each([
    ['negative frame', { frame: -1, sockets: {} }],
    ['fractional frame', { frame: 0.5, sockets: {} }],
  ])('rejects frame sockets with a %s', (_label, value) => {
    expectSchemaFailure(bendFrameSocketsSchema, value);
  });

  it('requires residue gameplaySurface to be the literal false', () => {
    expectSchemaFailure(bendEffectDefSchema, {
      ...effectOf(),
      residue: { sequence: 'bend-scorch', durationMs: 600, gameplaySurface: true },
    });
  });

  it.each([
    ['negative', -1],
    ['above three seconds', 3001],
    ['infinite', Infinity],
  ])('rejects a residue durationMs that is %s', (_label, durationMs) => {
    expectSchemaFailure(bendResidueSchema, {
      sequence: 'bend-scorch',
      durationMs,
      gameplaySurface: false,
    });
  });

  it.each([
    ['straight speed', straight(0)],
    ['infinite straight speed', straight(Infinity)],
    ['arc speed', arc(0)],
    ['arc height below zero', arc(4, -1)],
    ['arc height above four', arc(4, 4.5)],
    ['infinite arc height', arc(4, Infinity)],
    ['arc spin above eight', arc(4, 1, 9)],
    ['infinite arc spin', arc(4, 1, -Infinity)],
    ['whip fraction at zero', whipBolt(0, 2, 5)],
    ['whip fraction above one', whipBolt(1.01, 2, 5)],
    ['whip maximum distance', whipBolt(0.5, 0, 5)],
    ['whip maximum distance above sixteen', whipBolt(0.5, 17, 5)],
    ['whip bolt speed', whipBolt(0.5, 2, 0)],
    ['infinite whip bolt speed', whipBolt(0.5, 2, Infinity)],
  ])('rejects a non-positive or out-of-range %s', (_label, trajectory) => {
    expectSchemaFailure(bendTrajectorySchema, trajectory);
  });

  it.each([
    ['empty timing', { ...layerOf('travel', 'bolt'), frameMs: [] }],
    ['timing below sixteen', { ...layerOf('travel', 'bolt'), frameMs: [15] }],
    ['timing above one thousand', { ...layerOf('travel', 'bolt'), frameMs: [1001] }],
    ['fractional timing', { ...layerOf('travel', 'bolt'), frameMs: [16.5] }],
  ])('rejects an effect layer with %s', (_label, layer) => {
    expectSchemaFailure(bendEffectLayerSchema, layer);
  });
});

describe('bend schemas are strict', () => {
  const extra = { packerNote: 'stray' };
  const heading = facingOf();
  const effect = effectOf();

  it.each([
    ['a release', bendReleaseSchema, { ...releaseOf(), ...extra }],
    ['an attack cue', bendAttackCueSchema, { ...attackOf(), ...extra }],
    ['a key frame', bendKeyFrameSchema, { frame: 1, role: 'contact', ...extra }],
    ['frame sockets', bendFrameSocketsSchema, { frame: 0, sockets: {}, ...extra }],
    ['a frame sockets map', bendFrameSocketsSchema, { frame: 0, sockets: { XX: { x: 1, y: 1 } } }],
    ['a socket point', bendFrameSocketsSchema, { frame: 0, sockets: { LW: { x: 1, y: 1, z: 1 } } }],
    ['a heading', headingBendDefSchema, { ...heading, ...extra }],
    ['a heading root', headingBendDefSchema, { ...heading, root: { x: 1, y: 1, ...extra } }],
    [
      'a heading anchor',
      headingBendDefSchema,
      { ...heading, anchor: { x: 0.5, y: 0.9, ...extra } },
    ],
    [
      'a heading source size',
      headingBendDefSchema,
      { ...heading, sourceSize: { ...SOURCE_SIZE, ...extra } },
    ],
    [
      'a heading frame size',
      headingBendDefSchema,
      { ...heading, frameSize: { ...FRAME_SIZE, ...extra } },
    ],
    ['a bend set', bendSetDefSchema, { ...setOf(), ...extra }],
    ['a layer', bendEffectLayerSchema, { ...layerOf('travel', 'bolt'), ...extra }],
    ['a straight trajectory', bendTrajectorySchema, { ...straight(4), ...extra }],
    ['an arc trajectory', bendTrajectorySchema, { ...arc(4), ...extra }],
    ['a whipBolt trajectory', bendTrajectorySchema, { ...whipBolt(0.5, 2, 5), ...extra }],
    [
      'a residue',
      bendResidueSchema,
      { sequence: 'bend-scorch', durationMs: 600, gameplaySurface: false, ...extra },
    ],
    ['an effect', bendEffectDefSchema, { ...effect, ...extra }],
    [
      'an effect impact',
      bendEffectDefSchema,
      { ...effect, impact: { ...effect.impact, ...extra } },
    ],
  ])('rejects an unknown key on %s', (_label, schema, value) => {
    expectSchemaFailure(schema, value);
  });
});
