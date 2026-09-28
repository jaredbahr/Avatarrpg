import { describe, expect, it } from 'vitest';
import { HEADINGS } from './assets/clips';
import type { Heading } from './assets/clips';
import {
  bendAttackCueSchema,
  bendEffectDefSchema,
  bendEffectLayerSchema,
  bendFrameSocketsSchema,
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
  BendPhase,
  BendResidue,
  BendSetDef,
  BendTrajectory,
  HeadingBendDef,
} from './bends';

/**
 * The bend contract is data, so it is validated like content (ADR 0054): every
 * rule gets its own failing case, and the merged real data must pass untouched.
 */

const KNOWN_UNIT_ASSETS = ['unit.fire.kaya'];
const KNOWN_FRAMES = ['bend/0', 'bend/1', 'bend/2'];
const SOURCE_SIZE = { width: 96, height: 96 };

function attackOf(overrides: Partial<BendAttackCue> = {}): BendAttackCue {
  return {
    id: 'jab',
    frame: 2,
    launchFrame: 1,
    socket: 'LW',
    launchHoldMs: 40,
    impactHoldMs: 80,
    effectId: 'fx.fire.jab',
    ...overrides,
  };
}

function straight(speed: number): BendTrajectory {
  return { kind: 'straight', speedTilesPerSecond: speed };
}

function arc(speed: number): BendTrajectory {
  return { kind: 'arc', speedTilesPerSecond: speed, heightTiles: 1, spin: 1 };
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
    root: { x: 48, y: 88 },
    anchor: { x: 0.5, y: 0.9 },
    keyFrames: { gather: 0, release: 1 },
    smearFrame: 1,
    attacks: [attackOf()],
    socketsPerFrame: [
      { frame: 0, sockets: { LA: { x: 40, y: 90 }, RA: { x: 56, y: 90 } } },
      { frame: 1, sockets: { LW: { x: 24, y: 48 }, RW: { x: 72, y: 48 } } },
      { frame: 2, sockets: { LW: { x: 20, y: 44 } } },
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
    layers: [layerOf('gather', 'bend-gather'), layerOf('impact', 'bend-burst')],
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
    const set = setOf({ headings: { east: { keyFrames: { gather: 3 } } } });
    expect(problemsFor([set])).toContain('keyFrames "gather" is frame 3 of 3');
  });

  it('rejects a smearFrame outside the clip', () => {
    const set = setOf({ headings: { east: { smearFrame: 3 } } });
    expect(problemsFor([set])).toContain('smearFrame 3 is outside 0..2');
  });

  it('rejects an attack frame outside the clip', () => {
    const set = setOf({ headings: { east: { attacks: [attackOf({ frame: 3 })] } } });
    expect(problemsFor([set])).toContain('attack "jab" frame 3 is outside 0..2');
  });

  it('rejects an attack launchFrame outside the clip', () => {
    const set = setOf({ headings: { east: { attacks: [attackOf({ launchFrame: 3 })] } } });
    expect(problemsFor([set])).toContain('attack "jab" launchFrame 3 is outside 0..2');
  });

  it('rejects an attack whose socket is missing from its launch frame', () => {
    const sockets: readonly BendFrameSockets[] = [
      { frame: 0, sockets: {} },
      { frame: 1, sockets: {} },
      { frame: 2, sockets: {} },
    ];
    const set = setOf({ headings: { east: { socketsPerFrame: sockets } } });
    expect(problemsFor([set])).toContain('needs socket LW on frame 1');
  });

  it('rejects a socket outside the source size', () => {
    const sockets: readonly BendFrameSockets[] = [
      { frame: 0, sockets: {} },
      { frame: 1, sockets: { LW: { x: 200, y: 48 } } },
      { frame: 2, sockets: {} },
    ];
    const set = setOf({ headings: { east: { socketsPerFrame: sockets } } });
    expect(problemsFor([set])).toContain('socket LW at 200,48 is outside 96x96');
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

  it('rejects a launchHoldMs outside 0..300', () => {
    const set = setOf({ headings: { east: { attacks: [attackOf({ launchHoldMs: 400 })] } } });
    expect(problemsFor([set])).toContain('launchHoldMs 400 is outside 0..300');
  });

  it('rejects an impactHoldMs outside 0..300', () => {
    const set = setOf({ headings: { east: { attacks: [attackOf({ impactHoldMs: 301 })] } } });
    expect(problemsFor([set])).toContain('impactHoldMs 301 is outside 0..300');
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

  it('rejects a whipFraction outside (0,1]', () => {
    const effect = effectOf({ trajectory: whipBolt(0, 2, 5) });
    expect(problemsFor([], [effect])).toContain('whipFraction 0 must be in (0,1]');
  });

  it('rejects a whipMaxTiles that does not reach', () => {
    const effect = effectOf({ trajectory: whipBolt(0.5, 0, 5) });
    expect(problemsFor([], [effect])).toContain('whipMaxTiles 0 must be above 0');
  });

  it('rejects a straight trajectory that does not travel', () => {
    const effect = effectOf({ trajectory: straight(0) });
    expect(problemsFor([], [effect])).toContain('speedTilesPerSecond 0 must be above 0');
  });

  it('rejects an arc trajectory that does not travel', () => {
    const effect = effectOf({ trajectory: arc(0) });
    expect(problemsFor([], [effect])).toContain('speedTilesPerSecond 0 must be above 0');
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
  ])('rejects an attack cue with %s', (_label, override) => {
    expectSchemaFailure(bendAttackCueSchema, attackOf(override));
  });

  it.each([
    ['no frames', { frames: [] }],
    ['more than sixteen frames', { frames: Array.from({ length: 17 }, () => 'bend/0') }],
    ['frameMs below sixteen', { frameMs: [15, 80, 120] }],
    ['frameMs above one thousand', { frameMs: [80, 80, 1001] }],
    ['fractional frameMs', { frameMs: [80, 80.5, 120] }],
    ['fractional key frame', { keyFrames: { release: 1.5 } }],
    ['negative key frame', { keyFrames: { release: -1 } }],
    ['fractional smear frame', { smearFrame: 1.5 }],
    ['negative smear frame', { smearFrame: -1 }],
  ])('rejects a heading with %s', (_label, override) => {
    expectSchemaFailure(headingBendDefSchema, facingOf(override));
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
    ['straight speed', straight(0)],
    ['arc speed', arc(0)],
    ['whip fraction at zero', whipBolt(0, 2, 5)],
    ['whip fraction above one', whipBolt(1.01, 2, 5)],
    ['whip maximum distance', whipBolt(0.5, 0, 5)],
    ['whip bolt speed', whipBolt(0.5, 2, 0)],
  ])('rejects a non-positive or out-of-range %s', (_label, trajectory) => {
    expectSchemaFailure(bendTrajectorySchema, trajectory);
  });

  it.each([
    ['empty timing', { ...layerOf('travel', 'bolt'), frameMs: [] }],
    ['non-positive timing', { ...layerOf('travel', 'bolt'), frameMs: [0] }],
    ['fractional timing', { ...layerOf('travel', 'bolt'), frameMs: [16.5] }],
  ])('rejects an effect layer with %s', (_label, layer) => {
    expectSchemaFailure(bendEffectLayerSchema, layer);
  });
});
